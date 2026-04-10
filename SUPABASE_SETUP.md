# TrueGo Supabase Setup

## Phase 1 goal
Prepare a real backend structure while the UI still runs in local demo mode.

## Apply the schema
1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Run the contents of `supabase/001_truego_core_schema.sql`.

## What this creates
- `user_profiles`
- `driver_profiles`
- `rides`
- starter RLS policies for authenticated users

## Important
This schema is the next foundation for moving TrueGo from local demo storage to real Supabase data.
It is not the final production security model yet.

## Recommended next backend step
After the schema is applied, the next implementation phase is:
1. map rider requests to `rides`
2. map driver availability to `driver_profiles`
3. replace localStorage polling with Supabase realtime subscriptions
4. add Pi auth verification in a backend service
