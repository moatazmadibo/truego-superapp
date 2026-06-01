-- =========================================================
-- TrueGo Driver Payouts Manual Workflow
-- Protected by admin session token.
-- Does not send Pi automatically.
-- Tracks manual payout status and references.
-- =========================================================

create or replace function public.admin_update_driver_payout_status(
  p_admin_session_token text,
  p_payout_id uuid,
  p_next_status text,
  p_payout_payment_id text default null,
  p_payout_txid text default null,
  p_payout_error text default null
)
returns public.driver_payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.driver_payouts;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  if p_next_status not in ('pending', 'processing', 'paid', 'failed', 'cancelled') then
    raise exception 'Invalid payout status: %', p_next_status;
  end if;

  if p_next_status = 'paid'
     and coalesce(trim(p_payout_txid), '') = ''
     and coalesce(trim(p_payout_payment_id), '') = '' then
    raise exception 'Payment reference or TXID is required when marking payout as paid';
  end if;

  update public.driver_payouts
     set payout_status = p_next_status,
         payout_payment_id = nullif(trim(coalesce(p_payout_payment_id, payout_payment_id)), ''),
         payout_txid = nullif(trim(coalesce(p_payout_txid, payout_txid)), ''),
         payout_error = case
           when p_next_status = 'failed' then nullif(trim(coalesce(p_payout_error, 'Manual payout failed')), '')
           when p_next_status in ('paid', 'processing', 'pending') then null
           else payout_error
         end,
         requested_at = case
           when p_next_status in ('processing', 'paid') then coalesce(requested_at, now())
           else requested_at
         end,
         processed_at = case
           when p_next_status in ('paid', 'failed', 'cancelled') then now()
           else processed_at
         end
   where id = p_payout_id
   returning * into v_result;

  if not found then
    raise exception 'Driver payout record not found';
  end if;

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
    case
      when p_next_status = 'processing' then 'ADMIN_DRIVER_PAYOUT_PROCESSING'
      when p_next_status = 'paid' then 'ADMIN_DRIVER_PAYOUT_PAID'
      when p_next_status = 'failed' then 'ADMIN_DRIVER_PAYOUT_FAILED'
      when p_next_status = 'cancelled' then 'ADMIN_DRIVER_PAYOUT_CANCELLED'
      else 'ADMIN_DRIVER_PAYOUT_PENDING'
    end,
    'driver_payouts',
    p_payout_id::text,
    'Admin updated driver payout status to ' || p_next_status || ' using protected RPC.',
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

grant execute on function public.admin_update_driver_payout_status(text, uuid, text, text, text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
