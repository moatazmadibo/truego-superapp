-- =========================================================
-- TrueGo Driver Verification Approval Hardening
-- 1) Cascade approved driver review to uploaded documents
-- 2) Prepare demo driver profile for license expiry + profile photo
-- =========================================================

alter table public.demo_drivers
add column if not exists driver_license_expires_at date null;

alter table public.demo_drivers
add column if not exists profile_photo_path text null;

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
  missing_documents text[] := array[]::text[];
  has_national_id_front boolean;
  has_national_id_back boolean;
  has_passport boolean;
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
    select exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'national_id_front'
    )
    into has_national_id_front;

    select exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'national_id_back'
    )
    into has_national_id_back;

    select exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'passport'
    )
    into has_passport;

    if not has_passport and not (has_national_id_front and has_national_id_back) then
      missing_documents := array_append(
        missing_documents,
        'identity_proof: upload passport OR both national_id_front and national_id_back'
      );
    end if;

    if not exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'driving_license'
    ) then
      missing_documents := array_append(missing_documents, 'driving_license');
    end if;

    if not exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'vehicle_license'
    ) then
      missing_documents := array_append(missing_documents, 'vehicle_license');
    end if;

    if not exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'vehicle_photo'
    ) then
      missing_documents := array_append(missing_documents, 'vehicle_photo');
    end if;

    if not exists (
      select 1 from public.demo_driver_documents
      where demo_driver_id = p_demo_driver_id
        and document_type = 'profile_photo'
    ) then
      missing_documents := array_append(missing_documents, 'profile_photo');
    end if;

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

  -- عند اعتماد السائق، اعتمد كل مستنداته المرفوعة تلقائيًا
  if p_verification_status = 'approved' then
    update public.demo_driver_documents
    set
      status = 'approved',
      reviewed_at = now(),
      admin_notes = coalesce(
        admin_notes,
        'Approved automatically after driver verification approval.'
      )
    where demo_driver_id = p_demo_driver_id
      and status <> 'approved';
  end if;

  -- عند الرفض أو طلب معلومات إضافية، لا نحذف المستندات، فقط نضع حالتها للمراجعة
  if p_verification_status = 'rejected' then
    update public.demo_driver_documents
    set
      status = 'rejected',
      reviewed_at = now(),
      admin_notes = coalesce(admin_notes, p_admin_review_notes)
    where demo_driver_id = p_demo_driver_id
      and status <> 'rejected';
  end if;

  if p_verification_status = 'needs_more_info' then
    update public.demo_driver_documents
    set
      status = 'needs_more_info',
      reviewed_at = now(),
      admin_notes = coalesce(admin_notes, p_admin_review_notes)
    where demo_driver_id = p_demo_driver_id
      and status <> 'needs_more_info';
  end if;

  select to_jsonb(v)
  into result
  from public.demo_driver_verifications v
  where v.demo_driver_id = p_demo_driver_id;

  return result;
end;
$$;

grant execute on function public.review_demo_driver_verification(text, text, text) to anon, authenticated;
