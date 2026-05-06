-- =========================================================
-- TrueGo Payment Retry Hardening
-- Fixes Pi Wallet: Expired / Timeout / Failed / Cancelled
-- Compatible statuses: unpaid / approved / completed / cancelled / failed
-- =========================================================

alter table public.rides
add column if not exists payment_attempt_count integer not null default 0;

alter table public.rides
add column if not exists payment_last_error text null;

alter table public.rides
add column if not exists payment_last_error_at timestamptz null;


create or replace function public.prepare_ride_pi_payment_retry(
  p_ride_id uuid,
  p_reason text default null
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  -- لا نلمس أي رحلة مدفوعة بالفعل
  if v_ride.payment_completed_at is not null
     or v_ride.payment_status = 'completed' then
    return v_ride;
  end if;

  -- الدفع مسموح فقط بعد اكتمال الرحلة
  if v_ride.status <> 'completed' then
    raise exception 'Ride is not completed yet';
  end if;

  update public.rides
  set
    payment_id = null,
    payment_txid = null,
    payment_completed_at = null,
    payment_provider = 'pi',
    payment_status = 'unpaid',
    payment_amount_pi = coalesce(payment_amount_pi, price_pi),
    payment_attempt_count = coalesce(payment_attempt_count, 0) + 1,
    payment_last_error = p_reason,
    payment_last_error_at = case
      when p_reason is null then payment_last_error_at
      else now()
    end
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;


create or replace function public.register_ride_pi_payment_attempt(
  p_ride_id uuid,
  p_payment_id text
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  -- لا نغير رحلة مدفوعة
  if v_ride.payment_completed_at is not null
     or v_ride.payment_status = 'completed' then
    return v_ride;
  end if;

  update public.rides
  set
    payment_id = p_payment_id,
    payment_txid = null,
    payment_completed_at = null,
    payment_provider = 'pi',
    payment_status = 'unpaid',
    payment_amount_pi = coalesce(payment_amount_pi, price_pi),
    payment_last_error = null,
    payment_last_error_at = null
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;


create or replace function public.clear_ride_pi_payment_attempt(
  p_ride_id uuid,
  p_payment_id text default null,
  p_reason text default null
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  select *
  into v_ride
  from public.rides
  where id = p_ride_id
  for update;

  if not found then
    raise exception 'Ride not found';
  end if;

  -- لا نغير رحلة مدفوعة
  if v_ride.payment_completed_at is not null
     or v_ride.payment_status = 'completed' then
    return v_ride;
  end if;

  -- إذا أُرسل payment_id، لا نمسح إلا نفس المحاولة
  if p_payment_id is not null
     and v_ride.payment_id is not null
     and v_ride.payment_id <> p_payment_id then
    return v_ride;
  end if;

  update public.rides
  set
    payment_id = null,
    payment_txid = null,
    payment_completed_at = null,
    payment_provider = 'pi',
    payment_status = 'unpaid',
    payment_amount_pi = coalesce(payment_amount_pi, price_pi),
    payment_last_error = p_reason,
    payment_last_error_at = now()
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;


grant execute on function public.prepare_ride_pi_payment_retry(uuid, text) to anon, authenticated;
grant execute on function public.register_ride_pi_payment_attempt(uuid, text) to anon, authenticated;
grant execute on function public.clear_ride_pi_payment_attempt(uuid, text, text) to anon, authenticated;
