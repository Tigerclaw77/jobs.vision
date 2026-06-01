# jobs.vision Neon Environment Audit

Scope: full repository scan excluding dependency/build folders. Active runtime was determined from `backend/server.js` route mounts and `frontend/src/App.js` imports. Files under `z-archive`, `frontend/lib`, unmounted backend routes, and unimported Supabase client files are classified as legacy/unused unless an active entry point imports them.

## Minimum Variables Needed To Boot jobs.vision On Neon

For a first local startup test with Neon Database and Neon Auth:

Backend:

| Variable | Required for startup | Source | Why |
|---|---:|---|---|
| `DATABASE_URL` | Yes | Neon Dashboard | `backend/services/db.js` throws at import time without it. |
| `NEON_AUTH_JWKS_URL` | No for process boot, yes for protected API routes | Neon Auth/JWKS settings | Backend JWT verifier needs it for login-protected routes. |
| `PORT` | No | Manual local choice | Defaults to `5000`; set for clarity. |
| `FRONTEND_URL` | No | Manual local choice | CORS allowlist already includes localhost, but set for parity. |
| `APP_URL` | No | Manual local choice | Used for domain verification redirect URL fallback. |
| `PUBLIC_API_URL` | No | Manual local choice | Used to build domain verification email links. |

Frontend:

| Variable | Required for startup | Source | Why |
|---|---:|---|---|
| `REACT_APP_NEON_AUTH_URL` | No for static build, yes for auth flows | Neon Auth dashboard | Frontend Neon Auth client needs it for register/login/session. |
| `REACT_APP_API_URL` | No | Manual local choice | Defaults to `http://localhost:5000/api`; set explicitly for first test. |

Recommended first `.env` values to set before testing login and protected routes:

```dotenv
# backend/.env
DATABASE_URL=
NEON_AUTH_JWKS_URL=
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:5000

# frontend/.env
REACT_APP_NEON_AUTH_URL=
REACT_APP_API_URL=http://localhost:5000/api
```

## Active Backend Variables

| Variable | Category | Files | What it does | Required for startup |
|---|---|---|---|---:|
| `DATABASE_URL` | Required for Neon Database; Required for local startup | `backend/services/db.js`, `backend/server.js` | Neon/Postgres connection string used by the shared `pg` Pool. | Yes |
| `PGSSLMODE` | Optional; Neon Database | `backend/services/db.js` | Allows disabling SSL when set to `disable`; normally leave unset for Neon. | No |
| `PGSSL` | Optional; Neon Database | `backend/services/db.js` | Allows disabling SSL when set to `false`; normally leave unset for Neon. | No |
| `PGPOOL_MAX` | Optional; Neon Database | `backend/services/db.js` | Sets max `pg` pool size; defaults to `10`. | No |
| `NEON_AUTH_JWKS_URL` | Required for Neon Auth | `backend/services/neonAuthVerifier.js` | Preferred JWKS endpoint for verifying Neon Auth JWT signatures. | No |
| `NEON_AUTH_JWKS_URI` | Required for Neon Auth; optional alias | `backend/services/neonAuthVerifier.js` | Alias fallback for the JWKS endpoint. | No |
| `NEON_JWKS_URL` | Required for Neon Auth; optional alias | `backend/services/neonAuthVerifier.js` | Alias fallback for the JWKS endpoint. | No |
| `NEON_AUTH_ISSUER` | Optional; Neon Auth | `backend/services/neonAuthVerifier.js` | Optional JWT issuer check. | No |
| `NEON_AUTH_AUDIENCE` | Optional; Neon Auth | `backend/services/neonAuthVerifier.js` | Optional JWT audience check. | No |
| `PORT` | Optional | `backend/server.js` | Express listen port; defaults to `5000`. | No |
| `NODE_ENV` | Required for Stripe safety; optional for startup | `backend/server.js` | Blocks `STRIPE_SKIP_VERIFY=true` in production. | No |
| `FRONTEND_URL` | Optional | `backend/server.js`, `backend/routes/recruiterDomains.js` | Adds CORS origin and acts as a redirect fallback. | No |
| `APP_URL` | Optional | `backend/routes/recruiterDomains.js` | Redirect target after domain verification. Defaults to `FRONTEND_URL` or localhost. | No |
| `PUBLIC_API_URL` | Optional | `backend/routes/recruiterDomains.js` | Public base URL for verification links sent by email. Defaults to localhost backend. | No |
| `SMTP_HOST` | Required for email | `backend/services/email.js` | SMTP server host. Without it, email sends are skipped. | No |
| `SMTP_PORT` | Required for email; optional default | `backend/services/email.js` | SMTP port; defaults to `587`. | No |
| `SMTP_SECURE` | Required for email; optional default | `backend/services/email.js` | Forces TLS mode when `true`; also true automatically for port `465`. | No |
| `SMTP_USER` | Required for email when SMTP auth is needed | `backend/services/email.js` | SMTP username and fallback sender. | No |
| `SMTP_PASS` | Required for email when SMTP auth is needed | `backend/services/email.js` | SMTP password or app password. | No |
| `SMTP_FROM` | Required for email unless using `SMTP_USER` as sender | `backend/services/email.js` | Sender address. | No |
| `HCAPTCHA_SECRET` | Required for hCaptcha | `backend/routes/manualOverrides.js`, `backend/services/hcaptcha.js` | Server-side verification secret for manual override submissions. | No |
| `STRIPE_SECRET_KEY` | Required for Stripe | `backend/server.js` | Enables Stripe webhook route and API client. If absent, webhook route is disabled. | No |
| `STRIPE_WEBHOOK_SECRET` | Required for Stripe | `backend/server.js` | Verifies Stripe webhook signatures when skip verify is false. | No |
| `STRIPE_SKIP_VERIFY` | Optional; Stripe | `backend/server.js` | Dev-only bypass for webhook signature verification. Must not be `true` in production. | No |
| `SUPABASE_URL` | Optional; active Supabase Storage | `backend/services/supaClient.js`, `backend/routes/manualOverrides.js` | Legacy Supabase project URL used only for manual override attachment storage. | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional; active Supabase Storage | `backend/services/supaClient.js`, `backend/routes/manualOverrides.js` | Service role key used only for manual override attachment storage. | No |
| `SUPABASE_SERVICE_ROLE` | Optional; active Supabase Storage alias | `backend/services/supaClient.js` | Alias fallback for `SUPABASE_SERVICE_ROLE_KEY`. | No |

