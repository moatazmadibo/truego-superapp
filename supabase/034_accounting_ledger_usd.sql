-- =========================================================
-- TrueGo Accounting Ledger + USD Secondary Currency
-- Phase: Internal accounting foundation only.
-- This does NOT change rider payment logic and does NOT send Pi.
-- =========================================================

create table if not exists public.platform_finance_settings (
  id text primary key default 'truego',
  accounting_currency text not null default 'USD'
    check (accounting_currency = 'USD'),
  pi_usd_rate numeric(20,8) not null default 0,
  rate_source text not null default 'manual',
  updated_by text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint platform_finance_settings_singleton check (id = 'truego'),
  constraint platform_finance_settings_rate_non_negative check (pi_usd_rate >= 0)
);

insert into public.platform_finance_settings (
  id,
  accounting_currency,
  pi_usd_rate,
  rate_source
)
values (
  'truego',
  'USD',
  0,
  'manual'
)
on conflict (id) do nothing;

create table if not exists public.accounting_accounts (
  code text primary key,
  name text not null,
  account_type text not null
    check (account_type in ('asset', 'liability', 'revenue', 'expense', 'equity')),
  normal_balance text not null
    check (normal_balance in ('debit', 'credit')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.accounting_accounts (code, name, account_type, normal_balance)
values
  ('1000', 'Pi App Wallet', 'asset', 'debit'),
  ('1010', 'USD Cash / Bank', 'asset', 'debit'),
  ('1020', 'Payment Receivables', 'asset', 'debit'),
  ('2000', 'Driver Payables', 'liability', 'credit'),
  ('2010', 'Refund Payables', 'liability', 'credit'),
  ('2020', 'Tax Payables', 'liability', 'credit'),
  ('3000', 'Owner Equity', 'equity', 'credit'),
  ('4000', 'Platform Commission Revenue', 'revenue', 'credit'),
  ('4010', 'Subscription Revenue', 'revenue', 'credit'),
  ('4020', 'Promotion / Ads Revenue', 'revenue', 'credit'),
  ('5000', 'Operations Expenses', 'expense', 'debit'),
  ('5010', 'Hosting / Infrastructure', 'expense', 'debit'),
  ('5020', 'OTP / Messaging / Communications', 'expense', 'debit'),
  ('5030', 'Marketing Expenses', 'expense', 'debit'),
  ('5040', 'Payment / Blockchain Fees', 'expense', 'debit'),
  ('5050', 'Support / Admin Costs', 'expense', 'debit'),
  ('5990', 'Other Expenses', 'expense', 'debit')
on conflict (code) do update
set
  name = excluded.name,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  is_active = true;

create table if not exists public.accounting_journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date timestamptz not null default now(),
  source_type text not null
    check (source_type in ('ride_payment', 'driver_payout', 'expense', 'refund', 'adjustment')),
  source_id text not null,
  description text not null,
  status text not null default 'posted'
    check (status in ('draft', 'posted', 'reversed')),
  accounting_currency text not null default 'USD'
    check (accounting_currency = 'USD'),
  pi_usd_rate_snapshot numeric(20,8) not null default 0,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id)
);

create table if not exists public.accounting_journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.accounting_journal_entries(id) on delete cascade,
  account_code text not null references public.accounting_accounts(code),
  line_description text null,
  debit_pi numeric(20,8) not null default 0,
  credit_pi numeric(20,8) not null default 0,
  debit_usd numeric(20,8) not null default 0,
  credit_usd numeric(20,8) not null default 0,
  created_at timestamptz not null default now(),
  constraint accounting_journal_lines_non_negative
    check (
      debit_pi >= 0 and credit_pi >= 0 and
      debit_usd >= 0 and credit_usd >= 0
    ),
  constraint accounting_journal_lines_one_side
    check (
      (debit_pi > 0 or debit_usd > 0) <> (credit_pi > 0 or credit_usd > 0)
    )
);

create index if not exists accounting_journal_entries_source_idx
  on public.accounting_journal_entries (source_type, source_id);

create index if not exists accounting_journal_entries_date_idx
  on public.accounting_journal_entries (entry_date desc);

