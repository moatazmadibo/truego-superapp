-- =========================================================
-- TrueGo Payout Settings Read RPC
-- Makes Admin payout settings loading reliable from frontend.
-- =========================================================

create or replace function public.get_platform_payout_settings()
returns public.platform_payout_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.platform_payout_settings;
begin
  select *
  into v_settings
  from public.platform_payout_settings
  where id = 'truego';

  if not found then
    insert into public.platform_payout_settings (id)
    values ('truego')
    returning * into v_settings;
  end if;

  return v_settings;
end;
$$;

grant execute on function public.get_platform_payout_settings()
  to anon, authenticated;
