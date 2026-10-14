CREATE OR REPLACE FUNCTION public.return_requests_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  new.updated_at := now();
  if new.rider_id is not null and (tg_op = 'INSERT' or new.rider_id is distinct from old.rider_id) then
    if not public.has_role(new.rider_id, 'rider') then raise exception 'Selected user is not a rider'; end if;
    if new.status = 'requested' then new.status := 'pickup_assigned'; end if;
  end if;
  if tg_op = 'UPDATE' and old.status in ('received','cancelled') and new.status is distinct from old.status then
    raise exception 'This return is already closed';
  end if;
  return new;
end $$;
CREATE OR REPLACE FUNCTION public.return_requests_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.return_events (return_id, status, actor_id, lat, lng) values (new.id, new.status, auth.uid(), new.last_lat, new.last_lng);
    if tg_op = 'INSERT' and new.kind = 'cancellation' then
      update public.shipments set status = 'cancelled' where id = new.shipment_id and status not in ('delivered','returned','cancelled');
    end if;
    if new.status = 'received' then
      update public.shipments set status = 'returned' where id = new.shipment_id and status <> 'returned';
    end if;
  end if;
  return new;
end $$;
CREATE TRIGGER return_requests_after_change AFTER INSERT OR UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.return_requests_after();