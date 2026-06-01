-- =========================================================
-- TrueGo Admin Session Digest Fix
-- Supabase pgcrypto functions are commonly installed under extensions schema.
-- Fixes: function digest(text, unknown) does not exist
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.assert_valid_admin_session(
  p_admin_session_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_session public.admin_sessions;
begin
  if p_admin_session_token is null or trim(p_admin_session_token) = '' then
    raise exception 'Admin session token is required';
  end if;

  v_hash := encode(
    extensions.digest(p_admin_session_token::text, 'sha256'::text),
    'hex'
  );

  select *
  into v_session
  from public.admin_sessions
  where session_token_hash = v_hash
    and status = 'active'
    and expires_at > now();

  if not found then
    raise exception 'Invalid or expired admin session';
  end if;

  update public.admin_sessions
     set last_seen_at = now()
   where id = v_session.id;

  return v_session.id;
end;
$$;

grant execute on function public.assert_valid_admin_session(text)
  to anon, authenticated;
