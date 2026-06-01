-- jobs.vision admin bootstrap
--
-- Purpose:
--   Promote one existing Neon Auth user to application admin.
--
-- Usage:
--   1. Create/sign up the admin user first.
--   2. Replace admin@example.com below with the admin user's email.
--   3. Run this against the Neon database.
--   4. Log out and back in so the frontend reloads the profile role.

begin;

with target_user as (
  select
    id,
    email,
    name
  from neon_auth."user"
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
  coalesce(nullif(split_part(name, ' ', 1), ''), 'Admin'),
  case
    when position(' ' in name) > 0 then nullif(trim(substr(name, position(' ' in name) + 1)), '')
    else ''
  end,
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
