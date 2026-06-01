-- =========================================================
-- TrueGo Printable Account Statement RPC
-- Returns debit/credit lines with running balance for one account.
-- =========================================================

create or replace function public.get_account_statement(
  p_account_code text,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  entry_date timestamptz,
  journal_entry_id uuid,
  source_type text,
  source_id text,
  journal_description text,
  account_code text,
  account_name text,
  normal_balance text,
  line_description text,
  debit_pi numeric,
  credit_pi numeric,
  debit_usd numeric,
  credit_usd numeric,
  balance_pi numeric,
  balance_usd numeric
)
language sql
security definer
set search_path = public
as $$
  with all_lines as (
    select
      e.entry_date,
      e.id as journal_entry_id,
      e.source_type,
      e.source_id,
      e.description as journal_description,
      l.account_code,
      a.name as account_name,
      a.normal_balance,
      l.line_description,
      l.debit_pi,
      l.credit_pi,
      l.debit_usd,
      l.credit_usd,
      case
        when a.normal_balance = 'debit'
          then l.debit_pi - l.credit_pi
        else l.credit_pi - l.debit_pi
      end as movement_pi,
      case
        when a.normal_balance = 'debit'
          then l.debit_usd - l.credit_usd
        else l.credit_usd - l.debit_usd
      end as movement_usd
    from public.accounting_journal_entries e
    join public.accounting_journal_lines l
      on l.journal_entry_id = e.id
    join public.accounting_accounts a
      on a.code = l.account_code
    where e.status = 'posted'
      and l.account_code = p_account_code
      and (p_to_date is null or e.entry_date::date <= p_to_date)
  ),
  balanced as (
    select
      *,
      sum(movement_pi) over (
        order by entry_date asc, journal_entry_id asc
        rows between unbounded preceding and current row
      ) as running_balance_pi,
      sum(movement_usd) over (
        order by entry_date asc, journal_entry_id asc
        rows between unbounded preceding and current row
      ) as running_balance_usd
    from all_lines
  )
  select
    b.entry_date,
    b.journal_entry_id,
    b.source_type,
    b.source_id,
    b.journal_description,
    b.account_code,
    b.account_name,
    b.normal_balance,
    b.line_description,
    b.debit_pi,
    b.credit_pi,
    b.debit_usd,
    b.credit_usd,
    b.running_balance_pi as balance_pi,
    b.running_balance_usd as balance_usd
  from balanced b
  where (p_from_date is null or b.entry_date::date >= p_from_date)
  order by b.entry_date asc, b.journal_entry_id asc;
$$;

grant execute on function public.get_account_statement(text, date, date)
  to anon, authenticated;
