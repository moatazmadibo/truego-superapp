-- 026_set_collecting_offers_expiry.sql
-- Ensure every collecting_offers ride has a valid offer_expires_at timestamp.

create or replace function public.prepare_ride_for_driver_offers(
  p_ride_id uuid,
  p_offer_window_seconds integer default 60
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_window_seconds integer;
begin
  v_window_seconds := greatest(coalesce(p_offer_window_seconds, 60), 15);

  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status in ('driver_assigned', 'driver_arriving', 'in_progress', 'completed') then
    raise exception 'Cannot reopen a ride that is already assigned, active, or completed';
  end if;

  update public.ride_driver_offers
  set
    offer_status = 'expired',
    updated_at = now()
  where ride_id = p_ride_id
    and offer_status in ('submitted', 'shown');

  update public.rides
  set
    status = 'collecting_offers',
    offer_expires_at = now() + make_interval(secs => v_window_seconds),
    offered_demo_driver_id = null,
    demo_driver_id = null
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;

grant execute on function public.prepare_ride_for_driver_offers(uuid, integer) to anon, authenticated;
