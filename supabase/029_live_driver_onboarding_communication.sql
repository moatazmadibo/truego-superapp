-- 029_live_driver_onboarding_communication.sql
-- Live pilot foundation:
-- Driver Pi identity, phone/email verification scaffolding, rider-driver messages, and call events.

alter table public.demo_drivers
  add column if not exists pi_uid text,
  add column if not exists pi_username text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists onboarding_status text not null default 'profile_required',
  add column if not exists account_status text not null default 'pending',
  add column if not exists verification_required boolean not null default true;

create unique index if not exists demo_drivers_pi_uid_unique
  on public.demo_drivers (pi_uid)
  where pi_uid is not null;

alter table public.rides
  add column if not exists rider_pi_uid text,
  add column if not exists rider_pi_username text,
  add column if not exists rider_phone text,
  add column if not exists rider_email text;

create table if not exists public.user_contact_profiles (
  id uuid primary key default gen_random_uuid(),
  pi_uid text not null unique,
  pi_username text,
  role text not null default 'rider' check (role in ('rider', 'driver', 'admin')),
  display_name text,
  phone text,
  email text,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_verifications (
  id uuid primary key default gen_random_uuid(),
  pi_uid text,
  demo_driver_id text references public.demo_drivers(id) on delete cascade,
  role text not null check (role in ('rider', 'driver')),
  channel text not null check (channel in ('email', 'phone')),
  target text not null,
  otp_hash text,
  provider text,
  provider_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'expired', 'failed')),
  attempts integer not null default 0,
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_verifications_lookup_idx
  on public.contact_verifications (role, channel, target, status);

create index if not exists contact_verifications_driver_idx
  on public.contact_verifications (demo_driver_id, channel, status);

