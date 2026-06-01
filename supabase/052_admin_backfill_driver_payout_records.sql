-- =========================================================
-- TrueGo Admin Driver Payout Backfill
-- Creates pending driver payout records from old completed paid rides.
-- Protected by admin session token. Does NOT send Pi.
-- =========================================================

create or replace function public.admin_backfill_driver_payout_records(
  p_admin_session_token text,
  p_commission_percent numeric default null
)
returns table (
  succeeded integer,
  skipped integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_settings public.platform_payout_settings;
  v_commission_percent numeric;
  v_ride record;
  v_driver record;
  v_gross_amount_pi numeric;
  v_app_commission_pi numeric;
  v_driver_payout_pi numeric;
  v_succeeded integer := 0;
  v_skipped integer := 0;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  select *
  into v_settings
  from public.platform_payout_settings
  order by updated_at desc nulls last
  limit 1;

  v_commission_percent := coalesce(
    p_commission_percent,
    v_settings.commission_percent,
    7.5
  );

  if v_commission_percent < 0 or v_commission_percent > 100 then
    raise exception 'Invalid commission percent: %', v_commission_percent;
  end if;

  for v_ride in
    select r.*
    from public.rides r
    where r.payment_status = 'completed'
      and r.status = 'completed'
      and not exists (
        select 1
        from public.driver_payouts dp
        where dp.ride_id = r.id
      )
    order by r.payment_completed_at desc nulls last, r.created_at desc
    limit 100
  loop
    select d.*
    into v_driver
    from public.demo_drivers d
    where d.id = v_ride.demo_driver_id
       or (
        v_ride.driver_name is not null
        and lower(d.display_name) = lower(v_ride.driver_name)
       )
    order by
      case when d.id = v_ride.demo_driver_id then 0 else 1 end,
      d.created_at desc nulls last
    limit 1;

    v_gross_amount_pi := coalesce(
      v_ride.payment_amount_pi,
      v_ride.price_pi,
      0
    );

    if v_gross_amount_pi <= 0 or v_driver.id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_app_commission_pi := round(v_gross_amount_pi * v_commission_percent / 100, 8);
    v_driver_payout_pi := round(v_gross_amount_pi - v_app_commission_pi, 8);

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
      payout_status,
      source_payment_id,
      source_payment_txid,
      source_payment_completed_at
    )
    values (
      v_ride.id,
      v_driver.id,
      coalesce(v_driver.display_name, v_ride.driver_name, 'Unknown driver'),
      v_driver.pi_uid,
      v_driver.pi_username,
      v_gross_amount_pi,
      v_commission_percent,
      v_app_commission_pi,
      v_driver_payout_pi,
      'pending',
      v_ride.payment_id,
      v_ride.payment_txid,
      v_ride.payment_completed_at
    );

    v_succeeded := v_succeeded + 1;
  end loop;

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
    'ADMIN_BACKFILL_DRIVER_PAYOUTS',
    'driver_payouts',
    'bulk-backfill',
    'Admin backfilled driver payout records from old paid rides.',
    jsonb_build_object(
      'succeeded', v_succeeded,
      'skipped', v_skipped,
      'commission_percent', v_commission_percent
    )
  );

  return query
  select
    v_succeeded,
    v_skipped,
    'Backfill finished: ' || v_succeeded || ' created, ' || v_skipped || ' skipped.';
end;
$$;

grant execute on function public.admin_backfill_driver_payout_records(text, numeric)
to anon, authenticated;

notify pgrst, 'reload schema';
