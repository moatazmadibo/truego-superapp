-- =========================================================
-- TrueGo Admin Action Center
-- Protected by admin session token.
-- Read-only operational action queue.
-- =========================================================

create or replace function public.admin_get_action_center(
  p_admin_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result jsonb;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  select jsonb_build_object(
    'generated_at', now(),
    'admin_session_id', v_session_id,

    'summary', jsonb_build_object(
      'driver_reviews', (
        select count(*)
        from public.demo_driver_verifications
        where verification_status in ('submitted', 'needs_more_info')
      ),
      'ride_exceptions', (
        select count(*)
        from public.rides
        where status::text in ('no_driver_available', 'offers_expired', 'cancelled')
      ),
      'payment_exceptions', (
        select count(*)
        from public.rides
        where payment_status::text in ('failed', 'cancelled')
           or (status::text = 'completed' and coalesce(payment_status::text, 'unpaid') <> 'completed')
      ),
      'payout_actions', (
        select count(*)
        from public.driver_payouts
        where payout_status in ('pending', 'processing', 'failed')
      )
    ),

    'driver_reviews', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          v.demo_driver_id,
          v.driver_name,
          v.verification_status,
          v.submitted_at,
          v.updated_at,
          d.pi_username,
          d.pi_uid,
          d.email_verified_at is not null as email_verified,
          d.phone_verified_at is not null as phone_verified,
          d.account_status,
          d.onboarding_status
        from public.demo_driver_verifications v
        left join public.demo_drivers d on d.id = v.demo_driver_id
        where v.verification_status in ('submitted', 'needs_more_info')
        order by v.updated_at desc nulls last, v.submitted_at desc nulls last
        limit 20
      ) x
    ), '[]'::jsonb),

    'ride_exceptions', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          r.id,
          r.status,
          r.payment_status,
          r.driver_name,
          r.pickup_text,
          r.destination_text,
          coalesce(r.payment_amount_pi, r.price_pi, 0) as amount_pi,
          r.created_at,
          r.completed_at,
          r.payment_completed_at
        from public.rides r
        where r.status::text in ('no_driver_available', 'offers_expired', 'cancelled')
        order by r.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'payment_exceptions', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          r.id,
          r.status,
          r.payment_status,
          r.driver_name,
          r.payment_id,
          r.payment_txid,
          coalesce(r.payment_amount_pi, r.price_pi, 0) as amount_pi,
          r.created_at,
          r.completed_at,
          r.payment_completed_at
        from public.rides r
        where r.payment_status::text in ('failed', 'cancelled')
           or (r.status::text = 'completed' and coalesce(r.payment_status::text, 'unpaid') <> 'completed')
        order by r.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'payout_actions', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          p.id,
          p.ride_id,
          p.driver_name,
          p.driver_pi_username,
          p.driver_pi_uid,
          p.driver_payout_pi,
          p.payout_status,
          p.payout_txid,
          p.payout_error,
          p.created_at,
          p.requested_at,
          p.processed_at
        from public.driver_payouts p
        where p.payout_status in ('pending', 'processing', 'failed')
        order by p.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_get_action_center(text)
to anon, authenticated;

notify pgrst, 'reload schema';
