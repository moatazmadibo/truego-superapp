-- =========================================================
-- TrueGo Harden Driver Review Notifications
-- Sends in-app notification when Admin changes driver review status
-- through demo_drivers.account_status OR demo_driver_verifications.
-- =========================================================

create or replace function public.notify_driver_review_status_change(
  p_demo_driver_id text,
  p_status text
)
returns void
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
  v_status := lower(trim(coalesce(p_status, '')));
  v_status := replace(v_status, '-', '_');
  v_status := replace(v_status, ' ', '_');

  if v_status in ('verified', 'approve', 'approved') then
    v_status := 'approved';
  elsif v_status in ('need_more_info', 'needs_info', 'need_info', 'more_info', 'needs_more_info') then
    v_status := 'needs_more_info';
  elsif v_status in ('reject', 'rejected', 'denied') then
    v_status := 'rejected';
  end if;

  if v_status not in ('approved', 'needs_more_info', 'rejected') then
    return;
  end if;

  select *
    into v_driver
    from public.demo_drivers
   where id = p_demo_driver_id
   limit 1;

  if not found then
    return;
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
    'driver-review:' || v_driver.id || ':' || v_status || ':' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI')
  );
end;
$$;

create or replace function public.trg_notify_demo_driver_account_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(old.account_status, '') <> coalesce(new.account_status, '') then
    perform public.notify_driver_review_status_change(new.id, new.account_status);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_demo_driver_account_status on public.demo_drivers;

create trigger trg_notify_demo_driver_account_status
after update of account_status on public.demo_drivers
for each row
execute function public.trg_notify_demo_driver_account_status();

create or replace function public.trg_notify_demo_driver_verification_any()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_new_status text;
  v_old_status text;
  v_demo_driver_id text;
begin
  v_new := to_jsonb(new);
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;

  v_new_status := coalesce(
    v_new ->> 'verification_status',
    v_new ->> 'status',
    v_new ->> 'review_status',
    ''
  );

  v_old_status := coalesce(
    v_old ->> 'verification_status',
    v_old ->> 'status',
    v_old ->> 'review_status',
    ''
  );

  v_demo_driver_id := coalesce(
    v_new ->> 'demo_driver_id',
    v_new ->> 'driver_id',
    ''
  );

  if coalesce(v_demo_driver_id, '') = '' then
    return new;
  end if;

  if tg_op = 'INSERT' or coalesce(v_new_status, '') <> coalesce(v_old_status, '') then
    perform public.notify_driver_review_status_change(v_demo_driver_id, v_new_status);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_driver_verification_review on public.demo_driver_verifications;
drop trigger if exists trg_notify_demo_driver_verification_any on public.demo_driver_verifications;

create trigger trg_notify_demo_driver_verification_any
after insert or update on public.demo_driver_verifications
for each row
execute function public.trg_notify_demo_driver_verification_any();

notify pgrst, 'reload schema';
