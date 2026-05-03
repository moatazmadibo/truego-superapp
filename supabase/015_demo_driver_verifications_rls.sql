alter table public.demo_driver_verifications enable row level security;

drop policy if exists "truego_demo_driver_verifications_select" on public.demo_driver_verifications;
create policy "truego_demo_driver_verifications_select"
on public.demo_driver_verifications
for select
to anon, authenticated
using (true);

drop policy if exists "truego_demo_driver_verifications_insert" on public.demo_driver_verifications;
create policy "truego_demo_driver_verifications_insert"
on public.demo_driver_verifications
for insert
to anon, authenticated
with check (true);

drop policy if exists "truego_demo_driver_verifications_update" on public.demo_driver_verifications;
create policy "truego_demo_driver_verifications_update"
on public.demo_driver_verifications
for update
to anon, authenticated
using (true)
with check (true);

grant select, insert, update on public.demo_driver_verifications to anon, authenticated;
