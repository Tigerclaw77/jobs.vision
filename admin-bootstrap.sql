-- jobs.vision admin bootstrap
--
-- Purpose:
--   Promote one existing Supabase Auth user to application admin.
--
-- Usage:
--   1. Create/sign up the admin user first.
--   2. Replace admin@example.com below with the admin user's email.
--   3. Run this in the Supabase SQL editor.
--   4. Log out and back in so the frontend reloads the profile role.

begin;

with target_user as (
  select
    id,
    email,
    raw_user_meta_data
  from auth.users
  where lower(email) = lower('admin@example.com')
  limit 1
)
insert into public.profiles (
  id,
  email,
  role,
  first_name,
  last_name,
  created_at,
  updated_at
)
select
  id,
  email,
  'admin',
  coalesce(raw_user_meta_data->>'firstName', raw_user_meta_data->>'first_name', 'Admin'),
  coalesce(raw_user_meta_data->>'lastName', raw_user_meta_data->>'last_name', ''),
  now(),
  now()
from target_user
on conflict (id) do update
set
  email = excluded.email,
  role = 'admin',
  first_name = coalesce(public.profiles.first_name, excluded.first_name),
  last_name = coalesce(public.profiles.last_name, excluded.last_name),
  updated_at = now();

commit;

select id, email, role, first_name, last_name
from public.profiles
where lower(email) = lower('admin@example.com');
