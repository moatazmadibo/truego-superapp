-- =========================================================
-- TrueGo Admin Integrity Repair
-- Repair driver payout Pi account fields from linked demo driver profile.
-- Protected by admin session token.
-- Does NOT send Pi and does NOT invent missing Pi identities.
-- =========================================================

create or replace function public.admin_repair_payout_driver_pi_accounts(
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
     set driver_pi_uid = case
           when coalesce(p.driver_pi_uid, '') = '' then d.pi_uid
           else p.driver_pi_uid
         end,
         driver_pi_username = case
           when coalesce(p.driver_pi_username, '') = '' then d.pi_username
           else p.driver_pi_username
         end
    from public.demo_drivers d
   where p.demo_driver_id = d.id
     and (
       coalesce(p.driver_pi_uid, '') = ''
       or coalesce(p.driver_pi_username, '') = ''
     )
     and (
       coalesce(d.pi_uid, '') <> ''
       or coalesce(d.pi_username, '') <> ''
     );

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
    'ADMIN_REPAIR_PAYOUT_DRIVER_PI_ACCOUNTS',
    'driver_payouts',
    'bulk',
    'Admin repaired payout driver Pi account fields from driver profiles.',
    jsonb_build_object('updated_count', v_updated)
  );

  return jsonb_build_object(
    'ok', true,
    'updated_count', v_updated
  );
end;
$$;

grant execute on function public.admin_repair_payout_driver_pi_accounts(text)
to anon, authenticated;

notify pgrst, 'reload schema';
