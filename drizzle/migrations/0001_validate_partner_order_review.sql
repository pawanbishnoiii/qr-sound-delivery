CREATE OR REPLACE FUNCTION public.import_partner_order(_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o public.partner_orders; p public.courier_partners; d jsonb; sid uuid;
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO o FROM public.partner_orders WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF o.shipment_id IS NOT NULL THEN RETURN o.shipment_id; END IF;
 SELECT * INTO p FROM public.courier_partners WHERE id=o.partner_id;
 IF NOT p.enabled THEN RAISE EXCEPTION 'Courier partner is disabled'; END IF;
 d:=o.order_data;
 IF coalesce((d->>'review_required')::boolean,false) THEN RAISE EXCEPTION 'Review recipient, parcel weight and COD amount before importing'; END IF;
 IF coalesce(d->>'receiver_name','')='' OR coalesce(d->>'receiver_address','')='' OR coalesce(d->>'city','')='' OR coalesce(d->>'pincode','') !~ '^[1-9][0-9]{5}$' OR coalesce(d->>'receiver_phone','') !~ '^\+?[0-9]{10,15}$' THEN RAISE EXCEPTION 'Complete recipient name, phone, address, city and valid PIN code before importing'; END IF;
 IF coalesce((d->>'weight_kg')::numeric,0)<=0 OR coalesce((d->>'weight_kg')::numeric,0)>1000 OR coalesce((d->>'cod_amount')::numeric,0)<0 OR coalesce((d->>'cod_amount')::numeric,0)>1000000 THEN RAISE EXCEPTION 'Invalid package weight or COD amount'; END IF;
 INSERT INTO public.shipments(sender_name,sender_phone,receiver_name,receiver_phone,receiver_address,city,pincode,weight_kg,cod_amount,courier_partner_id,external_order_id,partner_awb,is_demo,notes)
 VALUES(coalesce(nullif(d->>'sender_name',''),p.name),coalesce(d->>'sender_phone',''),left(d->>'receiver_name',120),d->>'receiver_phone',left(d->>'receiver_address',1000),left(d->>'city',100),d->>'pincode',(d->>'weight_kg')::numeric,coalesce((d->>'cod_amount')::numeric,0),o.partner_id,o.external_order_id,nullif(d->>'awb',''),p.adapter='demo','Imported from courier partner exchange') RETURNING id INTO sid;
 UPDATE public.partner_orders SET shipment_id=sid WHERE id=o.id;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.import_partner_order(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_partner_order(uuid) TO authenticated;