drop function if exists public.decline_offered_demo_ride(uuid, text);
create function public.decline_offered_demo_ride(
  p_ride_id uuid,
  p_driver_id text
)
returns public.rides
language plpgsql
security definer
as $$
declare
  v_ride public.rides%rowtype;
  v_attempted jsonb;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status <> 'offer_sent' then
    return v_ride;
  end if;

  if v_ride.offered_demo_driver_id is distinct from p_driver_id then
    raise exception 'Ride offer does not belong to this driver';
  end if;

  v_attempted := coalesce(v_ride.attempted_demo_driver_ids, '[]'::jsonb);

  if not exists (
    select 1
    from jsonb_array_elements_text(v_attempted) as attempted(id)
    where attempted.id = p_driver_id
  ) then
    v_attempted := v_attempted || jsonb_build_array(p_driver_id);
  end if;

  update public.demo_drivers
  set
    is_available = true,
    updated_at = now()
  where id = p_driver_id;

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

  return public.advance_demo_ride_offer(p_ride_id, 90, 60);
end;
$$;

grant execute on function public.decline_offered_demo_ride(uuid, text)
to anon, authenticated, service_role;

drop function if exists public.retry_demo_ride_dispatch(uuid);
create function public.retry_demo_ride_dispatch(
  p_ride_id uuid
)
returns public.rides
language plpgsql
security definer
as $$
declare
  v_ride public.rides%rowtype;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status = 'offer_sent' and v_ride.offered_demo_driver_id is not null then
    update public.demo_drivers
    set
      is_available = true,
      updated_at = now()
    where id = v_ride.offered_demo_driver_id;
  end if;

  if v_ride.demo_driver_id is not null then
    update public.demo_drivers
    set
      is_available = true,
      updated_at = now()
    where id = v_ride.demo_driver_id;
  end if;

  update public.rides
  set
    status = 'searching',
    driver_user_id = null,
    driver_name = null,
    demo_driver_id = null,
    offered_demo_driver_id = null,
    offer_expires_at = null,
    accepted_at = null,
    started_at = null,
    completed_at = null,
    search_started_at = now(),
    offer_attempt_count = 0,
    attempted_demo_driver_ids = '[]'::jsonb
  where id = p_ride_id
  returning *
  into v_ride;

  return public.advance_demo_ride_offer(p_ride_id, 90, 60);
end;
$$;

grant execute on function public.retry_demo_ride_dispatch(uuid)
to anon, authenticated, service_role;
