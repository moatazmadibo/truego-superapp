-- =========================================================
-- TrueGo Admin Security Phase 6
-- Protected admin review for driver documents.
-- Admin document viewing is handled by Edge Function.
-- =========================================================

create or replace function public.admin_review_demo_driver_document(
  p_admin_session_token text,
  p_document_id uuid,
  p_status text,
  p_admin_notes text default null
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

  if p_status not in ('pending', 'approved', 'rejected', 'needs_more_info') then
    raise exception 'Invalid document status: %', p_status;
  end if;

  update public.demo_driver_documents
     set status = p_status
   where id = p_document_id
   returning to_jsonb(public.demo_driver_documents.*) into v_result;

  if v_result is null then
    raise exception 'Driver document not found';
  end if;

  v_action := case
    when p_status = 'approved' then 'ADMIN_APPROVE_DRIVER_DOCUMENT'
    when p_status = 'rejected' then 'ADMIN_REJECT_DRIVER_DOCUMENT'
    when p_status = 'needs_more_info' then 'ADMIN_DRIVER_DOCUMENT_NEEDS_MORE_INFO'
    else 'ADMIN_REVIEW_DRIVER_DOCUMENT'
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
    'demo_driver_documents',
    p_document_id::text,
    'Admin reviewed driver document using protected RPC. Status: ' || p_status,
    jsonb_build_object(
      'document', v_result,
      'admin_notes', p_admin_notes
    )
  );

  return v_result;
end;
$$;

grant execute on function public.admin_review_demo_driver_document(text, uuid, text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
