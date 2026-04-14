create table if not exists public.pi_users (
  pi_uid text primary key,
  username text not null,
  wallet_address text null,
  raw_profile jsonb not null default '{}'::jsonb,
  last_authenticated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pi_users_username_idx
  on public.pi_users (username);

alter table public.pi_users enable row level security;

drop policy if exists "pi_users_select_public" on public.pi_users;
create policy "pi_users_select_public"
on public.pi_users
for select
using (true);
