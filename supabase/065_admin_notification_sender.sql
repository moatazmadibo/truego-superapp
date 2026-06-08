-- =========================================================
-- TrueGo Admin Notification Sender
-- Tracks app users and allows protected admin notification sending.
-- =========================================================

create table if not exists public.app_user_profiles (
  id uuid primary key default gen_random_uuid(),
  target_app text not null check (target_app in ('rider', 'driver')),
  pi_uid text,
  pi_username text,
  demo_driver_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists idx_app_user_profiles_identity
on public.app_user_profiles (
  target_app,
  coalesce(pi_uid, ''),
  lower(coalesce(pi_username, '')),
  coalesce(demo_driver_id, '')
);

create index if not exists idx_app_user_profiles_app_seen
on public.app_user_profiles (target_app, last_seen_at desc);

create or replace function public.register_app_user_profile(
  p_target_app text,
  p_pi_uid text default null,
  p_pi_username text default null,
  p_demo_driver_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_target_app not in ('rider', 'driver') then
    raise exception 'Invalid target app';
  end if;

  if coalesce(p_pi_uid, '') = ''
     and coalesce(p_pi_username, '') = ''
     and coalesce(p_demo_driver_id, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_identity');
  end if;

  insert into public.app_user_profiles (
    target_app,
    pi_uid,
    pi_username,
    demo_driver_id,
    first_seen_at,
    last_seen_at
  )
  values (
    p_target_app,
    nullif(trim(coalesce(p_pi_uid, '')), ''),
    nullif(trim(coalesce(p_pi_username, '')), ''),
    nullif(trim(coalesce(p_demo_driver_id, '')), ''),
    now(),
    now()
  )
  on conflict (
    target_app,
    coalesce(pi_uid, ''),
    lower(coalesce(pi_username, '')),
    coalesce(demo_driver_id, '')
  )
  do update set
    last_seen_at = now(),
    pi_uid = coalesce(excluded.pi_uid, app_user_profiles.pi_uid),
    pi_username = coalesce(excluded.pi_username, app_user_profiles.pi_username),
    demo_driver_id = coalesce(excluded.demo_driver_id, app_user_profiles.demo_driver_id)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_send_user_notification(
  p_admin_session_token text,
  p_target_app text,
  p_target_pi_uid text,
  p_target_pi_username text,
  p_target_demo_driver_id text,
  p_title text,
  p_body text,
  p_notification_type text,
  p_action_url text,
  p_broadcast boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_sent_count integer := 0;
  v_notification_id uuid;
  v_user record;
begin
  v_session_id := public.assert_valid_admin_session(p_admin_session_token);

  if p_target_app not in ('rider', 'driver', 'all') then
    raise exception 'Invalid target app';
  end if;

  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'Title and body are required';
  end if;

  if p_broadcast then
    for v_user in
      select *
      from public.app_user_profiles
      where p_target_app = 'all' or target_app = p_target_app
      order by last_seen_at desc
    loop
      insert into public.user_notifications (
        target_app,
        target_pi_uid,
        target_pi_username,
        target_demo_driver_id,
        title,
        body,
        notification_type,
        action_url
      )
      values (
        v_user.target_app,
        v_user.pi_uid,
        v_user.pi_username,
        v_user.demo_driver_id,
        trim(p_title),
        trim(p_body),
        coalesce(nullif(trim(p_notification_type), ''), 'admin_message'),
        nullif(trim(coalesce(p_action_url, '')), '')
      );

      v_sent_count := v_sent_count + 1;
    end loop;
  else
    if coalesce(p_target_pi_uid, '') = ''
       and coalesce(p_target_pi_username, '') = ''
       and coalesce(p_target_demo_driver_id, '') = '' then
      raise exception 'Target identity is required unless broadcast is enabled';
    end if;

    insert into public.user_notifications (
      target_app,
      target_pi_uid,
      target_pi_username,
      target_demo_driver_id,
      title,
      body,
      notification_type,
      action_url
    )
    values (
      case when p_target_app = 'all' then 'driver' else p_target_app end,
      nullif(trim(coalesce(p_target_pi_uid, '')), ''),
      nullif(trim(coalesce(p_target_pi_username, '')), ''),
      nullif(trim(coalesce(p_target_demo_driver_id, '')), ''),
      trim(p_title),
      trim(p_body),
      coalesce(nullif(trim(p_notification_type), ''), 'admin_message'),
      nullif(trim(coalesce(p_action_url, '')), '')
    )
    returning id into v_notification_id;

    v_sent_count := 1;
  end if;

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
    'ADMIN_SEND_USER_NOTIFICATION',
    'user_notifications',
    coalesce(v_notification_id::text, 'broadcast'),
    'Admin sent in-app notification.',
    jsonb_build_object(
      'target_app', p_target_app,
      'broadcast', p_broadcast,
      'sent_count', v_sent_count,
      'title', p_title,
      'action_url', p_action_url
    )
  );

  return jsonb_build_object(
    'ok', true,
    'sent_count', v_sent_count
  );
end;
$$;

grant execute on function public.register_app_user_profile(text, text, text, text)
to anon, authenticated;

grant execute on function public.admin_send_user_notification(text, text, text, text, text, text, text, text, text, boolean)
to anon, authenticated;

notify pgrst, 'reload schema';
