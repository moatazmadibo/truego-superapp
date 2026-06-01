-- =========================================================
-- TrueGo Business Expense Accounting Posting
-- Posts draft business expenses into the accounting ledger.
-- This does NOT change rider payment logic and does NOT send Pi.
-- =========================================================

create or replace function public.post_business_expense_accounting(
  p_expense_id uuid
)
returns public.accounting_journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.business_expenses;
  v_existing public.accounting_journal_entries;
  v_entry public.accounting_journal_entries;
  v_credit_account text;
begin
  select *
  into v_expense
  from public.business_expenses
  where id = p_expense_id;

  if not found then
    raise exception 'Business expense not found';
  end if;

  if v_expense.status = 'cancelled' then
    raise exception 'Cancelled expenses cannot be posted';
  end if;

  select *
  into v_existing
  from public.accounting_journal_entries
  where source_type = 'expense'
    and source_id = p_expense_id::text;

  if found then
    update public.business_expenses
       set status = 'posted',
           updated_at = now()
     where id = p_expense_id
       and status <> 'posted';

    return v_existing;
  end if;

  v_credit_account := case
    when v_expense.currency = 'PI' then '1000'
    else '1010'
  end;

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
    v_expense.expense_date::timestamptz,
    'expense',
    p_expense_id::text,
    'Business expense posted: ' || v_expense.description,
    'posted',
    'USD',
    v_expense.pi_usd_rate_snapshot,
    coalesce(v_expense.created_by, 'admin-dashboard')
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
    v_expense.expense_account_code,
    v_expense.description,
    v_expense.pi_amount,
    v_expense.usd_amount
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
    v_credit_account,
    case
      when v_expense.currency = 'PI'
        then 'Paid from Pi app wallet'
      else 'Paid from USD cash / bank'
    end,
    v_expense.pi_amount,
    v_expense.usd_amount
  );

  update public.business_expenses
     set status = 'posted',
         updated_at = now()
   where id = p_expense_id;

  return v_entry;
end;
$$;

grant execute on function public.post_business_expense_accounting(uuid)
  to anon, authenticated;
