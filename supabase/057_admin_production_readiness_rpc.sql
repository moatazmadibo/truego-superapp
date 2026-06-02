-- =========================================================
-- TrueGo Production Readiness Checklist
-- Protected by admin session token.
-- Read-only operational readiness snapshot.
-- =========================================================

create or replace function public.admin_get_production_readiness(
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

    'security', jsonb_build_object(
      'admin_sessions_total', (select count(*) from public.admin_sessions),
      'active_admin_sessions', (
        select count(*) from public.admin_sessions
        where status = 'active' and expires_at > now()
      ),
      'audit_events', (select count(*) from public.admin_audit_logs),
      'protected_admin_actions', (
        select count(*) from public.admin_audit_logs
        where source = 'admin-protected-rpc'
      ),
      'admin_access_events', (
        select count(*) from public.admin_audit_logs
        where action = 'ADMIN_ACCESS_GRANTED'
      )
    ),

    'operations', jsonb_build_object(
      'rides_total', (select count(*) from public.rides),
      'rides_active', (
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
      'rides_completed', (
        select count(*) from public.rides
        where status::text = 'completed'
      ),
      'rides_no_driver_available', (
        select count(*) from public.rides
        where status::text = 'no_driver_available'
      ),
      'rides_offers_expired', (
        select count(*) from public.rides
        where status::text = 'offers_expired'
      )
    ),

    'payments', jsonb_build_object(
      'payments_completed', (
        select count(*) from public.rides
        where payment_status::text = 'completed'
      ),
      'payments_failed', (
        select count(*) from public.rides
        where payment_status::text = 'failed'
      ),
      'payments_cancelled', (
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
      'drivers_total', (select count(*) from public.demo_drivers),
      'drivers_approved', (
        select count(*) from public.demo_drivers
        where account_status = 'approved'
      ),
      'drivers_pi_linked', (
        select count(*) from public.demo_drivers
        where pi_uid is not null and trim(pi_uid) <> ''
      ),
      'drivers_email_verified', (
        select count(*) from public.demo_drivers
        where email_verified_at is not null
      ),
      'drivers_phone_verified', (
        select count(*) from public.demo_drivers
        where phone_verified_at is not null
      )
    ),

    'verification', jsonb_build_object(
      'verification_approved', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'approved'
      ),
      'verification_submitted', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'submitted'
      ),
      'verification_needs_more_info', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'needs_more_info'
      ),
      'verification_rejected', (
        select count(*) from public.demo_driver_verifications
        where verification_status = 'rejected'
      ),
      'driver_documents_total', (
        select count(*) from public.demo_driver_documents
      ),
      'driver_documents_approved', (
        select count(*) from public.demo_driver_documents
        where status = 'approved'
      )
    ),

    'finance', jsonb_build_object(
      'finance_settings_exists', exists (
        select 1 from public.platform_finance_settings limit 1
      ),
      'pi_usd_rate', coalesce((
        select pi_usd_rate
        from public.platform_finance_settings
        order by updated_at desc nulls last
        limit 1
      ), 0),
      'payout_settings_exists', exists (
        select 1 from public.platform_payout_settings limit 1
      ),
      'commission_percent', coalesce((
        select commission_percent
        from public.platform_payout_settings
        order by updated_at desc nulls last
        limit 1
      ), 0),
      'journal_entries', (
        select count(*) from public.accounting_journal_entries
      ),
      'posted_journal_entries', (
        select count(*) from public.accounting_journal_entries
        where status = 'posted'
      ),
      'business_expenses', (
        select count(*) from public.business_expenses
      )
    ),

    'payouts', jsonb_build_object(
      'payout_records', (select count(*) from public.driver_payouts),
      'payout_pending', (
        select count(*) from public.driver_payouts
        where payout_status = 'pending'
      ),
      'payout_processing', (
        select count(*) from public.driver_payouts
        where payout_status = 'processing'
      ),
      'payout_paid', (
        select count(*) from public.driver_payouts
        where payout_status = 'paid'
      ),
      'payout_failed', (
        select count(*) from public.driver_payouts
        where payout_status = 'failed'
      )
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_get_production_readiness(text)
to anon, authenticated;

notify pgrst, 'reload schema';
