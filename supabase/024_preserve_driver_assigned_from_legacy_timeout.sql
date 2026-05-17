-- =========================================================
-- TrueGo: preserve inDrive-style accepted offers from legacy timeout
-- The old demo dispatch timeout must not convert driver_assigned rides to no_driver_available.
-- collecting_offers and driver_assigned are controlled by ride_driver_offers flow.
-- =========================================================

alter table public.rides
drop constraint if exists rides_status_check;

alter table public.rides
add constraint rides_status_check
check (
  status in (
    'searching',
    'collecting_offers',
    'offer_sent',
    'driver_assigned',
    'driver_arriving',
    'in_progress',
    'completed',
    'cancelled',
    'no_driver_available',
    'offers_expired'
  )
);

create or replace function public.advance_demo_ride_offer(
  p_ride_id uuid,
  p_presence_window_seconds integer default 90,
  p_max_search_seconds integer default 60
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_driver public.demo_drivers;
  v_attempted jsonb;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if v_ride.id is null then
    raise exception 'Ride not found';
  end if;

  -- Critical fix:
  -- The new inDrive-style offer collection flow is not part of the old
  -- one-driver offer timeout. Do not convert it to no_driver_available.
  if v_ride.status in ('collecting_offers', 'offers_expired') then
    return v_ride;
  end if;

  if v_ride.search_started_at is null then
    update public.rides
    set search_started_at = coalesce(v_ride.created_at, now())
    where id = p_ride_id
    returning *
    into v_ride;
  end if;

  if v_ride.status in (
    'driver_assigned',
    'driver_arriving',
    'in_progress',
    'completed',
    'cancelled',
    'no_driver_available'
  ) then
    return v_ride;
  end if;

  if v_ride.status = 'offer_sent'
     and v_ride.offer_expires_at is not null
     and v_ride.offer_expires_at >= now() then
    return v_ride;
  end if;

  v_attempted := coalesce(v_ride.attempted_demo_driver_ids, '[]'::jsonb);

  if v_ride.status = 'offer_sent' and v_ride.offered_demo_driver_id is not null then
    if not exists (
      select 1
      from jsonb_array_elements_text(v_attempted) as attempted(id)
      where attempted.id = v_ride.offered_demo_driver_id
    ) then
      v_attempted := v_attempted || jsonb_build_array(v_ride.offered_demo_driver_id);
    end if;

    update public.demo_drivers
    set
      is_available = true,
      updated_at = now()
    where id = v_ride.offered_demo_driver_id;

    update public.rides
    set
      status = 'searching',
      offered_demo_driver_id = null,
      offer_expires_at = null,
      offer_attempt_count = coalesce(offer_attempt_count, 0) + 1,
      attempted_demo_driver_ids = v_attempted
    where id = p_ride_id
    returning *
    into v_ride;
  end if;

  if v_ride.search_started_at <= now() - make_interval(secs => p_max_search_seconds) then
    update public.rides
    set
      status = 'no_driver_available',
      offered_demo_driver_id = null,
      offer_expires_at = null,
      attempted_demo_driver_ids = v_attempted
    where id = p_ride_id
    returning *
    into v_ride;

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
    and not exists (
      select 1
      from jsonb_array_elements_text(v_attempted) as attempted(id)
      where attempted.id = public.demo_drivers.id
    )
  order by
    case
      when v_ride.pickup_lat is not null and v_ride.pickup_lng is not null then
        power(public.demo_drivers.lat - v_ride.pickup_lat, 2) +
        power(public.demo_drivers.lng - v_ride.pickup_lng, 2)
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
    offer_expires_at = now() + interval '20 seconds',
    attempted_demo_driver_ids = v_attempted
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

create or replace function public.dispatch_ride_to_nearest_demo_driver(
  p_ride_id uuid,
  p_presence_window_seconds integer default 90
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.advance_demo_ride_offer(p_ride_id, p_presence_window_seconds, 60);
end;
$$;

create or replace function public.sync_demo_ride_offer_state(
  p_ride_id uuid
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.advance_demo_ride_offer(p_ride_id, 90, 60);
end;
$$;

grant execute on function public.advance_demo_ride_offer(uuid, integer, integer) to anon, authenticated;
grant execute on function public.dispatch_ride_to_nearest_demo_driver(uuid, integer) to anon, authenticated;
grant execute on function public.sync_demo_ride_offer_state(uuid) to anon, authenticated;
