# Admin Bootstrap

Use this only after the admin user already exists in Supabase Auth.

## Steps

1. Sign up the intended admin user through the app or create the user in Supabase Auth.
2. Confirm the user's email if email confirmation is enabled.
3. Open `admin-bootstrap.sql`.
4. Replace `admin@example.com` with the exact admin email.
5. Run the script in the Supabase SQL editor.
6. Confirm the result row shows `role = admin`.
7. Have the user log out and back in so the frontend reloads `/api/auth/me` and route guards.

## Why This Is Needed

Admin authorization is based on `public.profiles.role`. Supabase Auth metadata alone is not enough for the active backend admin checks.

Relevant backend checks:

- `backend/middleware/requireAdmin.js`
- `backend/routes/admin.js`
- `backend/routes/users.js`
- `backend/routes/manualOverrides.js`

## Verification SQL

```sql
select id, email, role, first_name, last_name
from public.profiles
where lower(email) = lower('admin@example.com');
```

The expected role is `admin`.
