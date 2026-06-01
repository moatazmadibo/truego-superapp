-- =========================================================
-- TrueGo Accounting Accounts Seed + Read RPC
-- Fixes empty Chart of Accounts in Admin.
-- =========================================================

insert into public.accounting_accounts (code, name, account_type, normal_balance, is_active)
values
  ('1000', 'Pi App Wallet', 'asset', 'debit', true),
  ('1010', 'USD Cash / Bank', 'asset', 'debit', true),
  ('1020', 'Payment Receivables', 'asset', 'debit', true),
  ('2000', 'Driver Payables', 'liability', 'credit', true),
  ('2010', 'Refund Payables', 'liability', 'credit', true),
  ('2020', 'Tax Payables', 'liability', 'credit', true),
  ('3000', 'Owner Equity', 'equity', 'credit', true),
  ('4000', 'Platform Commission Revenue', 'revenue', 'credit', true),
  ('4010', 'Subscription Revenue', 'revenue', 'credit', true),
  ('4020', 'Promotion / Ads Revenue', 'revenue', 'credit', true),
  ('5000', 'Operations Expenses', 'expense', 'debit', true),
  ('5010', 'Hosting / Infrastructure', 'expense', 'debit', true),
  ('5020', 'OTP / Messaging / Communications', 'expense', 'debit', true),
  ('5030', 'Marketing Expenses', 'expense', 'debit', true),
  ('5040', 'Payment / Blockchain Fees', 'expense', 'debit', true),
  ('5050', 'Support / Admin Costs', 'expense', 'debit', true),
  ('5990', 'Other Expenses', 'expense', 'debit', true)
on conflict (code) do update
set
  name = excluded.name,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  is_active = true;

create or replace function public.get_accounting_accounts()
returns setof public.accounting_accounts
language sql
security definer
set search_path = public
as $$
  select *
  from public.accounting_accounts
  where is_active = true
  order by code;
$$;

grant execute on function public.get_accounting_accounts()
  to anon, authenticated;

grant select on public.accounting_accounts
  to anon, authenticated;
