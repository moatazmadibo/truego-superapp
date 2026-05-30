-- 030_sync_driver_account_status.sql
-- Keep demo_drivers.account_status in sync with admin driver verification decisions.

create or replace function public.sync_driver_account_status_from_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.demo_drivers
     set account_status = case
           when new.verification_status = 'approved' then 'approved'
           when new.verification_status = 'rejected' then 'rejected'
           when new.verification_status = 'needs_more_info' then 'needs_more_info'
           else 'pending'
         end,
         onboarding_status = case
           when new.verification_status = 'approved' then 'approved'
           when new.verification_status = 'rejected' then 'rejected'
           when new.verification_status = 'needs_more_info' then 'needs_more_info'
           else coalesce(onboarding_status, 'submitted')
         end,
         is_available = case
           when new.verification_status = 'approved' then is_available
           else false
         end,
         is_online = case
           when new.verification_status = 'approved' then is_online
           else false
         end,
         updated_at = now()
   where id = new.demo_driver_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_driver_account_status_from_verification
on public.demo_driver_verifications;

create trigger trg_sync_driver_account_status_from_verification
after insert or update of verification_status
on public.demo_driver_verifications
for each row
execute function public.sync_driver_account_status_from_verification();
