# jobs.vision Authentication and Authorization Flow

## Source of Truth

`AuthProvider` is the only source of truth for live authentication state.

The flow is:

1. Neon Auth session is loaded by `frontend/src/components/auth/AuthProvider.jsx`.
2. `AuthProvider` calls `GET /api/auth/me` with the Neon access token.
3. `/api/auth/me` returns the application account/profile role.
4. `ProtectedRoute` authorizes routes from that authenticated role.
5. Legacy Redux auth state may cache profile details for older components, but it must not decide whether a user is signed in.

## Role Terms

Authenticated role:
The real role returned by AuthProvider and `/api/auth/me`.

Preview role:
The temporary Admin View Mode role used to preview candidate, recruiter, or guest presentation.

Authorization role:
The authenticated role used by `ProtectedRoute`. Preview role is never used for route authorization.

## Public Auth Pages

`PublicOnlyRoute` wraps `/login`, registration, and password reset entry pages.

If a real session exists, public auth pages redirect away immediately. An authenticated user should never see the login page, even when Admin View Mode is set to Guest.

## Protected Routes

`frontend/src/ProtectedRoute.jsx`:

- waits for AuthProvider session/profile loading
- redirects signed-out users to `/login?next=...`
- redirects signed-in users without a role to `/unauthorized`
- authorizes using authenticated role only
- lets real admins access admin routes regardless of Admin View Mode

## Unauthorized Diagnostics

`/unauthorized` displays:

- signed-in email
- detected role
- required role
- evaluated route
- authorization result

This makes role mismatches visible instead of sending users through login loops.

## Admin Diagnostics Panel

Real admins see an `Auth diagnostics` panel in the app. It shows the latest protected-route evaluation:

- authenticated user id
- authenticated email
- authenticated role
- route being evaluated
- required role(s)
- required tier(s)
- authorization result

The panel is visible only when the authenticated role is `admin`.

## Admin View Mode

Admin View Mode affects presentation through `useEffectiveAuth()`.

It can preview:

- guest
- candidate free/plus/premium
- recruiter staff/manager/doctor
- admin

It does not modify database roles, profile rows, subscriptions, or route authorization. A real admin remains authorized as admin even while previewing guest or recruiter UI.
