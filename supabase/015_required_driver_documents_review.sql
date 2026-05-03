alter table public.demo_driver_documents
  drop constraint if exists demo_driver_documents_document_type_check;

alter table public.demo_driver_documents
  add constraint demo_driver_documents_document_type_check
  check (
    document_type in (
      'national_id',
      'national_id_front',
      'national_id_back',
      'driving_license',
      'vehicle_license',
      'vehicle_photo',
      'profile_photo',
      'other'
    )
  );

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
  required_documents text[] := array[
    'national_id_front',
    'national_id_back',
    'driving_license',
    'vehicle_license',
    'vehicle_photo',
    'profile_photo'
  ];
  missing_documents text[];
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

  if p_verification_status = 'approved' then
    select array_agg(required_document)
    into missing_documents
    from unnest(required_documents) as required_document
    where not exists (
      select 1
      from public.demo_driver_documents d
      where d.demo_driver_id = p_demo_driver_id
        and d.document_type = required_document
    );

    if coalesce(array_length(missing_documents, 1), 0) > 0 then
      raise exception 'Missing required documents: %', array_to_string(missing_documents, ', ');
    end if;
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
          else null
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
