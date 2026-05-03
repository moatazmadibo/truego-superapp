create table if not exists public.demo_driver_verifications (
  demo_driver_id text primary key,
  driver_name text not null,
  verification_status text not null default 'pending',
  admin_review_notes text null,
  submitted_at timestamptz null,
  verified_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.demo_driver_verifications
  drop constraint if exists demo_driver_verifications_status_check;

alter table public.demo_driver_verifications
  add constraint demo_driver_verifications_status_check
  check (
    verification_status in (
      'pending',
      'submitted',
      'approved',
      'rejected',
      'needs_more_info'
    )
  );

create index if not exists idx_demo_driver_verifications_status
  on public.demo_driver_verifications(verification_status);

create or replace function public.get_demo_driver_verification(
  p_demo_driver_id text,
  p_driver_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  insert into public.demo_driver_verifications (
    demo_driver_id,
    driver_name,
    verification_status,
    updated_at
  )
  values (
    p_demo_driver_id,
    coalesce(nullif(p_driver_name, ''), p_demo_driver_id),
    'pending',
    now()
  )
  on conflict (demo_driver_id) do update
    set driver_name = excluded.driver_name,
        updated_at = now();

  select to_jsonb(v)
  into result
  from public.demo_driver_verifications v
  where v.demo_driver_id = p_demo_driver_id;

  return result;
end;
$$;

create or replace function public.submit_demo_driver_verification(
  p_demo_driver_id text,
  p_driver_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  insert into public.demo_driver_verifications (
    demo_driver_id,
    driver_name,
    verification_status,
    admin_review_notes,
    submitted_at,
    updated_at
  )
  values (
    p_demo_driver_id,
    coalesce(nullif(p_driver_name, ''), p_demo_driver_id),
    'submitted',
    'Driver submitted verification request from TrueGo driver portal.',
    now(),
    now()
  )
  on conflict (demo_driver_id) do update
    set driver_name = excluded.driver_name,
        verification_status = 'submitted',
        admin_review_notes = coalesce(
          public.demo_driver_verifications.admin_review_notes,
          'Driver submitted verification request from TrueGo driver portal.'
        ),
        submitted_at = coalesce(public.demo_driver_verifications.submitted_at, now()),
        updated_at = now();

  select to_jsonb(v)
  into result
  from public.demo_driver_verifications v
  where v.demo_driver_id = p_demo_driver_id;

  return result;
end;
$$;

grant execute on function public.get_demo_driver_verification(text, text) to anon, authenticated;
grant execute on function public.submit_demo_driver_verification(text, text) to anon, authenticated;
