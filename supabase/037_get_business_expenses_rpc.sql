-- =========================================================
-- TrueGo Business Expenses Read RPC
-- Makes Admin business expenses loading reliable.
-- =========================================================

create or replace function public.get_business_expenses()
returns setof public.business_expenses
language sql
security definer
set search_path = public
as $$
  select *
  from public.business_expenses
  order by created_at desc
  limit 50;
$$;

grant execute on function public.get_business_expenses()
  to anon, authenticated;

grant select on public.business_expenses
  to anon, authenticated;
