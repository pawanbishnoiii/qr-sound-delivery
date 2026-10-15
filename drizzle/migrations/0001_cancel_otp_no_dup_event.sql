CREATE OR REPLACE FUNCTION public.cancel_with_otp(_id uuid, _otp text, _reason text) RETURNS public.shipments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare s public.shipments;
begin
  select * into s from public.shipments where id = _id;
  if not found or not public.can_see_shipment(s) then raise exception 'Not allowed'; end if;
  if s.status in ('delivered','returned','cancelled') then raise exception 'Parcel already closed'; end if;
  if trim(_otp) <> s.delivery_otp then raise exception 'Wrong customer OTP'; end if;
  update public.shipments set status = 'cancelled', notes = trim(coalesce(notes,'') || E'\nCancelled: ' || coalesce(_reason,'')) where id = _id returning * into s;
  return s;
end $$;