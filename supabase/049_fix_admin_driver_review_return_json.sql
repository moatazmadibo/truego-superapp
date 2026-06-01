-- =========================================================
-- TrueGo Admin Driver Review RPC Return Fix
-- Fixes malformed record literal by returning jsonb from protected wrapper.
-- =========================================================

drop function if exists public.admin_review_demo_driver_verification(text, text, text, text);

create or replace function public.admin_review_demo_driver_verification(
  p_admin_session_token text,
  p_demo_driver_id text,
  p_verification_status text,
  p_admin_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_result jsonb;
  v_action text;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  select to_jsonb(review_result)
  into v_result
  from public.review_demo_driver_verification(
    p_demo_driver_id,
    p_verification_status,
    p_admin_review_notes
  ) as review_result
  limit 1;

  if v_result is null then
    raise exception 'Driver verification review did not return a result';
  end if;

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
    v_result
  );

  return v_result;
end;
$$;

grant execute on function public.admin_review_demo_driver_verification(text, text, text, text)
to anon, authenticated;

revoke execute on function public.review_demo_driver_verification(text, text, text)
from anon, authenticated;

notify pgrst, 'reload schema';
