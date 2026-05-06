alter table public.rides
  add column if not exists route_source text null;

alter table public.rides
  drop constraint if exists rides_route_source_check;

alter table public.rides
  add constraint rides_route_source_check
  check (
    route_source is null
    or route_source in ('osrm', 'fallback')
  );

create index if not exists idx_rides_route_source
  on public.rides(route_source);