create index if not exists accounting_journal_lines_account_idx
  on public.accounting_journal_lines (account_code);

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  expense_account_code text not null default '5000'
    references public.accounting_accounts(code),
  category text null,
  vendor text null,
  description text not null,
  amount numeric(20,8) not null,
  currency text not null default 'USD'
    check (currency in ('USD', 'PI')),
  pi_amount numeric(20,8) not null default 0,
  usd_amount numeric(20,8) not null default 0,
  pi_usd_rate_snapshot numeric(20,8) not null default 0,
  payment_method text null,
  receipt_file_path text null,
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'cancelled')),
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_expenses_amount_positive check (amount > 0)
);

create index if not exists business_expenses_date_idx
  on public.business_expenses (expense_date desc);

create or replace function public.get_platform_finance_settings()
returns public.platform_finance_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_finance_settings;
begin
  select *
  into v_settings
  from public.platform_finance_settings
  where id = 'truego';

  if not found then
    insert into public.platform_finance_settings (id)
    values ('truego')
    returning * into v_settings;
  end if;

  return v_settings;
end;
$$;

create or replace function public.update_platform_finance_settings(
  p_pi_usd_rate numeric,
  p_updated_by text default null
)
returns public.platform_finance_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_finance_settings;
begin
  if p_pi_usd_rate is null or p_pi_usd_rate < 0 then
    raise exception 'Pi to USD rate must be zero or greater';
  end if;

  insert into public.platform_finance_settings (
    id,
    accounting_currency,
    pi_usd_rate,
    rate_source,
    updated_by,
    updated_at
  )
  values (
    'truego',
    'USD',
    p_pi_usd_rate,
    'manual',
    p_updated_by,
    now()
  )
  on conflict (id) do update
  set
    accounting_currency = 'USD',
    pi_usd_rate = excluded.pi_usd_rate,
    rate_source = 'manual',
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_settings;

  return v_settings;
end;
$$;

create or replace function public.post_ride_payment_accounting(
  p_ride_id uuid
)
returns public.accounting_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_finance_settings;
  v_payout public.driver_payouts;
  v_existing public.accounting_journal_entries;
  v_entry public.accounting_journal_entries;
  v_rate numeric(20,8);
begin
  select *
  into v_settings
  from public.get_platform_finance_settings();

  v_rate := coalesce(v_settings.pi_usd_rate, 0);

  select *
  into v_existing
  from public.accounting_journal_entries
  where source_type = 'ride_payment'
    and source_id = p_ride_id::text;

  if found then
    return v_existing;
  end if;

  select *
  into v_payout
  from public.upsert_driver_payout_for_completed_ride(p_ride_id, null);

  insert into public.accounting_journal_entries (
    entry_date,
    source_type,
    source_id,
    description,
    status,
    accounting_currency,
    pi_usd_rate_snapshot,
    created_by
  )
  values (
    coalesce(v_payout.source_payment_completed_at, now()),
    'ride_payment',
    p_ride_id::text,
    'Ride payment received and split into TrueGo commission and driver payable',
    'posted',
    'USD',
    v_rate,
    'system'
  )
  returning * into v_entry;

  insert into public.accounting_journal_lines (
    journal_entry_id,
    account_code,
    line_description,
    debit_pi,
    debit_usd
  )
  values (
    v_entry.id,
    '1000',
    'Pi received in app wallet from rider',
    v_payout.gross_amount_pi,
    round((v_payout.gross_amount_pi * v_rate)::numeric, 8)
  );

  insert into public.accounting_journal_lines (
    journal_entry_id,
    account_code,
    line_description,
    credit_pi,
    credit_usd
  )
  values (
    v_entry.id,
    '4000',
    'TrueGo platform commission revenue',
    v_payout.app_commission_pi,
    round((v_payout.app_commission_pi * v_rate)::numeric, 8)
  );

  insert into public.accounting_journal_lines (
    journal_entry_id,
    account_code,
    line_description,
    credit_pi,
    credit_usd
  )
  values (
    v_entry.id,
    '2000',
    'Driver payable from completed ride',
    v_payout.driver_payout_pi,
    round((v_payout.driver_payout_pi * v_rate)::numeric, 8)
  );

  return v_entry;
end;
$$;

create or replace function public.post_driver_payout_accounting(
  p_payout_id uuid
)
returns public.accounting_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_finance_settings;
  v_payout public.driver_payouts;
  v_existing public.accounting_journal_entries;
  v_entry public.accounting_journal_entries;
  v_rate numeric(20,8);
