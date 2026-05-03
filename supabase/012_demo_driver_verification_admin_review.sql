create or replace function public.review_demo_driver_verification(
  p_demo_driver_id text,
  p_verification_status text,
  p_admin_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_verification_status not in (
    'pending',
    'submitted',
    'approved',
    'rejected',
    'needs_more_info'
  ) then
    raise exception 'Invalid verification status: %', p_verification_status;
  end if;

  insert into public.demo_driver_verifications (
    demo_driver_id,
    driver_name,
    verification_status,
    admin_review_notes,
    verified_at,
    updated_at
  )
  values (
    p_demo_driver_id,
    p_demo_driver_id,
    p_verification_status,
    p_admin_review_notes,
    case when p_verification_status = 'approved' then now() else null end,
    now()
  )
  on conflict (demo_driver_id) do update
    set verification_status = excluded.verification_status,
        admin_review_notes = excluded.admin_review_notes,
        verified_at = case
          when excluded.verification_status = 'approved' then now()
          else public.demo_driver_verifications.verified_at
        end,
        updated_at = now();

  select to_jsonb(v)
  into result
  from public.demo_driver_verifications v
  where v.demo_driver_id = p_demo_driver_id;

  return result;
end;
$$;

grant execute on function public.review_demo_driver_verification(text, text, text) to anon, authenticated;

grant select, insert, update on public.demo_driver_verifications to anon, authenticated;
