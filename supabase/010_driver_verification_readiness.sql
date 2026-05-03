-- TrueGo driver verification / KYC readiness.
-- Safe upgrade for existing driver_documents table.

alter table public.drivers
  add column if not exists verification_status text not null default 'pending';

alter table public.drivers
  add column if not exists verified_at timestamptz null;

alter table public.drivers
  add column if not exists admin_review_notes text null;

alter table public.drivers
  drop constraint if exists drivers_verification_status_check;

alter table public.drivers
  add constraint drivers_verification_status_check
  check (
    verification_status in (
      'pending',
      'submitted',
      'approved',
      'rejected',
      'needs_more_info'
    )
  );

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid null,
  document_type text not null default 'other',
  file_path text not null default '',
  file_name text null,
  mime_type text null,
  file_size integer null,
  status text not null default 'pending',
  admin_notes text null,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz null
);

alter table public.driver_documents
  add column if not exists driver_id uuid null;

alter table public.driver_documents
  add column if not exists document_type text not null default 'other';

alter table public.driver_documents
  add column if not exists file_path text not null default '';

alter table public.driver_documents
  add column if not exists file_name text null;

alter table public.driver_documents
  add column if not exists mime_type text null;

alter table public.driver_documents
  add column if not exists file_size integer null;

alter table public.driver_documents
  add column if not exists status text not null default 'pending';

alter table public.driver_documents
  add column if not exists admin_notes text null;

alter table public.driver_documents
  add column if not exists uploaded_at timestamptz not null default now();

alter table public.driver_documents
  add column if not exists reviewed_at timestamptz null;

alter table public.driver_documents
  drop constraint if exists driver_documents_status_check;

alter table public.driver_documents
  add constraint driver_documents_status_check
  check (
    status in (
      'pending',
      'approved',
      'rejected',
      'needs_more_info'
    )
  );

alter table public.driver_documents
  drop constraint if exists driver_documents_document_type_check;

alter table public.driver_documents
  add constraint driver_documents_document_type_check
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

create index if not exists idx_driver_documents_driver_id
  on public.driver_documents(driver_id);

create index if not exists idx_driver_documents_status
  on public.driver_documents(status);

create index if not exists idx_drivers_verification_status
  on public.drivers(verification_status);

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do nothing;
