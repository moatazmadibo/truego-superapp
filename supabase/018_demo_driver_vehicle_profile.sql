alter table public.demo_drivers
  add column if not exists vehicle_make text null;

alter table public.demo_drivers
  add column if not exists vehicle_model text null;

alter table public.demo_drivers
  add column if not exists vehicle_color text null;

alter table public.demo_drivers
  add column if not exists vehicle_plate text null;

alter table public.demo_drivers
  add column if not exists vehicle_year integer null;

alter table public.demo_drivers
  add column if not exists vehicle_license_expires_at date null;

alter table public.demo_drivers
  drop constraint if exists demo_drivers_vehicle_year_check;

alter table public.demo_drivers
  add constraint demo_drivers_vehicle_year_check
  check (
    vehicle_year is null
    or vehicle_year between 1980 and 2100
  );

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
  p_vehicle_license_expires_at date default null
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
grant execute on function public.update_demo_driver_vehicle_profile(text, text, text, text, text, integer, date) to anon, authenticated;

grant select, update on public.demo_drivers to anon, authenticated;
