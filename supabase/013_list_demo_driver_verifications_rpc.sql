create or replace function public.list_demo_driver_verifications()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(v) order by v.updated_at desc),
    '[]'::jsonb
  )
  from public.demo_driver_verifications v;
$$;

grant execute on function public.list_demo_driver_verifications() to anon, authenticated;
