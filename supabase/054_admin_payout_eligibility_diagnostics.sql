-- =========================================================
-- TrueGo Payout Eligibility Diagnostics
-- Shows why completed paid rides can or cannot generate driver payout records.
-- Protected by admin session token. Read-only diagnostics.
-- =========================================================

create or replace function public.admin_get_payout_eligibility_summary(
  p_admin_session_token text
)
returns table (
  payout_readiness text,
  total bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  return query
  with checked as (
    select
      case
        when exists (
          select 1 from public.driver_payouts dp where dp.ride_id = r.id
        ) then 'already_has_payout'
        when coalesce(r.payment_status::text, 'unpaid') <> 'completed' then 'payment_not_completed'
        when r.status::text <> 'completed' then 'ride_not_completed'
        when coalesce(r.payment_amount_pi, r.price_pi, 0) <= 0 then 'missing_amount'
        when d.id is null then 'driver_not_matched'
        when d.pi_uid is null or trim(d.pi_uid) = '' then 'driver_missing_pi_uid'
        when d.pi_username is null or trim(d.pi_username) = '' then 'driver_missing_pi_username'
        else 'eligible'
      end as payout_readiness
    from public.rides r
    left join public.demo_drivers d
      on d.id = r.demo_driver_id
      or (
        r.driver_name is not null
        and lower(d.display_name) = lower(r.driver_name)
      )
    where coalesce(r.payment_status::text, 'unpaid') = 'completed'
  )
  select
    checked.payout_readiness,
    count(*) as total
  from checked
  group by checked.payout_readiness
  order by total desc;
end;
$$;

create or replace function public.admin_get_payout_eligibility_rows(
  p_admin_session_token text,
  p_limit integer default 50
)
returns table (
  ride_id uuid,
  ride_status text,
  payment_status text,
  driver_name text,
  demo_driver_id text,
  price_pi numeric,
  payment_amount_pi numeric,
  payment_id text,
  payment_txid text,
  payment_completed_at timestamptz,
  matched_driver_id text,
  matched_driver_name text,
  matched_driver_pi_uid text,
  matched_driver_pi_username text,
  account_status text,
  onboarding_status text,
  payout_readiness text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  return query
  select
    r.id as ride_id,
    r.status::text as ride_status,
    coalesce(r.payment_status::text, 'unpaid') as payment_status,
    r.driver_name,
    r.demo_driver_id,
    r.price_pi::numeric,
    r.payment_amount_pi::numeric,
    r.payment_id,
    r.payment_txid,
    r.payment_completed_at,
    d.id as matched_driver_id,
    d.display_name as matched_driver_name,
    d.pi_uid as matched_driver_pi_uid,
    d.pi_username as matched_driver_pi_username,
    d.account_status,
    d.onboarding_status,
    case
      when exists (
        select 1 from public.driver_payouts dp where dp.ride_id = r.id
      ) then 'already_has_payout'
      when coalesce(r.payment_status::text, 'unpaid') <> 'completed' then 'payment_not_completed'
      when r.status::text <> 'completed' then 'ride_not_completed'
      when coalesce(r.payment_amount_pi, r.price_pi, 0) <= 0 then 'missing_amount'
      when d.id is null then 'driver_not_matched'
      when d.pi_uid is null or trim(d.pi_uid) = '' then 'driver_missing_pi_uid'
      when d.pi_username is null or trim(d.pi_username) = '' then 'driver_missing_pi_username'
      else 'eligible'
    end as payout_readiness
  from public.rides r
  left join public.demo_drivers d
    on d.id = r.demo_driver_id
    or (
      r.driver_name is not null
      and lower(d.display_name) = lower(r.driver_name)
    )
  where coalesce(r.payment_status::text, 'unpaid') = 'completed'
  order by r.payment_completed_at desc nulls last, r.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

grant execute on function public.admin_get_payout_eligibility_summary(text)
to anon, authenticated;

grant execute on function public.admin_get_payout_eligibility_rows(text, integer)
to anon, authenticated;

notify pgrst, 'reload schema';
