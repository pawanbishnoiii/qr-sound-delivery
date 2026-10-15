CREATE TABLE public.rider_wallet_txns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'delivery',
  amount numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, kind)
);
GRANT SELECT ON public.rider_wallet_txns TO authenticated;
GRANT ALL ON public.rider_wallet_txns TO service_role;
ALTER TABLE public.rider_wallet_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet visible to rider and chain" ON public.rider_wallet_txns FOR SELECT TO authenticated
USING (rider_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id));

CREATE TABLE public.rider_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  rated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id)
);
GRANT SELECT, INSERT ON public.rider_ratings TO authenticated;
GRANT ALL ON public.rider_ratings TO service_role;
ALTER TABLE public.rider_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings visible to rider and chain" ON public.rider_ratings FOR SELECT TO authenticated
USING (rider_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id));
CREATE POLICY "chain can rate rider" ON public.rider_ratings FOR INSERT TO authenticated
WITH CHECK (rated_by = auth.uid() AND rider_id <> auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_ancestor(auth.uid(), rider_id)));

CREATE OR REPLACE FUNCTION public.credit_rider_wallet() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.rider_id is not null and new.status is distinct from old.status and new.status in ('delivered','returned') then
    insert into public.rider_wallet_txns(rider_id, shipment_id, kind, amount, note)
    values (new.rider_id, new.id, new.status::text, 15, 'Auto credit for ' || new.tracking_code)
    on conflict (shipment_id, kind) do nothing;
  end if;
  return new;
end $$;
CREATE TRIGGER shipments_credit_wallet AFTER UPDATE OF status ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.credit_rider_wallet();

CREATE OR REPLACE FUNCTION public.cancel_with_otp(_id uuid, _otp text, _reason text) RETURNS public.shipments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare s public.shipments;
begin
  select * into s from public.shipments where id = _id;
  if not found or not public.can_see_shipment(s) then raise exception 'Not allowed'; end if;
  if s.status in ('delivered','returned','cancelled') then raise exception 'Parcel already closed'; end if;
  if trim(_otp) <> s.delivery_otp then raise exception 'Wrong customer OTP'; end if;
  update public.shipments set status = 'cancelled', notes = trim(coalesce(notes,'') || E'\nCancelled: ' || coalesce(_reason,'')) where id = _id returning * into s;
  insert into public.shipment_events(shipment_id, status, note, actor_id) values (_id, 'cancelled', 'Cancelled with customer OTP: ' || coalesce(_reason,''), auth.uid());
  return s;
end $$;
GRANT EXECUTE ON FUNCTION public.cancel_with_otp(uuid, text, text) TO authenticated;