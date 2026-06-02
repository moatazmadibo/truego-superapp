-- =========================================================
-- TrueGo Admin Security Phase 7
-- Protect Admin Reports and Audit Log read RPCs with Admin Session.
-- =========================================================

create or replace function public.admin_get_admin_driver_report(
  p_admin_session_token text
)
returns table (
  demo_driver_id text,
  display_name text,
  pi_uid text,
  pi_username text,
  email text,
  phone text,
  email_verified boolean,
  phone_verified boolean,
  account_status text,
  onboarding_status text,
  verification_status text,
  submitted_at timestamptz,
  verified_at timestamptz,
  is_online boolean,
  is_available boolean,
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  vehicle_plate text,
  vehicle_license_expires_at date,
  driver_license_expires_at date,
  documents_count bigint,
  approved_documents_count bigint,
  pending_documents_count bigint,
  readiness_status text
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
  select *
  from public.get_admin_driver_report();
end;
$$;

create or replace function public.admin_get_admin_ride_report(
  p_admin_session_token text,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  ride_id uuid,
  ride_status text,
  payment_status text,
  payout_status text,
  rider_name text,
  driver_name text,
  demo_driver_id text,
  pickup_text text,
  destination_text text,
  vehicle_type text,
  distance_km numeric,
  duration_min numeric,
  price_pi numeric,
  payment_amount_pi numeric,
  driver_payout_pi numeric,
  payment_id text,
  payment_txid text,
  created_at timestamptz,
  completed_at timestamptz,
  payment_completed_at timestamptz,
  report_bucket text
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
  select *
  from public.get_admin_ride_report(p_from_date, p_to_date);
end;
$$;

create or replace function public.admin_get_admin_audit_logs(
  p_admin_session_token text,
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  return query
  select *
  from public.get_admin_audit_logs(
    p_limit,
    p_table_name,
    p_from_date,
    p_to_date
  );
end;
$$;

grant execute on function public.admin_get_admin_driver_report(text)
to anon, authenticated;

grant execute on function public.admin_get_admin_ride_report(text, date, date)
to anon, authenticated;

grant execute on function public.admin_get_admin_audit_logs(text, integer, text, date, date)
to anon, authenticated;

-- Revoke old unprotected read RPCs from frontend callers.
revoke execute on function public.get_admin_driver_report()
from anon, authenticated;

revoke execute on function public.get_admin_ride_report(date, date)
from anon, authenticated;

revoke execute on function public.get_admin_audit_logs(integer, text, date, date)
from anon, authenticated;

notify pgrst, 'reload schema';
