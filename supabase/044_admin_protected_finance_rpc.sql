-- =========================================================
-- TrueGo Admin Protected Finance/Payout RPC
-- Requires server-issued admin session token for sensitive admin actions.
-- Does not remove old RPCs yet, so rollout is safe.
-- =========================================================

create extension if not exists pgcrypto;

create or replace function public.assert_valid_admin_session(
  p_admin_session_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_session public.admin_sessions;
begin
  if p_admin_session_token is null or trim(p_admin_session_token) = '' then
    raise exception 'Admin session token is required';
  end if;

  v_hash := encode(digest(p_admin_session_token, 'sha256'), 'hex');

  select *
  into v_session
  from public.admin_sessions
  where session_token_hash = v_hash
    and status = 'active'
    and expires_at > now();

  if not found then
    raise exception 'Invalid or expired admin session';
  end if;

  update public.admin_sessions
     set last_seen_at = now()
   where id = v_session.id;

  return v_session.id;
end;
$$;

create or replace function public.admin_update_platform_payout_settings(
  p_admin_session_token text,
  p_commission_percent numeric,
  p_payout_mode text default 'manual',
  p_min_payout_pi numeric default 0
)
returns public.platform_payout_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.platform_payout_settings;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.update_platform_payout_settings(
    p_commission_percent,
    p_payout_mode,
    p_min_payout_pi,
    'admin-session:' || v_session_id::text
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
    'ADMIN_UPDATE_PAYOUT_SETTINGS',
    'platform_payout_settings',
    'truego',
    'Admin updated payout commission settings using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

create or replace function public.admin_update_platform_finance_settings(
  p_admin_session_token text,
  p_pi_usd_rate numeric
)
returns public.platform_finance_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.platform_finance_settings;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.update_platform_finance_settings(
    p_pi_usd_rate,
    'admin-session:' || v_session_id::text
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
    'ADMIN_UPDATE_FINANCE_SETTINGS',
    'platform_finance_settings',
    'truego',
    'Admin updated finance/GCV settings using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

create or replace function public.admin_create_business_expense(
  p_admin_session_token text,
  p_description text,
  p_amount numeric,
  p_currency text default 'USD',
  p_expense_account_code text default '5000',
  p_category text default null,
  p_vendor text default null,
  p_payment_method text default null,
  p_receipt_file_path text default null
)
returns public.business_expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.business_expenses;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.create_business_expense(
    p_description,
    p_amount,
    p_currency,
    p_expense_account_code,
    p_category,
    p_vendor,
    p_payment_method,
    p_receipt_file_path,
    'admin-session:' || v_session_id::text
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
    'ADMIN_CREATE_BUSINESS_EXPENSE',
    'business_expenses',
    v_result.id::text,
    'Admin created business expense using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

create or replace function public.admin_post_business_expense_accounting(
  p_admin_session_token text,
  p_expense_id uuid
)
returns public.accounting_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.accounting_journal_entries;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.post_business_expense_accounting(p_expense_id);

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
    'ADMIN_POST_BUSINESS_EXPENSE',
    'business_expenses',
    p_expense_id::text,
    'Admin posted business expense accounting using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

create or replace function public.admin_upsert_driver_payout_for_completed_ride(
  p_admin_session_token text,
  p_ride_id uuid,
  p_commission_percent numeric default null
)
returns public.driver_payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.driver_payouts;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.upsert_driver_payout_for_completed_ride(
    p_ride_id,
    p_commission_percent
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
    'ADMIN_GENERATE_DRIVER_PAYOUT',
    'driver_payouts',
    v_result.id::text,
    'Admin generated driver payout record using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

create or replace function public.admin_post_ride_payment_accounting(
  p_admin_session_token text,
  p_ride_id uuid
)
returns public.accounting_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.accounting_journal_entries;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.post_ride_payment_accounting(p_ride_id);

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
    'ADMIN_POST_RIDE_PAYMENT_ACCOUNTING',
    'accounting_journal_entries',
    v_result.id::text,
    'Admin posted ride payment accounting using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

grant execute on function public.assert_valid_admin_session(text) to anon, authenticated;
grant execute on function public.admin_update_platform_payout_settings(text, numeric, text, numeric) to anon, authenticated;
grant execute on function public.admin_update_platform_finance_settings(text, numeric) to anon, authenticated;
grant execute on function public.admin_create_business_expense(text, text, numeric, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_post_business_expense_accounting(text, uuid) to anon, authenticated;
grant execute on function public.admin_upsert_driver_payout_for_completed_ride(text, uuid, numeric) to anon, authenticated;
grant execute on function public.admin_post_ride_payment_accounting(text, uuid) to anon, authenticated;
