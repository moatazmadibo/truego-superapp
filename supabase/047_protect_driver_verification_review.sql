-- =========================================================
-- TrueGo Admin Security Phase 5
-- Protect driver verification review / approval with Admin Session.
-- Keeps driver self-submission open, but admin review now requires session token.
-- =========================================================

create or replace function public.admin_review_demo_driver_verification(
  p_admin_session_token text,
  p_demo_driver_id text,
  p_verification_status text,
  p_admin_notes text default null
)
returns public.demo_driver_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result public.demo_driver_verifications;
  v_action text;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  v_result := public.review_demo_driver_verification(
    p_demo_driver_id,
    p_verification_status,
    p_admin_notes
  );

  v_action := case
    when p_verification_status = 'approved' then 'ADMIN_APPROVE_DRIVER'
    when p_verification_status = 'rejected' then 'ADMIN_REJECT_DRIVER'
    when p_verification_status = 'needs_more_info' then 'ADMIN_DRIVER_NEEDS_MORE_INFO'
    else 'ADMIN_REVIEW_DRIVER'
  end;

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
    v_action,
    'demo_driver_verifications',
    p_demo_driver_id,
    'Admin reviewed driver verification using protected RPC. Status: ' || p_verification_status,
    to_jsonb(v_result)
  );

  return v_result;
end;
$$;

grant execute on function public.admin_review_demo_driver_verification(text, text, text, text)
to anon, authenticated;

-- Revoke direct access to the old unprotected admin review RPC.
-- Driver self-submission remains available through submit_demo_driver_verification.
revoke execute on function public.review_demo_driver_verification(text, text, text)
from anon, authenticated;