create table if not exists public.ride_messages (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  sender_role text not null check (sender_role in ('rider', 'driver', 'admin', 'system')),
  sender_pi_uid text,
  sender_name text,
  message_text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ride_messages_ride_created_idx
  on public.ride_messages (ride_id, created_at);

alter table public.ride_messages enable row level security;

drop policy if exists ride_messages_anon_select on public.ride_messages;
drop policy if exists ride_messages_anon_insert on public.ride_messages;

create policy ride_messages_anon_select
on public.ride_messages
for select
to anon, authenticated
using (true);

create policy ride_messages_anon_insert
on public.ride_messages
for insert
to anon, authenticated
with check (true);

create table if not exists public.ride_call_events (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  caller_role text not null check (caller_role in ('rider', 'driver')),
  caller_pi_uid text,
  callee_role text not null check (callee_role in ('rider', 'driver')),
  callee_phone text,
  call_type text not null default 'phone' check (call_type in ('phone', 'in_app_voice')),
  call_status text not null default 'started'
    check (call_status in ('started', 'missed', 'ended', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ride_call_events_ride_created_idx
  on public.ride_call_events (ride_id, created_at);

create or replace function public.get_or_create_pi_driver_profile(
  p_pi_uid text,
  p_pi_username text
)
returns public.demo_drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.demo_drivers;
  v_driver_id text;
  v_display_name text;
begin
  if p_pi_uid is null or length(trim(p_pi_uid)) = 0 then
    raise exception 'Pi UID is required';
  end if;

  select *
    into v_driver
    from public.demo_drivers
   where pi_uid = p_pi_uid
   limit 1;

  if found then
    update public.demo_drivers
       set pi_username = nullif(trim(p_pi_username), ''),
           updated_at = now()
     where id = v_driver.id
     returning * into v_driver;

    return v_driver;
  end if;

  v_driver_id := 'pi_' || substring(md5(p_pi_uid) from 1 for 20);
  v_display_name := case
    when p_pi_username is not null and length(trim(p_pi_username)) > 0
      then '@' || trim(p_pi_username)
    else 'Pi Driver'
  end;

  insert into public.demo_drivers (
    id,
    display_name,
    vehicle_type,
    is_available,
    is_online,
    rating,
    pi_uid,
    pi_username,
    onboarding_status,
    account_status,
    verification_required,
    created_at,
    updated_at
  )
  values (
    v_driver_id,
    v_display_name,
    'car',
    false,
    false,
    5,
    p_pi_uid,
    nullif(trim(p_pi_username), ''),
    'profile_required',
    'pending',
    true,
    now(),
    now()
  )
  returning * into v_driver;

  return v_driver;
end;
$$;

create or replace function public.update_pi_driver_contact_profile(
  p_driver_id text,
  p_email text,
  p_phone text
)
returns public.demo_drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.demo_drivers;
begin
  update public.demo_drivers
     set email = nullif(trim(p_email), ''),
         phone = nullif(trim(p_phone), ''),
         onboarding_status = case
           when onboarding_status = 'profile_required' then 'contact_required'
           else onboarding_status
         end,
         updated_at = now()
   where id = p_driver_id
   returning * into v_driver;

  if not found then
    raise exception 'Driver profile not found';
  end if;

  return v_driver;
end;
$$;

create or replace function public.create_contact_verification_request(
  p_role text,
  p_channel text,
  p_target text,
  p_pi_uid text default null,
  p_demo_driver_id text default null,
  p_provider text default null
)
returns public.contact_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.contact_verifications;
begin
  if p_channel not in ('email', 'phone') then
    raise exception 'Invalid verification channel';
  end if;

  update public.contact_verifications
     set status = 'expired',
         updated_at = now()
   where role = p_role
     and channel = p_channel
     and target = p_target
     and status = 'pending';

  insert into public.contact_verifications (
    role,
    channel,
    target,
    pi_uid,
    demo_driver_id,
    provider,
    status,
    expires_at
  )
  values (
    p_role,
    p_channel,
    trim(p_target),
    p_pi_uid,
    p_demo_driver_id,
    p_provider,
    'pending',
    now() + interval '10 minutes'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.mark_driver_contact_verified(
  p_driver_id text,
  p_channel text
)
returns public.demo_drivers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.demo_drivers;
begin
  if p_channel = 'email' then
    update public.demo_drivers
       set email_verified_at = now(),
           updated_at = now()
     where id = p_driver_id
     returning * into v_driver;
  elsif p_channel = 'phone' then
    update public.demo_drivers
       set phone_verified_at = now(),
           updated_at = now()
     where id = p_driver_id
     returning * into v_driver;
  else
    raise exception 'Invalid verification channel';
  end if;

  if not found then
    raise exception 'Driver profile not found';
  end if;

  return v_driver;
end;
$$;

create or replace function public.create_ride_message(
  p_ride_id uuid,
  p_sender_role text,
  p_sender_pi_uid text,
  p_sender_name text,
  p_message_text text
)
returns public.ride_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.ride_messages;
begin
  if p_message_text is null or length(trim(p_message_text)) = 0 then
    raise exception 'Message is required';
  end if;

  insert into public.ride_messages (
    ride_id,
    sender_role,
    sender_pi_uid,
    sender_name,
    message_text
  )
  values (
    p_ride_id,
    p_sender_role,
    p_sender_pi_uid,
    nullif(trim(p_sender_name), ''),
    trim(p_message_text)
  )
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.create_ride_call_event(
  p_ride_id uuid,
  p_caller_role text,
  p_caller_pi_uid text,
  p_callee_role text,
  p_callee_phone text,
  p_call_type text default 'phone'
)
returns public.ride_call_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.ride_call_events;
begin
  insert into public.ride_call_events (
    ride_id,
    caller_role,
    caller_pi_uid,
    callee_role,
    callee_phone,
    call_type,
    call_status
  )
  values (
    p_ride_id,
    p_caller_role,
    p_caller_pi_uid,
    p_callee_role,
    p_callee_phone,
    coalesce(p_call_type, 'phone'),
    'started'
  )
  returning * into v_call;

  return v_call;
end;
$$;

grant execute on function public.get_or_create_pi_driver_profile(text, text) to anon, authenticated;
grant execute on function public.update_pi_driver_contact_profile(text, text, text) to anon, authenticated;
grant execute on function public.create_contact_verification_request(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.mark_driver_contact_verified(text, text) to anon, authenticated;
grant execute on function public.create_ride_message(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.create_ride_call_event(uuid, text, text, text, text, text) to anon, authenticated;

grant select, insert, update on public.user_contact_profiles to anon, authenticated;
grant select, insert, update on public.contact_verifications to anon, authenticated;
grant select, insert on public.ride_messages to anon, authenticated;
grant select, insert, update on public.ride_call_events to anon, authenticated;
