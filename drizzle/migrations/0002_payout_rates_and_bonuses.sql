CREATE TABLE public.payout_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rider_delivery numeric NOT NULL DEFAULT 15 CHECK (rider_delivery >= 0),
  rider_return numeric NOT NULL DEFAULT 10 CHECK (rider_return >= 0),
  manager_delivery numeric NOT NULL DEFAULT 3 CHECK (manager_delivery >= 0),
  distributor_delivery numeric NOT NULL DEFAULT 2 CHECK (distributor_delivery >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payout_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, UPDATE ON public.payout_settings TO authenticated;
GRANT ALL ON public.payout_settings TO service_role;
ALTER TABLE public.payout_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read payout rates" ON public.payout_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin updates payout rates" ON public.payout_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.payout_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) between 2 and 80),
  kind text NOT NULL DEFAULT 'festival' CHECK (kind in ('festival','sale')),
  rider_bonus numeric NOT NULL DEFAULT 0 CHECK (rider_bonus >= 0),
  manager_bonus numeric NOT NULL DEFAULT 0 CHECK (manager_bonus >= 0),
  distributor_bonus numeric NOT NULL DEFAULT 0 CHECK (distributor_bonus >= 0),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_bonuses TO authenticated;
GRANT ALL ON public.payout_bonuses TO service_role;
ALTER TABLE public.payout_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read bonuses" ON public.payout_bonuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages bonuses" ON public.payout_bonuses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.credit_rider_wallet()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare ps public.payout_settings; rb numeric := 0; mb numeric := 0; db numeric := 0; bname text;
begin
  if new.status is distinct from old.status and new.status in ('delivered','returned') then
    select * into ps from public.payout_settings where id = 1;
    select coalesce(sum(rider_bonus),0), coalesce(sum(manager_bonus),0), coalesce(sum(distributor_bonus),0), string_agg(name, ', ')
      into rb, mb, db, bname
      from public.payout_bonuses where active and current_date between starts_on and ends_on;
    if new.rider_id is not null then
      insert into public.rider_wallet_txns(rider_id, shipment_id, kind, amount, note)
      values (new.rider_id, new.id, new.status::text,
        (case when new.status = 'delivered' then coalesce(ps.rider_delivery,15) else coalesce(ps.rider_return,10) end) + case when new.status='delivered' then rb else 0 end,
        'Auto credit for ' || new.tracking_code || case when new.status='delivered' and rb > 0 then ' (+' || rb || ' ' || bname || ')' else '' end)
      on conflict (shipment_id, kind) do nothing;
    end if;
    if new.status = 'delivered' and new.manager_id is not null and coalesce(ps.manager_delivery,0) + mb > 0 then
      insert into public.rider_wallet_txns(rider_id, shipment_id, kind, amount, note)
      values (new.manager_id, new.id, 'manager_delivered', coalesce(ps.manager_delivery,0) + mb, 'Manager share for ' || new.tracking_code)
      on conflict (shipment_id, kind) do nothing;
    end if;
    if new.status = 'delivered' and new.distributor_id is not null and coalesce(ps.distributor_delivery,0) + db > 0 then
      insert into public.rider_wallet_txns(rider_id, shipment_id, kind, amount, note)
      values (new.distributor_id, new.id, 'distributor_delivered', coalesce(ps.distributor_delivery,0) + db, 'Distributor share for ' || new.tracking_code)
      on conflict (shipment_id, kind) do nothing;
    end if;
  end if;
  return new;
end $function$;