-- =========================================================
-- TrueGo Driver Payouts + Manual Commission Settings
-- Phase 1: records and admin-controlled commission only.
-- No Pi A2U transfer is executed in this migration.
-- =========================================================

create table if not exists public.platform_payout_settings (
  id text primary key default 'truego',
  commission_percent numeric(7,4) not null default 15.0000,
  payout_mode text not null default 'manual'
    check (payout_mode in ('manual', 'automatic')),
  min_payout_pi numeric(20,8) not null default 0,
  updated_by text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint platform_payout_settings_singleton check (id = 'truego'),
  constraint platform_payout_settings_commission_range
    check (commission_percent >= 0 and commission_percent <= 100)
);

insert into public.platform_payout_settings (
  id,
  commission_percent,
  payout_mode,
  min_payout_pi
)
values (
  'truego',
  15.0000,
  'manual',
  0
)
on conflict (id) do nothing;

create table if not exists public.driver_payouts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  demo_driver_id text null references public.demo_drivers(id) on delete set null,

  driver_name text null,
  driver_pi_uid text null,
  driver_pi_username text null,

  gross_amount_pi numeric(20,8) not null default 0,
  commission_percent numeric(7,4) not null default 0,
  app_commission_pi numeric(20,8) not null default 0,
  driver_payout_pi numeric(20,8) not null default 0,

  source_payment_status text null,
  source_payment_id text null,
  source_payment_txid text null,
  source_payment_completed_at timestamptz null,

  payout_status text not null default 'pending'
    check (payout_status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),

  payout_payment_id text null,
  payout_txid text null,
  payout_error text null,

  requested_at timestamptz null,
  processed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (ride_id),
  constraint driver_payouts_amounts_non_negative
    check (
      gross_amount_pi >= 0 and
      commission_percent >= 0 and
      commission_percent <= 100 and
      app_commission_pi >= 0 and
      driver_payout_pi >= 0
    )
);

create index if not exists driver_payouts_demo_driver_id_idx
  on public.driver_payouts (demo_driver_id);

create index if not exists driver_payouts_status_idx
  on public.driver_payouts (payout_status);

create index if not exists driver_payouts_created_at_idx
  on public.driver_payouts (created_at desc);

create or replace function public.update_platform_payout_settings(
  p_commission_percent numeric,
  p_payout_mode text default 'manual',
  p_min_payout_pi numeric default 0,
  p_updated_by text default null
)
returns public.platform_payout_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_payout_settings;
begin
  if p_commission_percent is null or p_commission_percent < 0 or p_commission_percent > 100 then
    raise exception 'Commission percent must be between 0 and 100';
  end if;

  if p_payout_mode not in ('manual', 'automatic') then
    raise exception 'Invalid payout mode';
  end if;

  if p_min_payout_pi is null or p_min_payout_pi < 0 then
    raise exception 'Minimum payout must be zero or greater';
  end if;

  insert into public.platform_payout_settings (
    id,
    commission_percent,
    payout_mode,
    min_payout_pi,
    updated_by,
    updated_at
  )
  values (
    'truego',
    p_commission_percent,
    p_payout_mode,
    p_min_payout_pi,
    p_updated_by,
    now()
  )
  on conflict (id) do update
  set
    commission_percent = excluded.commission_percent,
    payout_mode = excluded.payout_mode,
    min_payout_pi = excluded.min_payout_pi,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_settings;

  return v_settings;
end;
$$;

