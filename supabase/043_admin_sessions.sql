-- =========================================================
-- TrueGo Admin Sessions
-- Stores server-issued admin session tokens for future protected admin actions.
-- Does not change existing app behavior yet.
-- =========================================================

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  actor text not null default 'admin-access-gate',
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz not null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_status_idx
  on public.admin_sessions (status);

create index if not exists admin_sessions_expires_at_idx
  on public.admin_sessions (expires_at);

create or replace function public.revoke_admin_session(
  p_session_token_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_sessions
     set status = 'revoked',
         last_seen_at = now()
   where session_token_hash = p_session_token_hash
     and status = 'active';
end;
$$;

create or replace function public.get_admin_sessions(
  p_limit integer default 50
)
returns table (
  id uuid,
  actor text,
  status text,
  expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.actor,
    s.status,
    s.expires_at,
    s.last_seen_at,
    s.created_at
  from public.admin_sessions s
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

grant select, insert, update on public.admin_sessions to anon, authenticated;
grant execute on function public.revoke_admin_session(text) to anon, authenticated;
grant execute on function public.get_admin_sessions(integer) to anon, authenticated;
