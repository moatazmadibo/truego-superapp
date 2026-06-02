-- =========================================================
-- TrueGo Admin Driver Wallet Management
-- Protected by admin session token.
-- Stores ONLY Pi Wallet public address.
-- NEVER store passphrase / seed phrase / private key.
-- =========================================================

create or replace function public.admin_list_driver_payout_wallets(
  p_admin_session_token text
)
returns table (
  demo_driver_id text,
  display_name text,
  pi_uid text,
  pi_username text,
  account_status text,
  onboarding_status text,
  payout_wallet_address text,
  payout_wallet_address_updated_at timestamptz,
  payout_wallet_verified_at timestamptz,
  payout_wallet_verified_by text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  return query
  select
    d.id as demo_driver_id,
    d.display_name,
    d.pi_uid,
    d.pi_username,
    d.account_status,
    d.onboarding_status,
    d.payout_wallet_address,
    d.payout_wallet_address_updated_at,
    d.payout_wallet_verified_at,
    d.payout_wallet_verified_by
  from public.demo_drivers d
  order by d.display_name nulls last, d.created_at desc nulls last;
end;
$$;

create or replace function public.admin_update_driver_payout_wallet_address(
  p_admin_session_token text,
  p_demo_driver_id text,
  p_wallet_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_wallet text;
  v_driver public.demo_drivers;
  v_payouts_updated integer := 0;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);
  v_wallet := upper(trim(coalesce(p_wallet_address, '')));

  if v_wallet = '' then
    raise exception 'Pi wallet public address is required';
  end if;

  -- Pi wallet public addresses are Stellar-style public keys: 56 chars, usually start with G.
  if v_wallet !~ '^G[A-Z0-9]{55}$' then
    raise exception 'Invalid Pi wallet public address format. Use the public address from Pi Wallet Receive screen.';
  end if;

  select *
  into v_driver
  from public.demo_drivers
  where id = p_demo_driver_id;

  if not found then
    raise exception 'Driver not found';
  end if;

  update public.demo_drivers
     set payout_wallet_address = v_wallet,
         payout_wallet_address_updated_at = now(),
         payout_wallet_verified_at = now(),
         payout_wallet_verified_by = 'admin-session:' || v_session_id::text
   where id = p_demo_driver_id;

  update public.driver_payouts
     set payout_wallet_address = v_wallet
   where demo_driver_id = p_demo_driver_id
     and coalesce(payout_wallet_address, '') = '';

  get diagnostics v_payouts_updated = row_count;

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
    'ADMIN_UPDATE_DRIVER_PAYOUT_WALLET',
    'demo_drivers',
    p_demo_driver_id,
    'Admin updated driver Pi wallet public address for manual payouts.',
    jsonb_build_object(
      'demo_driver_id', p_demo_driver_id,
      'driver_name', v_driver.display_name,
      'pi_username', v_driver.pi_username,
      'wallet_address_last4', right(v_wallet, 4),
      'payouts_updated', v_payouts_updated
    )
  );

  return jsonb_build_object(
    'ok', true,
    'demo_driver_id', p_demo_driver_id,
    'wallet_address', v_wallet,
    'payouts_updated', v_payouts_updated
  );
end;
$$;

grant execute on function public.admin_list_driver_payout_wallets(text)
to anon, authenticated;

grant execute on function public.admin_update_driver_payout_wallet_address(text, text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
