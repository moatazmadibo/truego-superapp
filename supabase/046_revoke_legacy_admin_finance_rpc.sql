-- =========================================================
-- TrueGo Admin Security Phase 4
-- Revoke legacy unprotected admin finance/payout RPCs.
-- Frontend now uses protected admin_* RPCs with admin session token.
-- =========================================================

revoke execute on function public.update_platform_payout_settings(numeric, text, numeric, text)
from anon, authenticated;

revoke execute on function public.update_platform_finance_settings(numeric, text)
from anon, authenticated;

revoke execute on function public.create_business_expense(
  text,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from anon, authenticated;

revoke execute on function public.post_business_expense_accounting(uuid)
from anon, authenticated;

revoke execute on function public.upsert_driver_payout_for_completed_ride(uuid, numeric)
from anon, authenticated;

revoke execute on function public.post_ride_payment_accounting(uuid)
from anon, authenticated;

-- Keep protected RPCs executable by frontend.
grant execute on function public.admin_update_platform_payout_settings(text, numeric, text, numeric)
to anon, authenticated;

grant execute on function public.admin_update_platform_finance_settings(text, numeric)
to anon, authenticated;

grant execute on function public.admin_create_business_expense(
  text,
  text,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text
)
to anon, authenticated;

grant execute on function public.admin_post_business_expense_accounting(text, uuid)
to anon, authenticated;

grant execute on function public.admin_upsert_driver_payout_for_completed_ride(text, uuid, numeric)
to anon, authenticated;

grant execute on function public.admin_post_ride_payment_accounting(text, uuid)
to anon, authenticated;
