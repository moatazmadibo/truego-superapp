-- =========================================================
-- TrueGo Printable Driver Statement RPC
-- Returns driver payout statement from driver_payouts.
-- This does NOT send Pi and does NOT change payment logic.
-- =========================================================

create or replace function public.get_driver_statement_drivers()
returns table (
  demo_driver_id text,
  driver_name text,
  driver_pi_uid text,
  driver_pi_username text,
  payout_count bigint,
  pending_amount_pi numeric,
  paid_amount_pi numeric
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(dp.demo_driver_id, d.id) as demo_driver_id,
    coalesce(dp.driver_name, d.display_name) as driver_name,
    coalesce(dp.driver_pi_uid, d.pi_uid) as driver_pi_uid,
    coalesce(dp.driver_pi_username, d.pi_username) as driver_pi_username,
    count(dp.id) as payout_count,
    coalesce(sum(case when dp.payout_status = 'pending' then dp.driver_payout_pi else 0 end), 0) as pending_amount_pi,
    coalesce(sum(case when dp.payout_status = 'paid' then dp.driver_payout_pi else 0 end), 0) as paid_amount_pi
  from public.demo_drivers d
  left join public.driver_payouts dp
    on dp.demo_driver_id = d.id
  where d.pi_uid is not null
     or dp.driver_pi_uid is not null
  group by
    coalesce(dp.demo_driver_id, d.id),
    coalesce(dp.driver_name, d.display_name),
    coalesce(dp.driver_pi_uid, d.pi_uid),
    coalesce(dp.driver_pi_username, d.pi_username)
  order by driver_name;
$$;

create or replace function public.get_driver_statement(
  p_demo_driver_id text,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  payout_id uuid,
  ride_id uuid,
  demo_driver_id text,
  driver_name text,
  driver_pi_uid text,
  driver_pi_username text,
  source_payment_completed_at timestamptz,
  gross_amount_pi numeric,
  commission_percent numeric,
  app_commission_pi numeric,
  driver_payout_pi numeric,
  payout_status text,
  payout_payment_id text,
  payout_txid text,
  payout_error text,
  requested_at timestamptz,
  processed_at timestamptz,
  running_driver_payable_pi numeric
)
language sql
security definer
set search_path = public
as $$
  with rows as (
    select
      dp.id as payout_id,
      dp.ride_id,
      dp.demo_driver_id,
      dp.driver_name,
      dp.driver_pi_uid,
      dp.driver_pi_username,
      dp.source_payment_completed_at,
      dp.gross_amount_pi,
      dp.commission_percent,
      dp.app_commission_pi,
      dp.driver_payout_pi,
      dp.payout_status,
      dp.payout_payment_id,
      dp.payout_txid,
      dp.payout_error,
      dp.requested_at,
      dp.processed_at,
      case
        when dp.payout_status = 'paid' then 0 - dp.driver_payout_pi
        when dp.payout_status in ('pending', 'processing', 'failed') then dp.driver_payout_pi
        else 0
      end as movement_pi
    from public.driver_payouts dp
    where dp.demo_driver_id = p_demo_driver_id
      and (p_from_date is null or coalesce(dp.source_payment_completed_at, dp.created_at)::date >= p_from_date)
      and (p_to_date is null or coalesce(dp.source_payment_completed_at, dp.created_at)::date <= p_to_date)
  )
  select
    r.payout_id,
    r.ride_id,
    r.demo_driver_id,
    r.driver_name,
    r.driver_pi_uid,
    r.driver_pi_username,
    r.source_payment_completed_at,
    r.gross_amount_pi,
    r.commission_percent,
    r.app_commission_pi,
    r.driver_payout_pi,
    r.payout_status,
    r.payout_payment_id,
    r.payout_txid,
    r.payout_error,
    r.requested_at,
    r.processed_at,
    sum(r.movement_pi) over (
      order by coalesce(r.source_payment_completed_at, r.requested_at) asc, r.payout_id asc
      rows between unbounded preceding and current row
    ) as running_driver_payable_pi
  from rows r
  order by coalesce(r.source_payment_completed_at, r.requested_at) asc, r.payout_id asc;
$$;

grant execute on function public.get_driver_statement_drivers()
  to anon, authenticated;

grant execute on function public.get_driver_statement(text, date, date)
  to anon, authenticated;