## Active Frontend Variables

| Variable | Category | Files | What it does | Required for startup |
|---|---|---|---|---:|
| `REACT_APP_NEON_AUTH_URL` | Required for Neon Auth | `frontend/src/utils/neonAuthClient.js` | Preferred Neon Auth base URL for register/login/session flows. | No |
| `REACT_APP_NEON_AUTH_BASE_URL` | Required for Neon Auth; optional alias | `frontend/src/utils/neonAuthClient.js` | Alias fallback for the Neon Auth base URL. | No |
| `REACT_APP_API_URL` | Optional; local startup | `frontend/src/components/apiFetch.js`, `frontend/src/components/auth/AuthProvider.jsx`, `frontend/src/store/authSlice.js`, `frontend/src/utils/getRoleTier.js`, `frontend/src/utils/api.supabase.js`, `frontend/src/utils/api.js`, `frontend/src/components/ManualOverride.jsx`, `frontend/src/components/VerifyEmail.jsx`, `frontend/src/components/Candidate/SearchJobs.jsx`, `frontend/src/components/Users.jsx` | Backend API base URL; most callers default to `http://localhost:5000/api`. | No |
| `REACT_APP_HCAPTCHA_SITE_KEY` | Required for hCaptcha | `frontend/src/components/ManualOverride.jsx` | hCaptcha site key used by the manual override form. | No |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Optional | `frontend/src/components/JobSearch/JobList.jsx`, `frontend/src/components/JobSearch/JobMap.jsx` | Loads Google Maps script for job map rendering. | No |
| `NODE_ENV` | Optional; build/runtime supplied by CRA | `frontend/src/store/store.js` | Enables Redux devTools outside production. | No |

## Legacy Or Unused Variables