create or replace function public.upsert_driver_payout_for_completed_ride(
  p_ride_id uuid,
  p_commission_percent numeric default null
)
returns public.driver_payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_driver public.demo_drivers;
  v_settings public.platform_payout_settings;
  v_existing public.driver_payouts;
  v_commission_percent numeric(7,4);
  v_gross_amount numeric(20,8);
  v_app_commission numeric(20,8);
  v_driver_payout numeric(20,8);
  v_result public.driver_payouts;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id;

  if not found then
    raise exception 'Ride not found';
  end if;

  if v_ride.status <> 'completed' then
    raise exception 'Driver payout can only be created after ride completion';
  end if;

  if coalesce(v_ride.payment_status, 'unpaid') <> 'completed' then
    raise exception 'Driver payout can only be created after completed rider payment';
  end if;

  if v_ride.demo_driver_id is null then
    raise exception 'Ride has no assigned driver profile';
  end if;

  select *
  into v_driver
  from public.demo_drivers
  where id = v_ride.demo_driver_id;

  if not found then
    raise exception 'Assigned driver profile not found';
  end if;

  if v_driver.account_status is distinct from 'approved' then
    raise exception 'Driver account must be approved before payout';
  end if;

  if v_driver.pi_uid is null or trim(v_driver.pi_uid) = '' then
    raise exception 'Driver Pi UID is required before payout';
  end if;

  select *
  into v_settings
  from public.platform_payout_settings
  where id = 'truego';

  if not found then
    insert into public.platform_payout_settings (id)
    values ('truego')
    returning * into v_settings;
  end if;

  v_commission_percent := coalesce(p_commission_percent, v_settings.commission_percent);

  if v_commission_percent < 0 or v_commission_percent > 100 then
    raise exception 'Commission percent must be between 0 and 100';
  end if;

  v_gross_amount := round(coalesce(v_ride.payment_amount_pi, v_ride.price_pi, 0)::numeric, 8);

  if v_gross_amount <= 0 then
    raise exception 'Ride payment amount is missing or invalid';
  end if;

  v_app_commission := round((v_gross_amount * v_commission_percent / 100)::numeric, 8);
  v_driver_payout := round((v_gross_amount - v_app_commission)::numeric, 8);

  if v_driver_payout < v_settings.min_payout_pi then
    raise exception 'Driver payout is below the configured minimum payout';
  end if;

  select *
  into v_existing
  from public.driver_payouts
  where ride_id = p_ride_id;

  if found and v_existing.payout_status in ('processing', 'paid') then
    return v_existing;
  end if;

  insert into public.driver_payouts (
    ride_id,
    demo_driver_id,
    driver_name,
    driver_pi_uid,
    driver_pi_username,
    gross_amount_pi,
    commission_percent,
    app_commission_pi,
    driver_payout_pi,
    source_payment_status,
    source_payment_id,
    source_payment_txid,
    source_payment_completed_at,
    payout_status,
    requested_at,
    updated_at
  )
  values (
    v_ride.id,
    v_ride.demo_driver_id,
    coalesce(v_ride.driver_name, v_driver.display_name),
    v_driver.pi_uid,
    v_driver.pi_username,
    v_gross_amount,
    v_commission_percent,
    v_app_commission,
    v_driver_payout,
    v_ride.payment_status,
    v_ride.payment_id,
    v_ride.payment_txid,
    v_ride.payment_completed_at,
    'pending',
    now(),
    now()
  )
  on conflict (ride_id) do update
  set
    demo_driver_id = excluded.demo_driver_id,
    driver_name = excluded.driver_name,
    driver_pi_uid = excluded.driver_pi_uid,
    driver_pi_username = excluded.driver_pi_username,
    gross_amount_pi = excluded.gross_amount_pi,
    commission_percent = excluded.commission_percent,
    app_commission_pi = excluded.app_commission_pi,
    driver_payout_pi = excluded.driver_payout_pi,
    source_payment_status = excluded.source_payment_status,
    source_payment_id = excluded.source_payment_id,
    source_payment_txid = excluded.source_payment_txid,
    source_payment_completed_at = excluded.source_payment_completed_at,
    payout_status = case
      when public.driver_payouts.payout_status in ('paid', 'processing')
        then public.driver_payouts.payout_status
      else 'pending'
    end,
    payout_error = null,
    requested_at = coalesce(public.driver_payouts.requested_at, now()),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

grant select, insert, update on public.platform_payout_settings to anon, authenticated;
grant select, insert, update on public.driver_payouts to anon, authenticated;

grant execute on function public.update_platform_payout_settings(numeric, text, numeric, text)
  to anon, authenticated;

grant execute on function public.upsert_driver_payout_for_completed_ride(uuid, numeric)
  to anon, authenticated;
