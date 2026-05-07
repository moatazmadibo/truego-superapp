-- =========================================================
-- TrueGo inDrive-style multi-driver offer / bidding flow
-- Phase 1: database + RPC layer
-- =========================================================

-- 1) Extend ride statuses safely
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

-- 2) Driver offers table
create table if not exists public.ride_driver_offers (
  id uuid primary key default gen_random_uuid(),

  ride_id uuid not null references public.rides(id) on delete cascade,
  demo_driver_id text not null references public.demo_drivers(id),

  driver_name text not null,
  driver_rating numeric(3,2) null,
  driver_photo_path text null,

  vehicle_type text null,
  vehicle_make text null,
  vehicle_model text null,
  vehicle_year integer null,
  vehicle_color text null,
  vehicle_plate text null,

  rider_initial_price_pi numeric(18,8) not null default 0,
  offer_price_pi numeric(18,8) not null,

  eta_minutes integer null,
  driver_note text null,

  offer_status text not null default 'submitted',
  shown_at timestamptz null,
  expires_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ride_driver_offers
drop constraint if exists ride_driver_offers_status_check;

alter table public.ride_driver_offers
add constraint ride_driver_offers_status_check
check (
  offer_status in (
    'submitted',
    'shown',
    'accepted',
    'rejected',
    'expired',
    'withdrawn'
  )
);

alter table public.ride_driver_offers
drop constraint if exists ride_driver_offers_offer_price_check;

alter table public.ride_driver_offers
add constraint ride_driver_offers_offer_price_check
check (offer_price_pi > 0);

create unique index if not exists idx_ride_driver_offers_unique_driver
on public.ride_driver_offers(ride_id, demo_driver_id);

create index if not exists idx_ride_driver_offers_ride_status
on public.ride_driver_offers(ride_id, offer_status);

create index if not exists idx_ride_driver_offers_driver
on public.ride_driver_offers(demo_driver_id);

grant select, insert, update on public.ride_driver_offers to anon, authenticated;


-- 3) Put an existing ride into collecting offers mode
create or replace function public.prepare_ride_for_driver_offers(
  p_ride_id uuid,
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
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status in ('completed', 'in_progress', 'driver_arriving', 'driver_assigned') then
    raise exception 'Ride cannot collect offers from current status: %', v_ride.status;
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
    search_started_at = now(),
    offer_attempt_count = coalesce(offer_attempt_count, 0) + 1,
    offered_demo_driver_id = null,
    demo_driver_id = null,
    driver_name = null,
    accepted_at = null
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;


-- 4) Driver submits same price or a higher counter-offer
create or replace function public.submit_demo_driver_ride_offer(
  p_ride_id uuid,
  p_demo_driver_id text,
  p_offer_price_pi numeric,
  p_driver_note text default null,
  p_eta_minutes integer default null
)
returns public.ride_driver_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_driver public.demo_drivers;
  v_offer public.ride_driver_offers;
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
    raise exception 'Ride is not collecting offers';
  end if;

  select *
  into v_driver
  from public.demo_drivers
  where id = p_demo_driver_id;

  if not found then
    raise exception 'Driver not found';
  end if;

  if coalesce(v_driver.is_online, false) = false then
    raise exception 'Driver must be online to submit an offer';
  end if;

  if coalesce(v_driver.is_available, false) = false then
    raise exception 'Driver is not available';
  end if;

  if p_offer_price_pi < v_ride.price_pi then
    raise exception 'Offer price cannot be lower than rider initial fare';
  end if;

  insert into public.ride_driver_offers (
    ride_id,
    demo_driver_id,
    driver_name,
    driver_rating,
    driver_photo_path,
    vehicle_type,
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_color,
    vehicle_plate,
    rider_initial_price_pi,
    offer_price_pi,
    eta_minutes,
    driver_note,
    offer_status,
    expires_at,
    updated_at
  )
  values (
    p_ride_id,
    p_demo_driver_id,
    coalesce(v_driver.display_name, p_demo_driver_id),
    v_driver.rating,
    v_driver.profile_photo_path,
    v_driver.vehicle_type,
    v_driver.vehicle_make,
    v_driver.vehicle_model,
    v_driver.vehicle_year,
    v_driver.vehicle_color,
    v_driver.vehicle_plate,
    v_ride.price_pi,
    p_offer_price_pi,
    p_eta_minutes,
    p_driver_note,
    'submitted',
    now() + interval '45 seconds',
    now()
  )
  on conflict (ride_id, demo_driver_id) do update
    set
      driver_name = excluded.driver_name,
      driver_rating = excluded.driver_rating,
      driver_photo_path = excluded.driver_photo_path,
      vehicle_type = excluded.vehicle_type,
      vehicle_make = excluded.vehicle_make,
      vehicle_model = excluded.vehicle_model,
      vehicle_year = excluded.vehicle_year,
      vehicle_color = excluded.vehicle_color,
      vehicle_plate = excluded.vehicle_plate,
      offer_price_pi = excluded.offer_price_pi,
      eta_minutes = excluded.eta_minutes,
      driver_note = excluded.driver_note,
      offer_status = 'submitted',
      expires_at = excluded.expires_at,
      updated_at = now()
  returning * into v_offer;

  return v_offer;
