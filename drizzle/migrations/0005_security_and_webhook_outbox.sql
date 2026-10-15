DROP POLICY IF EXISTS "view providers" ON public.providers;
CREATE POLICY "admins view providers" ON public.providers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "update shipments" ON public.shipments;
CREATE POLICY "update shipments" ON public.shipments FOR UPDATE TO authenticated USING (public.can_see_shipment(shipments.*)) WITH CHECK (public.can_see_shipment(shipments.*));

CREATE OR REPLACE FUNCTION public.shipments_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare me uuid := auth.uid();
begin
  if me is null or public.has_role(me,'admin') then return new; end if;
  if new.created_by is distinct from old.created_by or new.tracking_code is distinct from old.tracking_code
     or new.delivery_otp is distinct from old.delivery_otp or new.courier_partner_id is distinct from old.courier_partner_id
     or new.external_order_id is distinct from old.external_order_id or new.partner_awb is distinct from old.partner_awb
     or new.is_demo is distinct from old.is_demo or new.created_at is distinct from old.created_at then
    raise exception 'You cannot change these shipment details';
  end if;
  if new.otp_verified_at is distinct from old.otp_verified_at and coalesce(current_setting('app.otp_ok', true),'') <> '1' then
    raise exception 'Delivery needs the customer OTP';
  end if;
  if new.rider_id is not distinct from old.rider_id and new.lot_id is not distinct from old.lot_id then
    new.manager_id := old.manager_id; new.distributor_id := old.distributor_id;
  end if;
  if new.lot_id is not null and new.lot_id is distinct from old.lot_id and not exists (
    select 1 from public.lots l where l.id = new.lot_id and (l.manager_id = me or public.is_ancestor(me, l.manager_id) or public.is_ancestor(l.manager_id, me))) then
    raise exception 'Lot is not in your team';
  end if;
  return new;
end $$;
DROP TRIGGER IF EXISTS shipments_guard_update ON public.shipments;
CREATE TRIGGER shipments_guard_update BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.shipments_guard_update();

CREATE TABLE public.webhook_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
GRANT SELECT ON public.webhook_outbox TO authenticated;
GRANT ALL ON public.webhook_outbox TO service_role;
ALTER TABLE public.webhook_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view outbox" ON public.webhook_outbox FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX webhook_outbox_due ON public.webhook_outbox (status, next_attempt_at);

ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS outbox_id uuid REFERENCES public.webhook_outbox(id) ON DELETE SET NULL;
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1;
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS request_body jsonb;
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS response_body text;

CREATE OR REPLACE FUNCTION public.enqueue_webhook(_event text, _data jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  insert into public.webhook_outbox (endpoint_id, event, payload)
  select e.id, _event, jsonb_build_object('id', gen_random_uuid(), 'event', _event, 'created_at', now(), 'data', _data)
  from public.webhook_endpoints e where e.active and _event = any(e.events);
$$;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.shipments_webhook_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_webhook('shipment.created', jsonb_build_object('id',new.id,'tracking_code',new.tracking_code,'status',new.status,'external_order_id',new.external_order_id,'updated_at',new.updated_at));
  elsif new.status is distinct from old.status then
    perform public.enqueue_webhook('shipment.updated', jsonb_build_object('id',new.id,'tracking_code',new.tracking_code,'status',new.status,'previous_status',old.status,'external_order_id',new.external_order_id,'updated_at',new.updated_at));
  end if;
  return null;
end $$;
DROP TRIGGER IF EXISTS shipments_webhook ON public.shipments;
CREATE TRIGGER shipments_webhook AFTER INSERT OR UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.shipments_webhook_trg();

CREATE OR REPLACE FUNCTION public.returns_webhook_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare code text;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    select tracking_code into code from public.shipments where id = new.shipment_id;
    perform public.enqueue_webhook('return.updated', jsonb_build_object('id',new.id,'shipment_id',new.shipment_id,'tracking_code',code,'kind',new.kind,'status',new.status,'previous_status',case when tg_op='UPDATE' then old.status end,'updated_at',new.updated_at));
  end if;
  return null;
end $$;
DROP TRIGGER IF EXISTS returns_webhook ON public.return_requests;
CREATE TRIGGER returns_webhook AFTER INSERT OR UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.returns_webhook_trg();