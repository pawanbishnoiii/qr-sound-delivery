create type public.app_role as enum ('admin','distributor','manager','rider');
create type public.shipment_status as enum ('created','assigned','picked_up','in_transit','out_for_delivery','delivered','failed','returned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  parent_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_user_role(_user_id uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = _user_id
  order by case role when 'admin' then 1 when 'distributor' then 2 when 'manager' then 3 else 4 end
  limit 1
$$;

create or replace function public.is_ancestor(_anc uuid, _desc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_id, 0 as depth from public.profiles where id = _desc
    union all
    select p.id, p.parent_id, c.depth + 1 from public.profiles p join chain c on p.id = c.parent_id where c.depth < 20
  )
  select exists (select 1 from chain where parent_id = _anc)
$$;

create or replace function public.chain_role_id(_user uuid, _role public.app_role)
returns uuid language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_id, 0 as depth from public.profiles where id = _user
    union all
    select p.id, p.parent_id, c.depth + 1 from public.profiles p join chain c on p.id = c.parent_id where c.depth < 20
  )
  select c.id from chain c join public.user_roles r on r.user_id = c.id and r.role = _role
  order by c.depth limit 1
$$;

create policy "profiles visible in hierarchy" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_ancestor(auth.uid(), id) or public.is_ancestor(id, auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "roles visible in hierarchy" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_ancestor(auth.uid(), user_id) or public.is_ancestor(user_id, auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'phone');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique default ('RF' || to_char(now(),'YYMMDD') || upper(substr(md5(random()::text),1,5))),
  sender_name text not null,
  sender_phone text,
  receiver_name text not null,
  receiver_phone text not null,
  receiver_address text not null,
  city text not null,
  pincode text,
  weight_kg numeric(8,2) not null default 0.5,
  cod_amount numeric(12,2) not null default 0,
  cod_collected boolean not null default false,
  notes text,
  status public.shipment_status not null default 'created',
  created_by uuid,
  distributor_id uuid,
  manager_id uuid,
  rider_id uuid,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.shipments (rider_id);
create index on public.shipments (manager_id);
create index on public.shipments (distributor_id);
create index on public.shipments (status);
grant select, insert, update, delete on public.shipments to authenticated;
grant all on public.shipments to service_role;
alter table public.shipments enable row level security;

create or replace function public.can_see_shipment(_s public.shipments)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or _s.created_by = auth.uid() or _s.distributor_id = auth.uid()
    or _s.manager_id = auth.uid() or _s.rider_id = auth.uid()
$$;

create policy "view shipments" on public.shipments for select to authenticated using (public.can_see_shipment(shipments));
create policy "create shipments" on public.shipments for insert to authenticated
with check (public.get_user_role(auth.uid()) in ('admin','distributor','manager'));
create policy "update shipments" on public.shipments for update to authenticated
using (public.can_see_shipment(shipments)) with check (true);
create policy "delete shipments" on public.shipments for delete to authenticated
using (public.has_role(auth.uid(),'admin') or (created_by = auth.uid() and status = 'created'));

create or replace function public.shipments_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare base uuid; me uuid := auth.uid();
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(me, new.created_by);
  end if;
  if tg_op = 'INSERT' or new.rider_id is distinct from old.rider_id then
    if new.rider_id is not null and me is not null then
      if not public.has_role(new.rider_id,'rider') then raise exception 'Selected user is not a rider'; end if;
      if public.get_user_role(me) = 'rider' then raise exception 'Riders cannot reassign shipments'; end if;
      if not public.has_role(me,'admin') and not public.is_ancestor(me, new.rider_id) then
        raise exception 'Rider is not in your team';
      end if;
    end if;
    base := coalesce(new.rider_id, new.created_by);
    new.manager_id := public.chain_role_id(base,'manager');
    new.distributor_id := public.chain_role_id(base,'distributor');
    if new.rider_id is not null and new.status = 'created' then new.status := 'assigned'; end if;
    if new.rider_id is null and new.status = 'assigned' then new.status := 'created'; end if;
  end if;
  if new.status = 'delivered' and (tg_op = 'INSERT' or old.status <> 'delivered') then
    new.delivered_at := now();
  end if;
  return new;
end $$;
create trigger shipments_before before insert or update on public.shipments for each row execute function public.shipments_before();

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status public.shipment_status not null,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index on public.shipment_events (shipment_id);
grant select, insert on public.shipment_events to authenticated;
grant all on public.shipment_events to service_role;
alter table public.shipment_events enable row level security;
create policy "view events" on public.shipment_events for select to authenticated
using (exists (select 1 from public.shipments s where s.id = shipment_id and public.can_see_shipment(s)));
create policy "add events" on public.shipment_events for insert to authenticated
with check (actor_id = auth.uid() and exists (select 1 from public.shipments s where s.id = shipment_id and public.can_see_shipment(s)));

create or replace function public.shipments_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.shipment_events (shipment_id, status, actor_id) values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger shipments_after after insert or update on public.shipments for each row execute function public.shipments_after();

create or replace function public.track_shipment(_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'tracking_code', s.tracking_code, 'status', s.status, 'city', s.city,
    'receiver', split_part(s.receiver_name,' ',1), 'created_at', s.created_at, 'updated_at', s.updated_at,
    'delivered_at', s.delivered_at,
    'events', coalesce((select json_agg(json_build_object('status', e.status, 'at', e.created_at) order by e.created_at) from public.shipment_events e where e.shipment_id = s.id), '[]'::json)
  ) from public.shipments s where upper(s.tracking_code) = upper(trim(_code)) limit 1
$$;
grant execute on function public.track_shipment(text) to anon, authenticated;

alter publication supabase_realtime add table public.shipments;