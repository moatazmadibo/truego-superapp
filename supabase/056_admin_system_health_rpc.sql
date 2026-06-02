-- =========================================================
-- TrueGo Admin System Health / Readiness
-- Protected by admin session token.
-- Read-only operational health snapshot.
-- =========================================================

create or replace function public.admin_get_system_health(
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
    'session', jsonb_build_object(
      'admin_session_id', v_session_id,
      'checked_at', now()
    ),

    'rides', jsonb_build_object(
      'total', (select count(*) from public.rides),
      'active', (
        select count(*) from public.rides
        where status::text in (
          'searching',
          'collecting_offers',
          'offer_sent',
          'driver_assigned',
          'driver_arriving',
          'in_progress'
        )
      ),
      'completed', (
        select count(*) from public.rides
        where status::text = 'completed'
      ),
      'cancelled', (
        select count(*) from public.rides
        where status::text = 'cancelled'
      ),
      'no_driver_available', (
        select count(*) from public.rides
        where status::text = 'no_driver_available'
      ),
      'offers_expired', (
        select count(*) from public.rides
        where status::text = 'offers_expired'
      )
    ),

    'payments', jsonb_build_object(
      'completed', (
        select count(*) from public.rides
        where payment_status::text = 'completed'
      ),
      'failed', (
        select count(*) from public.rides
        where payment_status::text = 'failed'
      ),
      'cancelled', (
        select count(*) from public.rides
        where payment_status::text = 'cancelled'
      ),
      'collected_pi', (
        select coalesce(sum(coalesce(payment_amount_pi, price_pi, 0)), 0)
        from public.rides
        where payment_status::text = 'completed'
      )
    ),

    'drivers', jsonb_build_object(
      'total', (select count(*) from public.demo_drivers),
      'approved', (
        select count(*) from public.demo_drivers
        where account_status = 'approved'
      ),
      'pending', (
        select count(*) from public.demo_drivers
        where coalesce(account_status, 'pending') <> 'approved'
      ),
      'pi_linked', (
        select count(*) from public.demo_drivers
        where pi_uid is not null and trim(pi_uid) <> ''
      ),
      'email_verified', (
        select count(*) from public.demo_drivers
        where email_verified_at is not null
      )
    ),

    'driver_verification', jsonb_build_object(
      'approved', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'approved'
      ),
      'submitted', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'submitted'
      ),
      'needs_more_info', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'needs_more_info'
      ),
      'rejected', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'rejected'
      )
    ),

    'payouts', jsonb_build_object(
      'total', (select count(*) from public.driver_payouts),
      'pending', (
        select count(*) from public.driver_payouts
        where payout_status = 'pending'
      ),
      'processing', (
        select count(*) from public.driver_payouts
        where payout_status = 'processing'
      ),
      'paid', (
        select count(*) from public.driver_payouts
        where payout_status = 'paid'
      ),
      'failed', (
        select count(*) from public.driver_payouts
        where payout_status = 'failed'
      ),
      'payable_pi', (
        select coalesce(sum(driver_payout_pi), 0)
        from public.driver_payouts
        where payout_status in ('pending', 'processing')
      ),
      'paid_pi', (
        select coalesce(sum(driver_payout_pi), 0)
        from public.driver_payouts
        where payout_status = 'paid'
      )
    ),

    'accounting', jsonb_build_object(
      'journal_entries', (
        select count(*) from public.accounting_journal_entries
      ),
      'posted_entries', (
        select count(*) from public.accounting_journal_entries
        where status = 'posted'
      ),
      'business_expenses', (
        select count(*) from public.business_expenses
      )
    ),

    'audit', jsonb_build_object(
      'events', (
        select count(*) from public.admin_audit_logs
      ),
      'admin_access_granted', (
        select count(*) from public.admin_audit_logs
        where action = 'ADMIN_ACCESS_GRANTED'
      ),
      'protected_actions', (
        select count(*) from public.admin_audit_logs
        where source = 'admin-protected-rpc'
      )
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_get_system_health(text)
to anon, authenticated;

notify pgrst, 'reload schema';
