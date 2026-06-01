-- =========================================================
-- TrueGo Accounting Journal Read RPC
-- Makes Admin journal entries and lines loading reliable.
-- =========================================================

create or replace function public.get_accounting_journal_entries()
returns setof public.accounting_journal_entries
language sql
security definer
set search_path = public
as $$
  select *
  from public.accounting_journal_entries
  order by entry_date desc, created_at desc
  limit 50;
$$;

create or replace function public.get_accounting_journal_lines()
returns setof public.accounting_journal_lines
language sql
security definer
set search_path = public
as $$
  select *
  from public.accounting_journal_lines
  order by created_at asc
  limit 1000;
$$;

grant execute on function public.get_accounting_journal_entries()
  to anon, authenticated;

grant execute on function public.get_accounting_journal_lines()
  to anon, authenticated;

grant select on public.accounting_journal_entries
  to anon, authenticated;

grant select on public.accounting_journal_lines
  to anon, authenticated;
