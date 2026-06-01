-- =========================================================
-- TrueGo Admin Reports RPC
-- Driver verification, ride operations, payments, and exceptions.
-- Read-only reports. No payment logic is changed.
-- =========================================================

create or replace function public.get_admin_driver_report()
returns table (
  demo_driver_id text,
  display_name text,
  pi_uid text,
  pi_username text,
  email text,
  phone text,
  email_verified boolean,
  phone_verified boolean,
  account_status text,
  onboarding_status text,
  verification_status text,
  submitted_at timestamptz,
  verified_at timestamptz,
  is_online boolean,
  is_available boolean,
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_license_expires_at date,
  driver_license_expires_at date,
  documents_count bigint,
  approved_documents_count bigint,
  pending_documents_count bigint,
  readiness_status text
)
language sql
security definer
set search_path = public
as $$
  select
    d.id as demo_driver_id,
    d.display_name,
    d.pi_uid,
    d.pi_username,
    d.email,
    d.phone,
    d.email_verified_at is not null as email_verified,
    d.phone_verified_at is not null as phone_verified,
    d.account_status,
    d.onboarding_status,
    coalesce(v.verification_status, 'pending') as verification_status,
    v.submitted_at,
    v.verified_at,
    d.is_online,
    d.is_available,
    d.vehicle_type::text,
    d.vehicle_make,
    d.vehicle_model,
    d.vehicle_plate,
    d.vehicle_license_expires_at,
    d.driver_license_expires_at,
    coalesce(doc.documents_count, 0) as documents_count,
    coalesce(doc.approved_documents_count, 0) as approved_documents_count,
    coalesce(doc.pending_documents_count, 0) as pending_documents_count,
    case
      when d.account_status = 'approved'
       and coalesce(v.verification_status, 'pending') = 'approved'
        then 'verified'
      when coalesce(v.verification_status, 'pending') = 'approved'
       and coalesce(d.account_status, 'pending') <> 'approved'
        then 'verification_approved_account_pending'
      when coalesce(v.verification_status, 'pending') in ('submitted', 'needs_more_info')
        then 'needs_review'
      else 'not_verified'
    end as readiness_status
  from public.demo_drivers d
  left join public.demo_driver_verifications v
    on v.demo_driver_id = d.id
  left join (
    select
      demo_driver_id,
      count(*) as documents_count,
      count(*) filter (where status = 'approved') as approved_documents_count,
      count(*) filter (where status = 'pending') as pending_documents_count
    from public.demo_driver_documents
    group by demo_driver_id
  ) doc
    on doc.demo_driver_id = d.id
  order by d.display_name;
$$;

create or replace function public.get_admin_ride_report(
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  ride_id uuid,
  ride_status text,
  payment_status text,
  payout_status text,
  rider_name text,
  driver_name text,
  demo_driver_id text,
  pickup_text text,
  destination_text text,
  vehicle_type text,
  distance_km numeric,
  duration_min numeric,
  price_pi numeric,
  payment_amount_pi numeric,
  driver_payout_pi numeric,
  payment_id text,
  payment_txid text,
  created_at timestamptz,
  completed_at timestamptz,
  payment_completed_at timestamptz,
  report_bucket text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id as ride_id,
    r.status::text as ride_status,
    coalesce(r.payment_status, 'unpaid')::text as payment_status,
    coalesce(dp.payout_status, 'not_generated')::text as payout_status,
    r.rider_name,
    r.driver_name,
    r.demo_driver_id,
    r.pickup_text,
    r.destination_text,
    r.vehicle_type::text,
    r.distance_km::numeric,
    r.duration_min::numeric,
    r.price_pi::numeric,
    r.payment_amount_pi::numeric,
    r.driver_payout_pi::numeric,
    r.payment_id,
    r.payment_txid,
    r.created_at,
    r.completed_at,
    r.payment_completed_at,
    case
      when r.status = 'completed' and coalesce(r.payment_status, 'unpaid') = 'completed'
        then 'completed_paid'
      when r.status = 'completed' and coalesce(r.payment_status, 'unpaid') <> 'completed'
        then 'completed_unpaid'
      when r.status in ('searching', 'collecting_offers', 'offer_sent', 'driver_assigned', 'driver_arriving', 'in_progress')
        then 'active'
      when r.status = 'no_driver_available'
        then 'no_driver_available'
      when r.status = 'offers_expired'
        then 'offers_expired'
      when r.status = 'cancelled'
        then 'cancelled'
      else r.status::text
    end as report_bucket
  from public.rides r
  left join public.driver_payouts dp
    on dp.ride_id = r.id
  where (p_from_date is null or r.created_at::date >= p_from_date)
    and (p_to_date is null or r.created_at::date <= p_to_date)
  order by r.created_at desc
  limit 500;
$$;

grant execute on function public.get_admin_driver_report()
  to anon, authenticated;

grant execute on function public.get_admin_ride_report(date, date)
  to anon, authenticated;
