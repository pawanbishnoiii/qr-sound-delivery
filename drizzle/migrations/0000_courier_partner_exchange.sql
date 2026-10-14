CREATE TABLE public.courier_partners (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100), adapter text NOT NULL CHECK (adapter IN ('shiprocket','delhivery','custom','demo')), account_reference text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true, connection_status text NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected','configured','connected','degraded','demo')), last_sync_at timestamptz, last_error text, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.courier_partners TO authenticated;
GRANT ALL ON public.courier_partners TO service_role;
ALTER TABLE public.courier_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage courier partners" ON public.courier_partners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.partner_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id uuid NOT NULL REFERENCES public.courier_partners(id), external_order_id text NOT NULL CHECK (char_length(external_order_id) BETWEEN 1 AND 120), order_data jsonb NOT NULL DEFAULT '{}', shipment_id uuid REFERENCES public.shipments(id), source text NOT NULL DEFAULT 'api' CHECK (source IN ('api','webhook','demo')), received_at timestamptz NOT NULL DEFAULT now(), UNIQUE(partner_id,external_order_id)
);
GRANT SELECT, INSERT, UPDATE ON public.partner_orders TO authenticated;
GRANT ALL ON public.partner_orders TO service_role;
ALTER TABLE public.partner_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage exchanged orders" ON public.partner_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.integration_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id uuid NOT NULL REFERENCES public.courier_partners(id), event_key text NOT NULL, event_type text NOT NULL CHECK (event_type IN ('test','sync','webhook','import')), outcome text NOT NULL CHECK (outcome IN ('received','success','failed')), message text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(partner_id,event_key)
);
GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read integration history" ON public.integration_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX partner_orders_received_idx ON public.partner_orders(partner_id,received_at DESC);
CREATE INDEX integration_events_recent_idx ON public.integration_events(partner_id,created_at DESC);
ALTER TABLE public.shipments ADD COLUMN courier_partner_id uuid REFERENCES public.courier_partners(id);
ALTER TABLE public.shipments ADD COLUMN external_order_id text;
ALTER TABLE public.shipments ADD COLUMN partner_awb text;
CREATE UNIQUE INDEX shipments_partner_external_unique ON public.shipments(courier_partner_id,external_order_id) WHERE courier_partner_id IS NOT NULL AND external_order_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.import_partner_order(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o public.partner_orders; p public.courier_partners; d jsonb; sid uuid;
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO o FROM public.partner_orders WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.shipment_id IS NOT NULL THEN RETURN o.shipment_id; END IF;
 SELECT * INTO p FROM public.courier_partners WHERE id=o.partner_id;
 d:=o.order_data;
 IF coalesce(d->>'receiver_name','')='' OR coalesce(d->>'receiver_address','')='' OR coalesce(d->>'city','')='' OR coalesce(d->>'pincode','') !~ '^[1-9][0-9]{5}$' OR coalesce(d->>'receiver_phone','') !~ '^\+?[0-9]{10,15}$' THEN RAISE EXCEPTION 'Complete recipient name, phone, address, city and valid PIN code before importing'; END IF;
 INSERT INTO public.shipments(sender_name,sender_phone,receiver_name,receiver_phone,receiver_address,city,pincode,weight_kg,cod_amount,courier_partner_id,external_order_id,partner_awb,is_demo,notes)
 VALUES(coalesce(nullif(d->>'sender_name',''),p.name),coalesce(d->>'sender_phone',''),left(d->>'receiver_name',120),d->>'receiver_phone',left(d->>'receiver_address',1000),left(d->>'city',100),d->>'pincode',greatest(coalesce((d->>'weight_kg')::numeric,1),0.001),greatest(coalesce((d->>'cod_amount')::numeric,0),0),o.partner_id,o.external_order_id,nullif(d->>'awb',''),p.adapter='demo','Imported from courier partner exchange') RETURNING id INTO sid;
 UPDATE public.partner_orders SET shipment_id=sid WHERE id=o.id;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.import_partner_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_partner_order(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.claim_shipment(_code text) RETURNS public.shipments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.shipments; me uuid:=auth.uid();
BEGIN
 IF NOT coalesce(public.has_role(me,'rider'),false) THEN RAISE EXCEPTION 'Only riders can claim parcels'; END IF;
 SELECT * INTO s FROM public.shipments WHERE upper(tracking_code)=upper(trim(_code)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;
 IF s.rider_id=me THEN RETURN s; END IF;
 IF s.rider_id IS NOT NULL THEN RAISE EXCEPTION 'Already claimed by another rider'; END IF;
 IF s.status NOT IN ('created','assigned') THEN RAISE EXCEPTION 'Parcel is not available for sorting'; END IF;
 IF s.lot_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.lots l WHERE l.id=s.lot_id AND public.is_ancestor(l.manager_id,me)) THEN RAISE EXCEPTION 'Parcel is not in your manager''s lot'; END IF;
 PERFORM set_config('app.claim_ok','1',true);
 UPDATE public.shipments SET rider_id=me WHERE id=s.id RETURNING * INTO s;
 RETURN s;
END $$;