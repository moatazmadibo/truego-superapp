-- 028_harden_driver_offer_acceptance.sql
-- Harden inDrive-style offer acceptance against expiry race conditions.
-- Keep lock order consistent: ride first, then offer rows.

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
  v_ride_id uuid;
begin
  -- First read the ride id without locking the offer.
  select ride_id
    into v_ride_id
    from public.ride_driver_offers
   where id = p_offer_id;

  if not found then
    raise exception 'Offer not found';
  end if;

  -- Lock ride first. This matches expire_ride_driver_offer_window lock order.
  select *
    into v_ride
    from public.rides
   where id = v_ride_id
   for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  -- Then lock the offer after the ride lock.
  select *
    into v_offer
    from public.ride_driver_offers
   where id = p_offer_id
   for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  -- Idempotent safety: if the same offer was already accepted, return the ride.
  if v_offer.offer_status = 'accepted' then
    return v_ride;
  end if;

  if v_offer.offer_status not in ('submitted', 'shown') then
    raise exception 'Offer cannot be accepted from status: %', v_offer.offer_status;
  end if;

  if v_ride.status <> 'collecting_offers' then
    raise exception 'Ride is not collecting offers';
  end if;

  update public.ride_driver_offers
     set offer_status = case
           when id = p_offer_id then 'accepted'
           else 'rejected'
         end,
         updated_at = now()
   where ride_id = v_offer.ride_id
     and offer_status in ('submitted', 'shown');

  update public.demo_drivers
     set is_available = false,
         is_online = true,
         last_seen_at = now(),
         updated_at = now()
   where id = v_offer.demo_driver_id;

  update public.rides
     set status = 'driver_assigned',
         demo_driver_id = v_offer.demo_driver_id,
         offered_demo_driver_id = null,
         driver_name = v_offer.driver_name,
         accepted_at = now(),
         offer_expires_at = null,
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
  v_accepted_offer_count integer := 0;
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

  -- Never expire a ride that has already moved forward.
  if v_ride.status <> 'collecting_offers' then
    return v_ride;
  end if;

  select count(*)
    into v_accepted_offer_count
    from public.ride_driver_offers
   where ride_id = p_ride_id
     and offer_status = 'accepted';

  if v_accepted_offer_count > 0 then
    return v_ride;
  end if;

  select count(*)
    into v_offer_count
    from public.ride_driver_offers
   where ride_id = p_ride_id;

  update public.ride_driver_offers
     set offer_status = 'expired',
         updated_at = now()
   where ride_id = p_ride_id
     and offer_status in ('submitted', 'shown');

  v_next_status := case
    when v_offer_count > 0 then 'offers_expired'
    else 'no_driver_available'
  end;

  update public.rides
     set status = v_next_status,
         offered_demo_driver_id = null
   where id = p_ride_id
   returning * into v_ride;

  return v_ride;
end;
$$;

grant execute on function public.accept_ride_driver_offer(uuid) to anon, authenticated;
grant execute on function public.expire_ride_driver_offer_window(uuid) to anon, authenticated;
