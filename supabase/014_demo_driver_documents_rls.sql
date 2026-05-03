alter table public.demo_driver_documents enable row level security;

drop policy if exists "truego_demo_driver_documents_select" on public.demo_driver_documents;
create policy "truego_demo_driver_documents_select"
on public.demo_driver_documents
for select
to anon, authenticated
using (true);

drop policy if exists "truego_demo_driver_documents_insert" on public.demo_driver_documents;
create policy "truego_demo_driver_documents_insert"
on public.demo_driver_documents
for insert
to anon, authenticated
with check (true);

drop policy if exists "truego_demo_driver_documents_update" on public.demo_driver_documents;
create policy "truego_demo_driver_documents_update"
on public.demo_driver_documents
for update
to anon, authenticated
using (true)
with check (true);

grant select, insert, update on public.demo_driver_documents to anon, authenticated;
