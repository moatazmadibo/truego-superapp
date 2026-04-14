alter table public.rides
add column if not exists offered_demo_driver_id text references public.demo_drivers(id);

alter table public.rides
add column if not exists offer_expires_at timestamptz null;

alter table public.rides
add column if not exists driver_payout_pi numeric(10,2) null;

alter table public.rides
add column if not exists pricing_breakdown jsonb null;

drop function if exists public.dispatch_ride_to_nearest_demo_driver(uuid, integer);
drop function if exists public.accept_offered_demo_ride(uuid, text);

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
    offered_demo_driver_id = v_driver.id,
    status = 'offer_sent',
    offer_expires_at = now() + interval '20 seconds'
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

create function public.accept_offered_demo_ride(
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

  if v_ride.status <> 'offer_sent' then
    raise exception 'Ride is not awaiting driver offer acceptance';
  end if;

  if v_ride.offered_demo_driver_id is distinct from v_driver.id then
    raise exception 'Ride offer is not assigned to this driver';
  end if;

  if v_ride.offer_expires_at is not null and v_ride.offer_expires_at < now() then
    update public.rides
    set
      status = 'searching',
      offered_demo_driver_id = null,
      offer_expires_at = null
    where id = p_ride_id
    returning *
    into v_ride;

    update public.demo_drivers
    set
      is_available = true,
      updated_at = now()
    where id = v_driver.id;

    return v_ride;
  end if;

  update public.rides
  set
    driver_user_id = null,
    driver_name = v_driver.display_name,
    demo_driver_id = v_driver.id,
    offered_demo_driver_id = null,
    offer_expires_at = null,
    status = 'driver_arriving',
    accepted_at = now()
  where id = p_ride_id
  returning *
  into v_ride;

  return v_ride;
end;
$$;
