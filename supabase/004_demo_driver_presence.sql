alter table public.demo_drivers
add column if not exists is_online boolean not null default false;

alter table public.demo_drivers
add column if not exists last_seen_at timestamptz null;
