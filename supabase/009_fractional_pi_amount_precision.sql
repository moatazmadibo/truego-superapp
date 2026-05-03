-- Preserve fractional Test-Pi amounts for listing/demo payments.
-- These columns must support 8 decimal places.

alter table public.rides
  alter column price_pi type numeric(18,8)
  using price_pi::numeric(18,8);

alter table public.rides
  alter column driver_payout_pi type numeric(18,8)
  using driver_payout_pi::numeric(18,8);

alter table public.rides
  alter column payment_amount_pi type numeric(18,8)
  using payment_amount_pi::numeric(18,8);
