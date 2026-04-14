alter table public.rides
add column if not exists payment_status text not null default 'unpaid';

alter table public.rides
add column if not exists payment_provider text null;

alter table public.rides
add column if not exists payment_id text null;

alter table public.rides
add column if not exists payment_txid text null;

alter table public.rides
add column if not exists payment_amount_pi numeric(18,8) null;

alter table public.rides
add column if not exists payment_completed_at timestamptz null;

alter table public.rides
drop constraint if exists rides_payment_status_check;

alter table public.rides
add constraint rides_payment_status_check
check (
  payment_status in (
    'unpaid',
    'approved',
    'completed',
    'cancelled',
    'failed'
  )
);
