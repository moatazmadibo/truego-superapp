-- =========================================================
-- TrueGo Driver Payout Wallet Address
-- Adds public Pi wallet address fields for manual driver payouts.
-- IMPORTANT: Never store passphrase / seed phrase / private keys.
-- =========================================================

alter table public.demo_drivers
  add column if not exists payout_wallet_address text,
  add column if not exists payout_wallet_address_updated_at timestamptz,
  add column if not exists payout_wallet_verified_at timestamptz,
  add column if not exists payout_wallet_verified_by text;

alter table public.driver_payouts
  add column if not exists payout_wallet_address text;

create or replace function public.admin_repair_payout_driver_wallet_addresses(
  p_admin_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_updated integer := 0;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  update public.driver_payouts p
     set payout_wallet_address = d.payout_wallet_address
    from public.demo_drivers d
   where p.demo_driver_id = d.id
     and coalesce(p.payout_wallet_address, '') = ''
     and coalesce(d.payout_wallet_address, '') <> '';

  get diagnostics v_updated = row_count;

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
    'ADMIN_REPAIR_PAYOUT_WALLET_ADDRESSES',
    'driver_payouts',
    'bulk',
    'Admin copied driver payout wallet addresses from driver profiles.',
    jsonb_build_object('updated_count', v_updated)
  );

  return jsonb_build_object(
    'ok', true,
    'updated_count', v_updated
  );
end;
$$;

grant execute on function public.admin_repair_payout_driver_wallet_addresses(text)
to anon, authenticated;

notify pgrst, 'reload schema';
