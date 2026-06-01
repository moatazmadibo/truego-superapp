-- =========================================================
-- TrueGo Driver Payout Accounting Posting
-- Creates accounting entry when a manual driver payout is marked as paid.
-- Debit  2000 Driver Payables
-- Credit 1000 Pi App Wallet
-- Protected by admin session token.
-- Does NOT send Pi automatically.
-- =========================================================

create or replace function public.admin_post_driver_payout_accounting(
  p_admin_session_token text,
  p_payout_id uuid
)
returns public.accounting_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_payout public.driver_payouts;
  v_finance_settings public.platform_finance_settings;
  v_pi_usd_rate numeric;
  v_entry public.accounting_journal_entries;
  v_usd_amount numeric;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  select *
  into v_payout
  from public.driver_payouts
  where id = p_payout_id;

  if not found then
    raise exception 'Driver payout record not found';
  end if;

  if v_payout.payout_status <> 'paid' then
    raise exception 'Only paid payout records can be posted to accounting';
  end if;

  if coalesce(v_payout.driver_payout_pi, 0) <= 0 then
    raise exception 'Driver payout amount must be greater than zero';
  end if;

  if exists (
    select 1
    from public.accounting_journal_entries e
    where e.source_type = 'driver_payout'
      and e.source_id = p_payout_id::text
      and e.status = 'posted'
  ) then
    raise exception 'Driver payout accounting entry already exists';
  end if;

  select *
  into v_finance_settings
  from public.platform_finance_settings
  order by updated_at desc nulls last
  limit 1;

  v_pi_usd_rate := coalesce(v_finance_settings.pi_usd_rate, 314159);
  v_usd_amount := round(v_payout.driver_payout_pi * v_pi_usd_rate, 6);

  insert into public.accounting_journal_entries (
    entry_date,
    source_type,
    source_id,
    description,
    status,
    pi_usd_rate_snapshot,
    created_by
  )
  values (
    coalesce(v_payout.processed_at, now()),
    'driver_payout',
    p_payout_id::text,
    'Driver payout paid: ' || coalesce(v_payout.driver_name, 'Unknown driver'),
    'posted',
    v_pi_usd_rate,
    'admin-session:' || v_session_id::text
  )
  returning * into v_entry;

  insert into public.accounting_journal_lines (
    journal_entry_id,
    account_code,
    line_description,
    debit_pi,
    credit_pi,
    debit_usd,
    credit_usd
  )
  values
  (
    v_entry.id,
    '2000',
    'Driver payable settled: ' || coalesce(v_payout.driver_name, 'Unknown driver'),
    v_payout.driver_payout_pi,
    0,
    v_usd_amount,
    0
  ),
  (
    v_entry.id,
    '1000',
    'Paid from Pi App Wallet',
    0,
    v_payout.driver_payout_pi,
    0,
    v_usd_amount
  );

  insert into public.admin_audit_logs (
    source,
    actor,
    action,
    table_name,
    record_id,
    summary,
    new_data
  )
  values (
    'admin-protected-rpc',
    'admin-session:' || v_session_id::text,
    'ADMIN_POST_DRIVER_PAYOUT_ACCOUNTING',
    'accounting_journal_entries',
    v_entry.id::text,
    'Admin posted driver payout accounting entry.',
    jsonb_build_object(
      'payout_id', p_payout_id,
      'journal_entry_id', v_entry.id,
      'driver_name', v_payout.driver_name,
      'driver_payout_pi', v_payout.driver_payout_pi,
      'pi_usd_rate', v_pi_usd_rate,
      'usd_amount', v_usd_amount
    )
  );

  return v_entry;
end;
$$;

grant execute on function public.admin_post_driver_payout_accounting(text, uuid)
to anon, authenticated;

notify pgrst, 'reload schema';
