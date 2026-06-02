-- =========================================================
-- TrueGo Admin Session Management
-- Protected by admin session token.
-- Allows admin to inspect and revoke admin sessions.
-- =========================================================

create or replace function public.admin_list_admin_sessions(
  p_admin_session_token text,
  p_limit integer default 100
)
returns table (
  id uuid,
  actor text,
  status text,
  expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz,
  is_current boolean
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
    s.id,
    s.actor,
    case
      when s.status = 'active' and s.expires_at <= now() then 'expired'
      else s.status
    end as status,
    s.expires_at,
    s.last_seen_at,
    s.created_at,
    s.id = v_session_id as is_current
  from public.admin_sessions s
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
end;
$$;

create or replace function public.admin_revoke_admin_session_by_id(
  p_admin_session_token text,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_session_id uuid;
  v_updated integer := 0;
begin
  v_current_session_id := public.assert_valid_admin_session(p_admin_session_token);

  if p_session_id = v_current_session_id then
    raise exception 'Cannot revoke the current admin session from here. Use Lock admin instead.';
  end if;

  update public.admin_sessions
     set status = 'revoked',
         last_seen_at = now()
   where id = p_session_id
     and status = 'active';

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
    'admin-session:' || v_current_session_id::text,
    'ADMIN_REVOKE_SESSION',
    'admin_sessions',
    p_session_id::text,
    'Admin revoked an admin session.',
    jsonb_build_object('revoked_session_id', p_session_id, 'updated', v_updated)
  );

  return jsonb_build_object('ok', true, 'updated', v_updated);
end;
$$;

create or replace function public.admin_revoke_other_admin_sessions(
  p_admin_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_session_id uuid;
  v_updated integer := 0;
begin
  v_current_session_id := public.assert_valid_admin_session(p_admin_session_token);

  update public.admin_sessions
     set status = 'revoked',
         last_seen_at = now()
   where status = 'active'
     and expires_at > now()
     and id <> v_current_session_id;

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
    'admin-session:' || v_current_session_id::text,
    'ADMIN_REVOKE_OTHER_SESSIONS',
    'admin_sessions',
    'bulk',
    'Admin revoked all other active admin sessions.',
    jsonb_build_object('revoked_count', v_updated)
  );

  return jsonb_build_object('ok', true, 'revoked_count', v_updated);
end;
$$;

create or replace function public.admin_mark_expired_admin_sessions(
  p_admin_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_session_id uuid;
  v_updated integer := 0;
begin
  v_current_session_id := public.assert_valid_admin_session(p_admin_session_token);

  update public.admin_sessions
     set status = 'expired',
         last_seen_at = now()
   where status = 'active'
     and expires_at <= now();

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
    'admin-session:' || v_current_session_id::text,
    'ADMIN_MARK_EXPIRED_SESSIONS',
    'admin_sessions',
    'bulk',
    'Admin marked expired admin sessions.',
    jsonb_build_object('expired_count', v_updated)
  );

  return jsonb_build_object('ok', true, 'expired_count', v_updated);
end;
$$;

grant execute on function public.admin_list_admin_sessions(text, integer)
to anon, authenticated;

grant execute on function public.admin_revoke_admin_session_by_id(text, uuid)
to anon, authenticated;

grant execute on function public.admin_revoke_other_admin_sessions(text)
to anon, authenticated;

grant execute on function public.admin_mark_expired_admin_sessions(text)
to anon, authenticated;

notify pgrst, 'reload schema';
