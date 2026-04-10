-- TrueGo phase 1 core schema
-- Apply inside Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('rider', 'driver', 'admin')),
  display_name text,
  pi_uid text unique,
  wallet_address text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.driver_profiles (
  user_id uuid primary key references public.user_profiles (id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('car', 'motorcycle')),
  is_available boolean not null default true,
  rating numeric(3,2) not null default 5.0,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_user_id uuid references public.user_profiles (id) on delete set null,
  rider_name text,
  driver_user_id uuid references public.user_profiles (id) on delete set null,
  driver_name text,
  pickup_text text not null,
  destination_text text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_lat double precision,
  destination_lng double precision,
  distance_km numeric(10,2) not null default 0,
  duration_min integer not null default 0,
  price_pi numeric(10,2) not null default 0,
  vehicle_type text not null check (vehicle_type in ('car', 'motorcycle')),
  status text not null check (status in ('searching', 'driver_assigned', 'driver_arriving', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists rides_status_idx on public.rides(status);
create index if not exists rides_created_at_idx on public.rides(created_at desc);
create index if not exists rides_driver_user_id_idx on public.rides(driver_user_id);
create index if not exists rides_rider_user_id_idx on public.rides(rider_user_id);

alter table public.user_profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.rides enable row level security;

-- Development-friendly policies. Tighten these before production.
drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own"
on public.user_profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.user_profiles;
create policy "profiles_insert_own"
on public.user_profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own"
on public.user_profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "drivers_select_authenticated" on public.driver_profiles;
create policy "drivers_select_authenticated"
on public.driver_profiles
for select
to authenticated
using (true);

drop policy if exists "drivers_update_own" on public.driver_profiles;
create policy "drivers_update_own"
on public.driver_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "rides_select_authenticated" on public.rides;
create policy "rides_select_authenticated"
on public.rides
for select
to authenticated
using (true);

drop policy if exists "rides_insert_rider" on public.rides;
create policy "rides_insert_rider"
on public.rides
for insert
to authenticated
with check (auth.uid() = rider_user_id or rider_user_id is null);

drop policy if exists "rides_update_driver_or_rider" on public.rides;
create policy "rides_update_driver_or_rider"
on public.rides
for update
to authenticated
using (auth.uid() = rider_user_id or auth.uid() = driver_user_id)
with check (auth.uid() = rider_user_id or auth.uid() = driver_user_id);