end;
$$;


-- 5) Rider rejects one incoming offer card
create or replace function public.reject_ride_driver_offer(
  p_offer_id uuid
)
returns public.ride_driver_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.ride_driver_offers;
begin
  update public.ride_driver_offers
  set
    offer_status = 'rejected',
    updated_at = now()
  where id = p_offer_id
    and offer_status in ('submitted', 'shown')
  returning * into v_offer;

  if not found then
    raise exception 'Offer not found or cannot be rejected';
  end if;

  return v_offer;
end;
$$;


-- 6) Rider accepts one offer, assigns selected driver, rejects all others
create or replace function public.accept_ride_driver_offer(
  p_offer_id uuid
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.ride_driver_offers;
  v_ride public.rides;
begin
  select *
  into v_offer
  from public.ride_driver_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.offer_status not in ('submitted', 'shown') then
    raise exception 'Offer cannot be accepted from status: %', v_offer.offer_status;
  end if;

  select *
  into v_ride
  from public.rides
  where id = v_offer.ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status <> 'collecting_offers' then
    raise exception 'Ride is not collecting offers';
  end if;

  update public.ride_driver_offers
  set
    offer_status = case
      when id = p_offer_id then 'accepted'
      else 'rejected'
    end,
    updated_at = now()
  where ride_id = v_offer.ride_id
    and offer_status in ('submitted', 'shown');

  update public.demo_drivers
  set
    is_available = false,
    updated_at = now()
  where id = v_offer.demo_driver_id;

  update public.rides
  set
    status = 'driver_assigned',
    demo_driver_id = v_offer.demo_driver_id,
    offered_demo_driver_id = null,
    driver_name = v_offer.driver_name,
    accepted_at = now(),
    price_pi = v_offer.offer_price_pi,
    driver_payout_pi = round((v_offer.offer_price_pi * 0.85)::numeric, 8),
    pricing_breakdown = coalesce(pricing_breakdown, '{}'::jsonb)
      || jsonb_build_object(
        'pricingMode', 'driver_offer',
        'riderInitialPricePi', v_offer.rider_initial_price_pi,
        'acceptedOfferPricePi', v_offer.offer_price_pi,
        'acceptedDemoDriverId', v_offer.demo_driver_id
      )
  where id = v_offer.ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;


-- 7) Expire offer window if rider does not accept any offer
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

  update public.ride_driver_offers
  set
    offer_status = 'expired',
    updated_at = now()
  where ride_id = p_ride_id
    and offer_status in ('submitted', 'shown');

  update public.rides
  set
    status = 'offers_expired'
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;


grant execute on function public.prepare_ride_for_driver_offers(uuid, integer) to anon, authenticated;
grant execute on function public.submit_demo_driver_ride_offer(uuid, text, numeric, text, integer) to anon, authenticated;
grant execute on function public.reject_ride_driver_offer(uuid) to anon, authenticated;
grant execute on function public.accept_ride_driver_offer(uuid) to anon, authenticated;
grant execute on function public.expire_ride_driver_offer_window(uuid) to anon, authenticated;
