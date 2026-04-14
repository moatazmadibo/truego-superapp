drop function if exists public.dispatch_ride_to_nearest_demo_driver(uuid, integer);

create function public.dispatch_ride_to_nearest_demo_driver(
  p_ride_id uuid,
  p_presence_window_seconds integer default 90
)
returns public.rides
language plpgsql
security definer
as $$
declare
  v_ride public.rides;
  v_driver public.demo_drivers;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_ride.status <> 'searching' or v_ride.demo_driver_id is not null then
    return v_ride;
  end if;

  select *
  into v_driver
  from public.demo_drivers
  where vehicle_type = v_ride.vehicle_type
    and is_available = true
    and is_online = true
    and last_seen_at is not null
    and last_seen_at >= now() - make_interval(secs => p_presence_window_seconds)
    and lat is not null
    and lng is not null
  order by
    case
      when v_ride.pickup_lat is not null and v_ride.pickup_lng is not null then
        power(lat - v_ride.pickup_lat, 2) + power(lng - v_ride.pickup_lng, 2)
      else 0
    end asc,
    updated_at asc
  limit 1
  for update skip locked;

  if v_driver.id is null then
    return v_ride;
  end if;

  update public.rides
  set
    driver_user_id = null,
    driver_name = v_driver.display_name,
    demo_driver_id = v_driver.id,
    status = 'driver_assigned'
  where id = p_ride_id
  returning *
  into v_ride;

  update public.demo_drivers
  set
    is_available = false,
    updated_at = now()
  where id = v_driver.id;

  return v_ride;
end;
$$;
