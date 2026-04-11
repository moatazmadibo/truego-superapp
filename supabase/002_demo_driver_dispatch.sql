drop function if exists public.accept_demo_ride(uuid, uuid);
drop function if exists public.accept_demo_ride(uuid, text);
drop function if exists public.complete_demo_ride(uuid, uuid);
drop function if exists public.complete_demo_ride(uuid, text);

create function public.accept_demo_ride(
  p_ride_id uuid,
  p_driver_id text
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
  into v_driver
  from public.demo_drivers
  where id = p_driver_id
  for update;

  if v_driver.id is null then
    raise exception 'Demo driver not found';
  end if;

  if v_driver.is_available is not true then
    raise exception 'Driver is not available';
  end if;

  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_ride.status <> 'searching' then
    raise exception 'Ride is no longer available';
  end if;

  if v_ride.vehicle_type <> v_driver.vehicle_type then
    raise exception 'Vehicle type mismatch';
  end if;

  update public.rides
  set
    driver_user_id = null,
    driver_name = v_driver.display_name,
    status = 'driver_arriving',
    accepted_at = now()
  where id = p_ride_id
  returning *
  into v_ride;

  update public.demo_drivers
  set
    is_available = false,
    updated_at = now()
  where id = p_driver_id;

  return v_ride;
end;
$$;

create function public.complete_demo_ride(
  p_ride_id uuid,
  p_driver_id text
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
  into v_driver
  from public.demo_drivers
  where id = p_driver_id
  for update;

  if v_driver.id is null then
    raise exception 'Demo driver not found';
  end if;

  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  if v_ride.driver_name is distinct from v_driver.display_name then
    raise exception 'Ride is not assigned to this driver';
  end if;

  update public.rides
  set
    status = 'completed',
    completed_at = now()
  where id = p_ride_id
  returning *
  into v_ride;

  update public.demo_drivers
  set
    is_available = true,
    updated_at = now()
  where id = p_driver_id;

  return v_ride;
end;
$$;
