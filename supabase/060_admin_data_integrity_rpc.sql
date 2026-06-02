-- =========================================================
-- TrueGo Admin Data Integrity Checks
-- Protected by admin session token.
-- Read-only diagnostics for hidden operational/data problems.
-- =========================================================

create or replace function public.admin_get_data_integrity_checks(
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
      'paid_without_txid', (
        select count(*)
        from public.rides
        where payment_status::text = 'completed'
          and coalesce(payment_txid, '') = ''
      ),
      'completed_not_paid', (
        select count(*)
        from public.rides
        where status::text = 'completed'
          and coalesce(payment_status::text, 'unpaid') <> 'completed'
      ),
      'approved_drivers_missing_documents', (
        select count(*)
        from public.demo_drivers d
        where d.account_status = 'approved'
          and (
            select count(distinct doc.document_type)
            from public.demo_driver_documents doc
            where doc.demo_driver_id = d.id
              and doc.status = 'approved'
              and doc.document_type in (
                'passport',
                'national_id_front',
                'national_id_back',
                'driving_license',
                'vehicle_license',
                'vehicle_photo',
                'profile_photo'
              )
          ) < 5
      ),
      'payout_paid_without_accounting', (
        select count(*)
        from public.driver_payouts p
        where p.payout_status = 'paid'
          and not exists (
            select 1
            from public.accounting_journal_entries e
            where e.source_type = 'driver_payout'
              and e.source_id = p.id::text
              and e.status = 'posted'
          )
      ),
      'payout_paid_without_reference', (
        select count(*)
        from public.driver_payouts p
        where p.payout_status = 'paid'
          and coalesce(p.payout_txid, p.payout_payment_id, '') = ''
      ),
      'payout_missing_driver_pi_account', (
        select count(*)
        from public.driver_payouts p
        where coalesce(p.driver_pi_uid, '') = ''
           or coalesce(p.driver_pi_username, '') = ''
      )
    ),

    'paid_without_txid', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          r.id,
          r.status,
          r.payment_status,
          r.driver_name,
          coalesce(r.payment_amount_pi, r.price_pi, 0) as amount_pi,
          r.payment_id,
          r.payment_txid,
          r.payment_completed_at,
          r.created_at
        from public.rides r
        where r.payment_status::text = 'completed'
          and coalesce(r.payment_txid, '') = ''
        order by r.payment_completed_at desc nulls last, r.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'completed_not_paid', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          r.id,
          r.status,
          r.payment_status,
          r.driver_name,
          coalesce(r.payment_amount_pi, r.price_pi, 0) as amount_pi,
          r.created_at,
          r.completed_at
        from public.rides r
        where r.status::text = 'completed'
          and coalesce(r.payment_status::text, 'unpaid') <> 'completed'
        order by r.completed_at desc nulls last, r.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'approved_drivers_missing_documents', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select
          d.id,
          d.display_name,
          d.pi_username,
          d.pi_uid,
          d.account_status,
          d.onboarding_status,
          (
            select count(*)
            from public.demo_driver_documents doc
            where doc.demo_driver_id = d.id
          ) as documents_count,
          (
            select count(*)
            from public.demo_driver_documents doc
            where doc.demo_driver_id = d.id
              and doc.status = 'approved'
          ) as approved_documents_count
        from public.demo_drivers d
        where d.account_status = 'approved'
          and (
            select count(distinct doc.document_type)
            from public.demo_driver_documents doc
            where doc.demo_driver_id = d.id
              and doc.status = 'approved'
              and doc.document_type in (
                'passport',
                'national_id_front',
                'national_id_back',
                'driving_license',
                'vehicle_license',
                'vehicle_photo',
                'profile_photo'
              )
          ) < 5
        order by d.display_name
        limit 20
      ) x
    ), '[]'::jsonb),

    'payout_paid_without_accounting', coalesce((
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
          p.payout_payment_id,
          p.processed_at,
          p.created_at
        from public.driver_payouts p
        where p.payout_status = 'paid'
          and not exists (
            select 1
            from public.accounting_journal_entries e
            where e.source_type = 'driver_payout'
              and e.source_id = p.id::text
              and e.status = 'posted'
          )
        order by p.processed_at desc nulls last, p.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'payout_paid_without_reference', coalesce((
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
          p.payout_payment_id,
          p.processed_at,
          p.created_at
        from public.driver_payouts p
        where p.payout_status = 'paid'
          and coalesce(p.payout_txid, p.payout_payment_id, '') = ''
        order by p.processed_at desc nulls last, p.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),

    'payout_missing_driver_pi_account', coalesce((
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
          p.created_at
        from public.driver_payouts p
        where coalesce(p.driver_pi_uid, '') = ''
           or coalesce(p.driver_pi_username, '') = ''
        order by p.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_get_data_integrity_checks(text)
to anon, authenticated;

notify pgrst, 'reload schema';
