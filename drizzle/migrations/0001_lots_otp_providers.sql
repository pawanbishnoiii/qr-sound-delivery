create table public.lots (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('LOT' || to_char(now(),'YYMMDD') || upper(substr(md5(random()::text),1,4))),
  name text not null default '',
  manager_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid default auth.uid(),
  status text not null default 'sorting',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lots to authenticated;
grant all on public.lots to service_role;
alter table public.lots enable row level security;
create policy "view lots" on public.lots for select to authenticated using (
  public.has_role(auth.uid(),'admin') or manager_id = auth.uid() or created_by = auth.uid()
  or public.is_ancestor(auth.uid(), manager_id) or public.is_ancestor(manager_id, auth.uid()));
create policy "create lots" on public.lots for insert to authenticated with check (
  public.get_user_role(auth.uid()) in ('admin','distributor','manager')
  and (manager_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_ancestor(auth.uid(), manager_id)));
create policy "update lots" on public.lots for update to authenticated using (
  public.has_role(auth.uid(),'admin') or manager_id = auth.uid() or public.is_ancestor(auth.uid(), manager_id));
create policy "delete lots" on public.lots for delete to authenticated using (
  public.has_role(auth.uid(),'admin') or manager_id = auth.uid() or public.is_ancestor(auth.uid(), manager_id));

alter table public.shipments add column lot_id uuid references public.lots(id) on delete set null;
alter table public.shipments add column delivery_otp text not null default '1234';
alter table public.shipments add column otp_sent_at timestamptz;
alter table public.shipments add column otp_verified_at timestamptz;
alter table public.shipments add column is_demo boolean not null default false;
create index on public.shipments (lot_id);

create or replace function public.can_see_shipment(_s public.shipments)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or _s.created_by = auth.uid() or _s.distributor_id = auth.uid()
    or _s.manager_id = auth.uid() or _s.rider_id = auth.uid()
    or (_s.rider_id is null and _s.lot_id is not null and exists (
      select 1 from public.lots l where l.id = _s.lot_id and (public.is_ancestor(l.manager_id, auth.uid()) or public.is_ancestor(auth.uid(), l.manager_id))))
$$;

create or replace function public.shipments_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare base uuid; me uuid := auth.uid(); lot_mgr uuid;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := coalesce(me, new.created_by); end if;
  if tg_op = 'INSERT' or new.rider_id is distinct from old.rider_id or new.lot_id is distinct from old.lot_id then
    if new.rider_id is not null and me is not null and (tg_op = 'INSERT' or new.rider_id is distinct from old.rider_id) then
      if not public.has_role(new.rider_id,'rider') then raise exception 'Selected user is not a rider'; end if;
      if public.get_user_role(me) = 'rider' and coalesce(current_setting('app.claim_ok', true),'') <> '1' then
        raise exception 'Riders claim parcels by scanning in Sort mode';
      end if;
      if not public.has_role(me,'admin') and new.rider_id <> me and not public.is_ancestor(me, new.rider_id) then
        raise exception 'Rider is not in your team';
      end if;
    end if;
    select manager_id into lot_mgr from public.lots where id = new.lot_id;
    base := coalesce(new.rider_id, lot_mgr, new.created_by);
    new.manager_id := public.chain_role_id(base,'manager');
    new.distributor_id := public.chain_role_id(base,'distributor');
    if new.rider_id is not null and new.status = 'created' then new.status := 'assigned'; end if;
    if new.rider_id is null and new.status = 'assigned' then new.status := 'created'; end if;
  end if;
  if new.status = 'delivered' and (tg_op = 'INSERT' or old.status <> 'delivered') then
    if coalesce(current_setting('app.otp_ok', true),'') <> '1' and not public.has_role(coalesce(me, '00000000-0000-0000-0000-000000000000'::uuid),'admin') and me is not null then
      raise exception 'Delivery needs the customer OTP';
    end if;
    new.delivered_at := now();
  end if;
  return new;
end $$;

create or replace function public.claim_shipment(_code text)
returns public.shipments language plpgsql security definer set search_path = public as $$
declare s public.shipments; me uuid := auth.uid();
begin
  if not public.has_role(me,'rider') then raise exception 'Only riders can claim parcels'; end if;
  select * into s from public.shipments where upper(tracking_code) = upper(trim(_code));
  if not found then raise exception 'Parcel not found'; end if;
  if s.rider_id = me then return s; end if;
  if s.rider_id is not null then raise exception 'Already claimed by another rider'; end if;
  if s.lot_id is null or not exists (select 1 from public.lots l where l.id = s.lot_id and public.is_ancestor(l.manager_id, me)) then
    raise exception 'Parcel is not in your manager''s lot';
  end if;
  perform set_config('app.claim_ok','1',true);
  update public.shipments set rider_id = me where id = s.id returning * into s;
  return s;
end $$;
grant execute on function public.claim_shipment(text) to authenticated;

create or replace function public.send_delivery_otp(_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s public.shipments;
begin
  select * into s from public.shipments where id = _id;
  if not found or not public.can_see_shipment(s) then raise exception 'Not allowed'; end if;
  update public.shipments set delivery_otp = '1234', otp_sent_at = now() where id = _id;
  insert into public.shipment_events (shipment_id, status, note, actor_id)
  values (_id, s.status, 'Delivery OTP sent to ' || s.receiver_phone || ' (demo SMS)', auth.uid());
  return json_build_object('phone', s.receiver_phone, 'demo', true);
end $$;
grant execute on function public.send_delivery_otp(uuid) to authenticated;

create or replace function public.deliver_with_otp(_id uuid, _otp text)
returns public.shipments language plpgsql security definer set search_path = public as $$
declare s public.shipments;
begin
  select * into s from public.shipments where id = _id;
  if not found or not public.can_see_shipment(s) then raise exception 'Not allowed'; end if;
  if s.otp_sent_at is null then raise exception 'Send the OTP first'; end if;
  if trim(_otp) <> s.delivery_otp then raise exception 'Wrong OTP'; end if;
  perform set_config('app.otp_ok','1',true);
  update public.shipments set status = 'delivered', otp_verified_at = now() where id = _id returning * into s;
  return s;
end $$;
grant execute on function public.deliver_with_otp(uuid, text) to authenticated;

create or replace function public.seed_demo_orders(_count int, _lot uuid default null, _city text default null)
returns int language plpgsql security definer set search_path = public as $$
declare i int; firsts text[] := array['Aarav','Priya','Rohit','Neha','Vikram','Pooja','Arjun','Kavita','Sandeep','Anjali','Manoj','Sunita','Rahul','Deepika','Harpreet','Gurpreet'];
  lasts text[] := array['Sharma','Verma','Singh','Choudhary','Meena','Jat','Agarwal','Gupta','Bishnoi','Rathore','Kaur','Sethi'];
  cities text[] := array['Gharsana','Anupgarh','Suratgarh','Raisinghnagar','Sri Ganganagar'];
  senders text[] := array['Meesho Seller Hub','Flipkart Marketplace','Amazon Seller','Shopify Store','Local Kirana Mart'];
  n int := least(greatest(coalesce(_count,1),1),1000);
begin
  if public.get_user_role(auth.uid()) not in ('admin','distributor','manager') then raise exception 'Not allowed'; end if;
  for i in 1..n loop
    insert into public.shipments (sender_name, sender_phone, receiver_name, receiver_phone, receiver_address, city, pincode, weight_kg, cod_amount, lot_id, is_demo, notes)
    values (
      senders[1 + floor(random()*array_length(senders,1))::int],
      '98' || lpad((floor(random()*100000000))::text, 8, '0'),
      firsts[1 + floor(random()*array_length(firsts,1))::int] || ' ' || lasts[1 + floor(random()*array_length(lasts,1))::int],
      '9' || lpad((floor(random()*1000000000))::text, 9, '0'),
      (1 + floor(random()*250))::text || ', Ward ' || (1 + floor(random()*30))::text || ', Main Bazaar',
      coalesce(_city, cities[1 + floor(random()*array_length(cities,1))::int]),
      '335' || lpad((floor(random()*1000))::text, 3, '0'),
      round((0.2 + random()*5)::numeric, 2),
      case when random() < 0.65 then (100 + floor(random()*30)*50) else 0 end,
      _lot, true, 'DEMO ORDER');
  end loop;
  return n;
end $$;
grant execute on function public.seed_demo_orders(int, uuid, text) to authenticated;

create or replace function public.duplicate_shipment(_id uuid, _copies int)
returns int language plpgsql security definer set search_path = public as $$
declare s public.shipments; i int; n int := least(greatest(coalesce(_copies,1),1),1000);
begin
  if public.get_user_role(auth.uid()) not in ('admin','distributor','manager') then raise exception 'Not allowed'; end if;
  select * into s from public.shipments where id = _id;
  if not found or not public.can_see_shipment(s) then raise exception 'Not allowed'; end if;
  for i in 1..n loop
    insert into public.shipments (sender_name, sender_phone, receiver_name, receiver_phone, receiver_address, city, pincode, weight_kg, cod_amount, lot_id, is_demo, notes)
    values (s.sender_name, s.sender_phone, s.receiver_name, s.receiver_phone, s.receiver_address, s.city, s.pincode, s.weight_kg, s.cod_amount, s.lot_id, s.is_demo, s.notes);
  end loop;
  return n;
end $$;
grant execute on function public.duplicate_shipment(uuid, int) to authenticated;

create or replace function public.track_shipment(_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'order_id', s.id, 'tracking_code', s.tracking_code, 'status', s.status, 'city', s.city,
    'receiver', split_part(s.receiver_name,' ',1), 'created_at', s.created_at, 'updated_at', s.updated_at,
    'delivered_at', s.delivered_at,
    'events', coalesce((select json_agg(json_build_object('status', e.status, 'note', e.note, 'at', e.created_at) order by e.created_at) from public.shipment_events e where e.shipment_id = s.id), '[]'::json)
  ) from public.shipments s
  where upper(s.tracking_code) = upper(trim(_code)) or s.id::text = lower(trim(_code)) limit 1
$$;
grant execute on function public.track_shipment(text) to anon, authenticated;

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null default '',
  enabled boolean not null default false,
  mode text not null default 'demo',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.providers to authenticated;
grant insert, update, delete on public.providers to authenticated;
grant all on public.providers to service_role;
alter table public.providers enable row level security;
create policy "view providers" on public.providers for select to authenticated using (true);
create policy "admin manage providers" on public.providers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter publication supabase_realtime add table public.lots;