begin
  select *
  into v_settings
  from public.get_platform_finance_settings();

  v_rate := coalesce(v_settings.pi_usd_rate, 0);

  select *
  into v_payout
  from public.driver_payouts
  where id = p_payout_id;

  if not found then
    raise exception 'Driver payout not found';
  end if;

  if v_payout.payout_status <> 'paid' then
    raise exception 'Driver payout accounting can only be posted after payout is paid';
  end if;

  select *
  into v_existing
  from public.accounting_journal_entries
  where source_type = 'driver_payout'
    and source_id = p_payout_id::text;

  if found then
    return v_existing;
  end if;

  insert into public.accounting_journal_entries (
    entry_date,
    source_type,
    source_id,
    description,
    status,
    accounting_currency,
    pi_usd_rate_snapshot,
    created_by
  )
  values (
    coalesce(v_payout.processed_at, now()),
    'driver_payout',
    p_payout_id::text,
    'Driver payable settled from Pi app wallet',
    'posted',
    'USD',
    v_rate,
    'system'
  )
  returning * into v_entry;

  insert into public.accounting_journal_lines (
    journal_entry_id,
    account_code,
    line_description,
    debit_pi,
    debit_usd
  )
  values (
    v_entry.id,
    '2000',
    'Reduce driver payable',
    v_payout.driver_payout_pi,
    round((v_payout.driver_payout_pi * v_rate)::numeric, 8)
  );

  insert into public.accounting_journal_lines (
    journal_entry_id,
    account_code,
    line_description,
    credit_pi,
    credit_usd
  )
  values (
    v_entry.id,
    '1000',
    'Pi paid out from app wallet to driver',
    v_payout.driver_payout_pi,
    round((v_payout.driver_payout_pi * v_rate)::numeric, 8)
  );

  return v_entry;
end;
$$;

create or replace function public.create_business_expense(
  p_description text,
  p_amount numeric,
  p_currency text default 'USD',
  p_expense_account_code text default '5000',
  p_category text default null,
  p_vendor text default null,
  p_payment_method text default null,
  p_receipt_file_path text default null,
  p_created_by text default null
)
returns public.business_expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_finance_settings;
  v_rate numeric(20,8);
  v_pi_amount numeric(20,8);
  v_usd_amount numeric(20,8);
  v_expense public.business_expenses;
begin
  if p_description is null or trim(p_description) = '' then
    raise exception 'Expense description is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if p_currency not in ('USD', 'PI') then
    raise exception 'Expense currency must be USD or PI';
  end if;

  perform 1
  from public.accounting_accounts
  where code = p_expense_account_code
    and account_type = 'expense'
    and is_active = true;

  if not found then
    raise exception 'Invalid expense account code';
  end if;

  select *
  into v_settings
  from public.get_platform_finance_settings();

  v_rate := coalesce(v_settings.pi_usd_rate, 0);

  if p_currency = 'USD' then
    v_usd_amount := round(p_amount::numeric, 8);
    v_pi_amount := case when v_rate > 0 then round((p_amount / v_rate)::numeric, 8) else 0 end;
  else
    v_pi_amount := round(p_amount::numeric, 8);
    v_usd_amount := round((p_amount * v_rate)::numeric, 8);
  end if;

  insert into public.business_expenses (
    expense_account_code,
    category,
    vendor,
    description,
    amount,
    currency,
    pi_amount,
    usd_amount,
    pi_usd_rate_snapshot,
    payment_method,
    receipt_file_path,
    status,
    created_by,
    updated_at
  )
  values (
    p_expense_account_code,
    p_category,
    p_vendor,
    trim(p_description),
    p_amount,
    p_currency,
    v_pi_amount,
    v_usd_amount,
    v_rate,
    p_payment_method,
    p_receipt_file_path,
    'draft',
    p_created_by,
    now()
  )
  returning * into v_expense;

  return v_expense;
end;
$$;

grant select, insert, update on public.platform_finance_settings to anon, authenticated;
grant select, insert, update on public.accounting_accounts to anon, authenticated;
grant select, insert, update on public.accounting_journal_entries to anon, authenticated;
grant select, insert, update on public.accounting_journal_lines to anon, authenticated;
grant select, insert, update on public.business_expenses to anon, authenticated;

grant execute on function public.get_platform_finance_settings() to anon, authenticated;
grant execute on function public.update_platform_finance_settings(numeric, text) to anon, authenticated;
grant execute on function public.post_ride_payment_accounting(uuid) to anon, authenticated;
grant execute on function public.post_driver_payout_accounting(uuid) to anon, authenticated;
grant execute on function public.create_business_expense(text, numeric, text, text, text, text, text, text, text) to anon, authenticated;
