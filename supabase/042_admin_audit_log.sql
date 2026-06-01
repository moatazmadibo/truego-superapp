-- =========================================================
-- TrueGo Admin Audit Log
-- Tracks sensitive admin/finance/payout/driver verification changes.
-- Read-only admin visibility. Does not change payment logic.
-- =========================================================

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null default now(),
  source text not null default 'database_trigger',
  actor text null,
  action text not null,
  table_name text not null,
  record_id text null,
  summary text null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_event_time_idx
  on public.admin_audit_logs (event_time desc);

create index if not exists admin_audit_logs_table_name_idx
  on public.admin_audit_logs (table_name);

create index if not exists admin_audit_logs_record_id_idx
  on public.admin_audit_logs (record_id);

create or replace function public.truego_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_record_id text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_old := null;
    v_record_id := v_new ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    v_record_id := coalesce(v_new ->> 'id', v_old ->> 'id');
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_record_id := v_old ->> 'id';
  end if;

  v_summary := tg_op || ' on ' || tg_table_name;

  insert into public.admin_audit_logs (
    source,
    action,
    table_name,
    record_id,
    summary,
    old_data,
    new_data
  )
  values (
    'database_trigger',
    tg_op,
    tg_table_name,
    v_record_id,
    v_summary,
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists truego_audit_platform_payout_settings on public.platform_payout_settings;
create trigger truego_audit_platform_payout_settings
after insert or update
on public.platform_payout_settings
for each row
execute function public.truego_audit_row_change();

drop trigger if exists truego_audit_platform_finance_settings on public.platform_finance_settings;
create trigger truego_audit_platform_finance_settings
after insert or update
on public.platform_finance_settings
for each row
execute function public.truego_audit_row_change();

drop trigger if exists truego_audit_business_expenses on public.business_expenses;
create trigger truego_audit_business_expenses
after insert or update
on public.business_expenses
for each row
execute function public.truego_audit_row_change();

drop trigger if exists truego_audit_driver_payouts on public.driver_payouts;
create trigger truego_audit_driver_payouts
after insert or update
on public.driver_payouts
for each row
execute function public.truego_audit_row_change();

drop trigger if exists truego_audit_accounting_journal_entries on public.accounting_journal_entries;
create trigger truego_audit_accounting_journal_entries
after insert or update
on public.accounting_journal_entries
for each row
execute function public.truego_audit_row_change();

drop trigger if exists truego_audit_demo_drivers on public.demo_drivers;
create trigger truego_audit_demo_drivers
after insert or update
on public.demo_drivers
for each row
execute function public.truego_audit_row_change();

drop trigger if exists truego_audit_demo_driver_verifications on public.demo_driver_verifications;
create trigger truego_audit_demo_driver_verifications
after insert or update
on public.demo_driver_verifications
for each row
execute function public.truego_audit_row_change();

create or replace function public.get_admin_audit_logs(
  p_limit integer default 100,
  p_table_name text default null,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  id uuid,
  event_time timestamptz,
  source text,
  actor text,
  action text,
  table_name text,
  record_id text,
  summary text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.event_time,
    l.source,
    l.actor,
    l.action,
    l.table_name,
    l.record_id,
    l.summary,
    l.old_data,
    l.new_data,
    l.created_at
  from public.admin_audit_logs l
  where (p_table_name is null or p_table_name = '' or l.table_name = p_table_name)
    and (p_from_date is null or l.event_time::date >= p_from_date)
    and (p_to_date is null or l.event_time::date <= p_to_date)
  order by l.event_time desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

grant select, insert on public.admin_audit_logs to anon, authenticated;
grant execute on function public.get_admin_audit_logs(integer, text, date, date) to anon, authenticated;
