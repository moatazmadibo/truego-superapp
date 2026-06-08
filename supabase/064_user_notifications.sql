-- =========================================================
-- TrueGo In-App Notifications
-- Phase 1: notification center for Rider/Driver + admin-triggered driver review notifications.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  target_app text not null check (target_app in ('rider', 'driver', 'admin', 'all')),
  target_pi_uid text,
  target_pi_username text,
  target_demo_driver_id text,
  title text not null,
  body text not null,
  notification_type text not null default 'info',
  action_url text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_target_app
on public.user_notifications (target_app, created_at desc);

create index if not exists idx_user_notifications_pi_uid
on public.user_notifications (target_pi_uid, created_at desc);

create index if not exists idx_user_notifications_demo_driver
on public.user_notifications (target_demo_driver_id, created_at desc);

create unique index if not exists idx_user_notifications_dedupe_key
on public.user_notifications (dedupe_key)
where dedupe_key is not null;

create or replace function public.upsert_user_notification(
  p_target_app text,
  p_target_pi_uid text,
  p_target_pi_username text,
  p_target_demo_driver_id text,
  p_title text,
  p_body text,
  p_notification_type text default 'info',
  p_action_url text default null,
  p_dedupe_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_id uuid;
begin
  if p_target_app not in ('rider', 'driver', 'admin', 'all') then
    raise exception 'Invalid target app';
  end if;

  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'Notification title and body are required';
  end if;

  if coalesce(trim(p_dedupe_key), '') <> '' then
    select id
      into v_existing_id
      from public.user_notifications
     where dedupe_key = p_dedupe_key
     limit 1;

    if v_existing_id is not null then
      return jsonb_build_object('ok', true, 'id', v_existing_id, 'created', false);
    end if;
  end if;

  insert into public.user_notifications (
    target_app,
    target_pi_uid,
    target_pi_username,
    target_demo_driver_id,
    title,
    body,
    notification_type,
    action_url,
    dedupe_key
  )
  values (
    p_target_app,
    nullif(trim(coalesce(p_target_pi_uid, '')), ''),
    nullif(trim(coalesce(p_target_pi_username, '')), ''),
    nullif(trim(coalesce(p_target_demo_driver_id, '')), ''),
    trim(p_title),
    trim(p_body),
    coalesce(nullif(trim(p_notification_type), ''), 'info'),
    nullif(trim(coalesce(p_action_url, '')), ''),
    nullif(trim(coalesce(p_dedupe_key, '')), '')
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'created', true);
end;
$$;

create or replace function public.list_user_notifications(
  p_target_app text,
  p_pi_uid text default null,
  p_pi_username text default null,
  p_demo_driver_id text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  target_app text,
  title text,
  body text,
  notification_type text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    n.id,
    n.target_app,
    n.title,
    n.body,
    n.notification_type,
    n.action_url,
    n.read_at,
    n.created_at
  from public.user_notifications n
  where (n.target_app = p_target_app or n.target_app = 'all')
    and (
      (coalesce(p_demo_driver_id, '') <> '' and n.target_demo_driver_id = p_demo_driver_id)
      or (coalesce(p_pi_uid, '') <> '' and n.target_pi_uid = p_pi_uid)
      or (
        coalesce(p_pi_username, '') <> ''
        and lower(coalesce(n.target_pi_username, '')) = lower(p_pi_username)
      )
    )
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end;
$$;

create or replace function public.mark_user_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_notifications
     set read_at = coalesce(read_at, now())
   where id = p_notification_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.notify_driver_verification_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver public.demo_drivers;
  v_status text;
  v_title text;
  v_body text;
begin
  v_status := lower(coalesce(new.verification_status, ''));

  if tg_op = 'UPDATE' and coalesce(old.verification_status, '') = coalesce(new.verification_status, '') then
    return new;
  end if;

  if v_status not in ('approved', 'needs_more_info', 'rejected') then
    return new;
  end if;

  select *
    into v_driver
    from public.demo_drivers
   where id = new.demo_driver_id
   limit 1;

  if not found then
    return new;
  end if;

  if v_status = 'approved' then
    v_title := 'Driver account approved';
    v_body := 'Your TrueGo Driver account has been approved. You can now go online and receive ride requests.';
  elsif v_status = 'needs_more_info' then
    v_title := 'More information required';
    v_body := 'Admin needs more information. Please complete your driver profile, vehicle details, documents, and payout wallet.';
  else
    v_title := 'Driver verification rejected';
    v_body := 'Your driver verification was rejected. Please review your information and contact support if needed.';
  end if;

  perform public.upsert_user_notification(
    'driver',
    v_driver.pi_uid,
    v_driver.pi_username,
    v_driver.id,
    v_title,
    v_body,
    'driver_verification',
    '#driver-verification',
    'driver-review:' || new.demo_driver_id || ':' || v_status || ':' || extract(epoch from now())::bigint::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_driver_verification_review on public.demo_driver_verifications;

create trigger trg_notify_driver_verification_review
after insert or update of verification_status on public.demo_driver_verifications
for each row
execute function public.notify_driver_verification_review();

grant execute on function public.upsert_user_notification(text, text, text, text, text, text, text, text, text)
to anon, authenticated;

grant execute on function public.list_user_notifications(text, text, text, text, integer)
to anon, authenticated;

grant execute on function public.mark_user_notification_read(uuid)
to anon, authenticated;

notify pgrst, 'reload schema';
