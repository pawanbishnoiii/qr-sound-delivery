ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'cancelled';

CREATE TABLE public.return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('customer_return','rto','cancellation')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','pickup_assigned','picked_up','in_transit','received','cancelled')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 500),
  pickup_address text,
  rider_id uuid,
  created_by uuid,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX return_requests_shipment_idx ON public.return_requests(shipment_id);
CREATE TABLE public.return_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_id uuid,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.return_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  path text NOT NULL,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  captured_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.return_requests TO authenticated;
GRANT SELECT, INSERT ON public.return_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.return_photos TO authenticated;
GRANT ALL ON public.return_requests, public.return_events, public.return_photos TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_return(_return_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.return_requests r join public.shipments s on s.id = r.shipment_id
    where r.id = _return_id and (public.can_see_shipment(s) or r.rider_id = auth.uid()))
$$;

CREATE POLICY "View visible returns" ON public.return_requests FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR exists (select 1 from public.shipments s where s.id = shipment_id and public.can_see_shipment(s)));
CREATE POLICY "Request returns on visible shipments" ON public.return_requests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND exists (select 1 from public.shipments s where s.id = shipment_id and public.can_see_shipment(s)));
CREATE POLICY "Update visible returns" ON public.return_requests FOR UPDATE TO authenticated
  USING (rider_id = auth.uid() OR exists (select 1 from public.shipments s where s.id = shipment_id and public.can_see_shipment(s)));
CREATE POLICY "View return events" ON public.return_events FOR SELECT TO authenticated USING (public.can_see_return(return_id));
CREATE POLICY "Add return events" ON public.return_events FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() AND public.can_see_return(return_id));
CREATE POLICY "View return photos" ON public.return_photos FOR SELECT TO authenticated USING (public.can_see_return(return_id));
CREATE POLICY "Add return photos" ON public.return_photos FOR INSERT TO authenticated WITH CHECK (captured_by = auth.uid() AND public.can_see_return(return_id));
CREATE POLICY "Remove own return photos" ON public.return_photos FOR DELETE TO authenticated USING (captured_by = auth.uid());

CREATE OR REPLACE FUNCTION public.return_requests_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  new.updated_at := now();
  if new.rider_id is not null and (tg_op = 'INSERT' or new.rider_id is distinct from old.rider_id) then
    if not public.has_role(new.rider_id, 'rider') then raise exception 'Selected user is not a rider'; end if;
    if new.status = 'requested' then new.status := 'pickup_assigned'; end if;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.return_events (return_id, status, actor_id, lat, lng) values (new.id, new.status, auth.uid(), new.last_lat, new.last_lng);
    if new.kind = 'cancellation' and new.status in ('requested','pickup_assigned') and tg_op = 'INSERT' then
      update public.shipments set status = 'cancelled' where id = new.shipment_id and status not in ('delivered','returned','cancelled');
    end if;
    if new.status = 'received' then
      update public.shipments set status = 'returned' where id = new.shipment_id and status <> 'returned';
    end if;
  end if;
  return new;
end $$;
CREATE TRIGGER return_requests_before_insert BEFORE INSERT ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.return_requests_trg();
CREATE TRIGGER return_requests_before_update BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.return_requests_trg();

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['shipments:read','shipments:write'],
  created_by uuid NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  url text NOT NULL CHECK (url ~ '^https://'),
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['shipment.created','shipment.updated','return.updated'],
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  last_status int,
  last_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  status_code int,
  ok boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.api_keys, public.webhook_endpoints, public.webhook_deliveries TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage api keys" ON public.api_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage webhooks" ON public.webhook_endpoints FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "Admins view deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.track_shipment(_code text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select json_build_object(
    'order_id', s.id, 'tracking_code', s.tracking_code, 'status', s.status, 'city', s.city,
    'receiver', split_part(s.receiver_name,' ',1), 'created_at', s.created_at, 'updated_at', s.updated_at,
    'delivered_at', s.delivered_at,
    'events', coalesce((select json_agg(json_build_object('status', e.status, 'note', e.note, 'at', e.created_at) order by e.created_at) from public.shipment_events e where e.shipment_id = s.id), '[]'::json),
    'returns', coalesce((select json_agg(json_build_object('kind', r.kind, 'status', r.status, 'requested_at', r.created_at, 'updated_at', r.updated_at,
        'events', coalesce((select json_agg(json_build_object('status', re.status, 'at', re.created_at) order by re.created_at) from public.return_events re where re.return_id = r.id), '[]'::json)) order by r.created_at)
      from public.return_requests r where r.shipment_id = s.id), '[]'::json)
  ) from public.shipments s
  where upper(s.tracking_code) = upper(trim(_code)) or s.id::text = lower(trim(_code)) limit 1
$$;