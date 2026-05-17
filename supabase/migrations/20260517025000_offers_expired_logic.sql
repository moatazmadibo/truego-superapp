-- 025_offers_expired_logic.sql
-- Split rider offer-window outcomes:
-- 1) no_driver_available: no driver submitted any offer.
-- 2) offers_expired: at least one offer arrived, but rider did not accept one.

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

create or replace function public.expire_ride_driver_offer_window(
  p_ride_id uuid
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_offer_count integer := 0;
  v_next_status text;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status <> 'collecting_offers' then
    return v_ride;
  end if;

  select count(*)
  into v_offer_count
  from public.ride_driver_offers
  where ride_id = p_ride_id;

  update public.ride_driver_offers
  set
    offer_status = 'expired',
    updated_at = now()
  where ride_id = p_ride_id
    and offer_status in ('submitted', 'shown');

  v_next_status := case
    when v_offer_count > 0 then 'offers_expired'
    else 'no_driver_available'
  end;

  update public.rides
  set
    status = v_next_status,
    offered_demo_driver_id = null
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;

create or replace function public.resend_ride_driver_offer_request(
  p_ride_id uuid,
  p_new_price_pi numeric,
  p_offer_window_seconds integer default 120
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if p_new_price_pi is null or p_new_price_pi <= 0 then
    raise exception 'New fare must be greater than zero';
  end if;

  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status in ('driver_assigned', 'driver_arriving', 'in_progress', 'completed') then
    raise exception 'Cannot resend a ride that is already assigned or completed';
  end if;

  update public.ride_driver_offers
  set
    offer_status = 'expired',
    updated_at = now()
  where ride_id = p_ride_id
    and offer_status in ('submitted', 'shown');

  update public.rides
  set
    price_pi = round(p_new_price_pi, 8),
    offered_demo_driver_id = null,
    demo_driver_id = null
  where id = p_ride_id
  returning * into v_ride;

  -- Keep optional payment amount in sync when the column exists.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rides'
      and column_name = 'payment_amount_pi'
  ) then
    execute
      'update public.rides set payment_amount_pi = round($1, 8) where id = $2'
    using p_new_price_pi, p_ride_id;
  end if;

  -- Keep optional driver payout in sync for demo/review flow.
  -- If later we introduce platform commission, this can be changed centrally.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rides'
      and column_name = 'driver_payout_pi'
  ) then
    execute
      'update public.rides set driver_payout_pi = round($1, 8) where id = $2'
    using p_new_price_pi, p_ride_id;
  end if;

  return public.prepare_ride_for_driver_offers(
    p_ride_id,
    p_offer_window_seconds
  );
end;
$$;

grant execute on function public.expire_ride_driver_offer_window(uuid) to anon, authenticated;
grant execute on function public.resend_ride_driver_offer_request(uuid, numeric, integer) to anon, authenticated;

create or replace function public.cancel_ride_request(
  p_ride_id uuid
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status in ('driver_assigned', 'driver_arriving', 'in_progress', 'completed') then
    raise exception 'Cannot cancel this ride at its current stage';
  end if;

  update public.ride_driver_offers
  set
    offer_status = 'expired',
    updated_at = now()
  where ride_id = p_ride_id
    and offer_status in ('submitted', 'shown');

  if v_ride.offered_demo_driver_id is not null then
    update public.demo_drivers
    set is_available = true
    where id = v_ride.offered_demo_driver_id;
  end if;

  update public.rides
  set
    status = 'cancelled',
    offered_demo_driver_id = null,
    demo_driver_id = null,
    offer_expires_at = null
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;

grant execute on function public.cancel_ride_request(uuid) to anon, authenticated;
