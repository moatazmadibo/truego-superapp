create table if not exists public.demo_driver_documents (
  id uuid primary key default gen_random_uuid(),
  demo_driver_id text not null,
  driver_name text not null,
  document_type text not null,
  file_path text not null,
  file_name text null,
  mime_type text null,
  file_size integer null,
  status text not null default 'pending',
  admin_notes text null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz null
);

alter table public.demo_driver_documents
  drop constraint if exists demo_driver_documents_document_type_check;

alter table public.demo_driver_documents
  add constraint demo_driver_documents_document_type_check
  check (
    document_type in (
      'national_id',
      'driving_license',
      'vehicle_license',
      'vehicle_photo',
      'profile_photo',
      'other'
    )
  );

alter table public.demo_driver_documents
  drop constraint if exists demo_driver_documents_status_check;

alter table public.demo_driver_documents
  add constraint demo_driver_documents_status_check
  check (
    status in (
      'pending',
      'approved',
      'rejected',
      'needs_more_info'
    )
  );

create index if not exists idx_demo_driver_documents_demo_driver_id
  on public.demo_driver_documents(demo_driver_id);

create index if not exists idx_demo_driver_documents_status
  on public.demo_driver_documents(status);

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;

grant select, insert, update on public.demo_driver_documents to anon, authenticated;

drop policy if exists "truego_driver_documents_select" on storage.objects;
create policy "truego_driver_documents_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'driver-documents');

drop policy if exists "truego_driver_documents_insert" on storage.objects;
create policy "truego_driver_documents_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'driver-documents');

drop policy if exists "truego_driver_documents_update" on storage.objects;
create policy "truego_driver_documents_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'driver-documents')
with check (bucket_id = 'driver-documents');
