CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);
CREATE INDEX IF NOT EXISTS profiles_parent_idx ON public.profiles (parent_id);
CREATE INDEX IF NOT EXISTS shipments_rider_status_idx ON public.shipments (rider_id, status);
CREATE INDEX IF NOT EXISTS shipments_created_at_idx ON public.shipments (created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_lot_idx ON public.shipments (lot_id);
CREATE INDEX IF NOT EXISTS shipments_manager_idx ON public.shipments (manager_id);
CREATE INDEX IF NOT EXISTS shipments_distributor_idx ON public.shipments (distributor_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare ph text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone',''), '[^0-9+]', '', 'g'), '');
begin
  if ph is not null and ph ~ '^[6-9][0-9]{9}$' then ph := '+91' || ph; end if;
  insert into public.profiles (id, full_name, email, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email, ph);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $function$;