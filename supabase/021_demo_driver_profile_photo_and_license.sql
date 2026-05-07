-- =========================================================
-- TrueGo Demo Driver Profile Photo + Driver License Expiry
-- =========================================================

alter table public.demo_drivers
add column if not exists driver_license_expires_at date null;

alter table public.demo_drivers
add column if not exists profile_photo_path text null;

create or replace function public.get_demo_driver_vehicle_profile(
  p_driver_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select to_jsonb(d)
  into result
  from public.demo_drivers d
  where d.id = p_driver_id;

  return result;
end;
$$;

create or replace function public.update_demo_driver_vehicle_profile(
  p_driver_id text,
  p_vehicle_make text default null,
  p_vehicle_model text default null,
  p_vehicle_color text default null,
  p_vehicle_plate text default null,
  p_vehicle_year integer default null,
  p_vehicle_license_expires_at date default null,
  p_driver_license_expires_at date default null,
  p_profile_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  update public.demo_drivers
  set
    vehicle_make = nullif(trim(coalesce(p_vehicle_make, '')), ''),
    vehicle_model = nullif(trim(coalesce(p_vehicle_model, '')), ''),
    vehicle_color = nullif(trim(coalesce(p_vehicle_color, '')), ''),
    vehicle_plate = nullif(trim(coalesce(p_vehicle_plate, '')), ''),
    vehicle_year = p_vehicle_year,
    vehicle_license_expires_at = p_vehicle_license_expires_at,
    driver_license_expires_at = p_driver_license_expires_at,
    profile_photo_path = nullif(trim(coalesce(p_profile_photo_path, '')), ''),
    updated_at = now()
  where id = p_driver_id;

  select to_jsonb(d)
  into result
  from public.demo_drivers d
  where d.id = p_driver_id;

  return result;
end;
$$;

grant execute on function public.get_demo_driver_vehicle_profile(text) to anon, authenticated;
grant execute on function public.update_demo_driver_vehicle_profile(text, text, text, text, text, integer, date, date, text) to anon, authenticated;

grant select, update on public.demo_drivers to anon, authenticated;
