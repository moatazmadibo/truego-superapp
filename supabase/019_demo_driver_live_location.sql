alter table public.demo_drivers
  add column if not exists current_lat numeric null;

alter table public.demo_drivers
  add column if not exists current_lng numeric null;

alter table public.demo_drivers
  add column if not exists location_updated_at timestamptz null;

alter table public.demo_drivers
  add column if not exists heading numeric null;

alter table public.demo_drivers
  add column if not exists speed_kph numeric null;

create or replace function public.update_demo_driver_live_location(
  p_driver_id text,
  p_lat numeric,
  p_lng numeric,
  p_heading numeric default null,
  p_speed_kph numeric default null
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
    current_lat = p_lat,
    current_lng = p_lng,
    location_updated_at = now(),
    heading = p_heading,
    speed_kph = p_speed_kph,
    is_online = true,
    last_seen_at = now(),
    updated_at = now()
  where id = p_driver_id;

  select to_jsonb(d)
  into result
  from public.demo_drivers d
  where d.id = p_driver_id;

  return result;
end;
$$;

grant execute on function public.update_demo_driver_live_location(text, numeric, numeric, numeric, numeric)
to anon, authenticated;

grant select, update on public.demo_drivers to anon, authenticated;