| Variable | Files | Classification | Notes |
|---|---|---|---|
| `SUPABASE_ANON_KEY` | root `.env.example` only | Legacy/unused | No active backend code reads it after Neon cutover. |
| `REACT_APP_SUPABASE_URL` | `frontend/src/utils/supabaseClient.js`, `frontend/src/supabase/client.js`, `frontend/lib/supabaseClient.js`, root `.env.example` | Legacy/unused | Supabase frontend clients are not imported by active app routes. |
| `REACT_APP_SUPABASE_ANON_KEY` | `frontend/src/utils/supabaseClient.js`, `frontend/src/supabase/client.js`, `frontend/lib/supabaseClient.js`, root `.env.example` | Legacy/unused | Same as above. |
| `REACT_PUBLIC_SUPABASE_URL` | `frontend/lib/supabaseClient.js` comments | Legacy/unused | Commented typo/old convention. |
| `REACT_PUBLIC_SUPABASE_ANON_KEY` | `frontend/lib/supabaseClient.js` comments | Legacy/unused | Commented typo/old convention. |
| `NEXT_PUBLIC_API_BASE` | `frontend/lib/apiFetch.js` | Legacy/unused | `frontend/lib` is not imported by the CRA app. |
| `REACT_APP_API_BASE` | `frontend/src/axiosInstance.js` | Legacy/unused | `frontend/src/axiosInstance.js` is not imported by active app code. Active API helpers use `REACT_APP_API_URL`. |
| `REACT_APP_DEV_MODE` | `frontend/src/components/Card.js` | Legacy/unused | `Card.js` is not imported by active app routes. |
| `EMAIL_USER` | `backend/z-archive-mongo/*`, `frontend/z-archive/*` | Legacy/unused | Old email implementation; active email uses `SMTP_*`. |
| `EMAIL_PASS` | `backend/z-archive-mongo/*`, `frontend/z-archive/*` | Legacy/unused | Old email implementation; active email uses `SMTP_*`. |
| `JWT_SECRET` | `frontend/z-archive/*`, comments in `backend/z-archive-mongo/*` | Legacy/unused | Old JWT auth; active backend verifies Neon Auth JWKS. |
| `MONGO_URI` | `backend/z-archive-mongo/scripts/*` | Legacy/unused | Old Mongo scripts. |
| `CLIENT_URL` | `backend/z-archive-mongo/paymentRoutes.js` | Legacy/unused | Old Stripe/Mongo payment route. |
| `STRIPE_SECRET_KEY` | `backend/routes/stripe.min.js`, `backend/z-archive-mongo/paymentRoutes.js` | Also active Stripe | These are legacy references in addition to active `backend/server.js`. |
| `APP_URL` | `backend/routes/stripe.min.js` | Also active optional | `stripe.min.js` is unmounted; active use is domain verification redirect. |
| `SUPABASE_URL` | `backend/src/supabaseAdmin.js` | Also active optional Storage | The `backend/src` admin client is unused, but `backend/services/supaClient.js` still uses this for optional Storage attachments. |
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/src/supabaseAdmin.js` | Also active optional Storage | The `backend/src` admin client is unused, but `backend/services/supaClient.js` still uses this for optional Storage attachments. |

## Values Available From Neon Dashboard

| Value | Use |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string for backend. |
| `REACT_APP_NEON_AUTH_URL` | Neon Auth frontend/base URL. |
| `NEON_AUTH_JWKS_URL` | JWKS endpoint for backend JWT verification. |
| `NEON_AUTH_ISSUER` | Optional issuer claim, if Neon exposes it and you want strict validation. |
| `NEON_AUTH_AUDIENCE` | Optional audience claim, if configured and you want strict validation. |

## Values To Generate Or Obtain Manually

| Value | Where to obtain |
|---|---|
| `PORT`, `FRONTEND_URL`, `APP_URL`, `PUBLIC_API_URL`, `REACT_APP_API_URL` | Manual local choices; localhost defaults are usually fine. |
| `SMTP_*` | Email provider dashboard or SMTP service. |
| `HCAPTCHA_SECRET`, `REACT_APP_HCAPTCHA_SITE_KEY` | hCaptcha dashboard. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe dashboard/CLI. |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Google Cloud Console. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Existing Supabase project, only if keeping attachment uploads. |

## Old Supabase Variables That Can Be Removed

Can remove immediately from local Neon-only frontend env:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_PUBLIC_SUPABASE_URL`
- `REACT_PUBLIC_SUPABASE_ANON_KEY`

Can remove immediately from local Neon-only backend env:

- `SUPABASE_ANON_KEY`

Can remove only after replacing or disabling manual override attachment storage:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SERVICE_ROLE`

## Exact Values Needed Before First Startup Test

Minimum for backend process start:

1. `DATABASE_URL`

Minimum for Neon Auth login/register/protected route test:

1. `DATABASE_URL`
2. `NEON_AUTH_JWKS_URL`
3. `REACT_APP_NEON_AUTH_URL`
4. `REACT_APP_API_URL`

Minimum for manual override test:

1. `HCAPTCHA_SECRET`
2. `REACT_APP_HCAPTCHA_SITE_KEY`
3. `SMTP_*` if you want decision emails to send
4. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only if testing file attachments

Minimum for domain verification email test:

1. `APP_URL`
2. `PUBLIC_API_URL`
3. `SMTP_*`

Minimum for Stripe webhook test:

1. `STRIPE_SECRET_KEY`
2. `STRIPE_WEBHOOK_SECRET`
3. `STRIPE_SKIP_VERIFY=false`
