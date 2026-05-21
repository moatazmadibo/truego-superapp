-- Preserve Pi payment_id when the user cancels the Pi wallet payment flow.
-- This is intentionally separate from clear_ride_pi_payment_attempt because
-- clear_* is still needed for failed/expired attempts that must be reset.

create or replace function public.cancel_ride_pi_payment_attempt(
  p_ride_id uuid,
  p_payment_id text default null,
  p_reason text default 'User cancelled Pi payment'
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
    raise exception 'Ride % not found', p_ride_id;
  end if;

  -- Never overwrite an already completed blockchain-confirmed payment.
  if v_ride.payment_status = 'completed'
     or v_ride.payment_completed_at is not null
     or v_ride.payment_txid is not null then
    return v_ride;
  end if;

  update public.rides
     set payment_id = coalesce(p_payment_id, payment_id),
         payment_status = 'cancelled',
         payment_last_error = case
           when p_payment_id is not null then p_reason || ': ' || p_payment_id
           else p_reason
         end,
         payment_last_error_at = now()
   where id = p_ride_id
   returning * into v_ride;

  return v_ride;
end;
$$;

grant execute on function public.cancel_ride_pi_payment_attempt(uuid, text, text) to anon, authenticated;
