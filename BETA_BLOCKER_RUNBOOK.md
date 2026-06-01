# jobs.vision Beta Blocker Runbook

Last validated: 2026-06-01

This file documents the final beta-blocker setup: Stripe webhook requirements, beta test accounts, and cleanup notes for the validation data.

## Beta Test Accounts

Use these accounts for local closed-beta validation.

| Role | Email | Password | Current state |
|---|---|---|---|
| Candidate | `beta.candidate@jobs.vision.test` | `BetaTest123!` | Neon Auth user exists; `public.profiles.role = candidate`. |
| Recruiter | `beta.recruiter@jobs.vision.test` | `BetaTest123!` | Neon Auth user exists; `public.profiles.role = recruiter`; synthetic Staff entitlement is active for beta testing. |
| Admin | `beta.admin@jobs.vision.test` | `BetaTest123!` | Neon Auth user exists; `public.profiles.role = admin`. |

Email verification is currently not required by the Neon Auth project config, so these accounts can log in with email/password.

## Beta Recruiter Entitlement Fixture

The beta recruiter has an active `recruiter_staff` entitlement so the recruiter -> job -> candidate application cycle can be tested before Stripe webhook signing is configured.

This entitlement is a beta fixture, not proof of Stripe payment processing.

Verification SQL:

```sql
select p.email, p.role, e.plan, e.status, e.max_active_jobs, e.stripe_subscription_id
from public.profiles p
left join public.recruiter_entitlements e on e.profile_id = p.id
where lower(p.email) = lower('beta.recruiter@jobs.vision.test');
```

Expected:

- `role = recruiter`
- `plan = recruiter_staff`
- `status = active`
- `max_active_jobs = 1`
- `stripe_subscription_id` may be null for this beta fixture

## Stripe Webhook Setup

Active backend webhook route:

```text
POST /api/stripe/webhook
```

Local forwarding target:

```text
http://localhost:5000/api/stripe/webhook
```

Production/staging endpoint format:

```text
https://<backend-domain>/api/stripe/webhook
```

### Required Backend Env Vars

| Variable | Required | Value source |
|---|---:|---|
| `STRIPE_SECRET_KEY` | Yes | Stripe Dashboard test-mode secret key. Must start with `sk_test_`. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret for the exact endpoint/CLI listener. Starts with `whsec_`. |
| `STRIPE_SKIP_VERIFY` | Yes | Keep `false`. Production startup fails if this is `true`. |
| `STRIPE_ACCOUNT_ID` | Recommended | `acct_1TdWCRJgo9pmORhC` |
| `FRONTEND_URL` | Yes for checkout redirects | Local: `http://localhost:3000`; deployed: jobs.vision frontend URL. |

### Required Stripe Dashboard Configuration

Use Stripe test mode.

1. Open Stripe Dashboard for account `acct_1TdWCRJgo9pmORhC`.
2. Go to Developers -> Webhooks.
3. Add an endpoint.
4. Set endpoint URL to `https://<backend-domain>/api/stripe/webhook`.
5. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
6. Save the endpoint.
7. Reveal the signing secret.
8. Copy the `whsec_...` value into `backend/.env` as `STRIPE_WEBHOOK_SECRET`.
9. Restart the backend.
10. Complete a test Checkout payment and confirm an entitlement row updates.

### Local Stripe CLI Setup

For local webhook testing:

```powershell
stripe listen --forward-to http://localhost:5000/api/stripe/webhook
```

Copy the printed `whsec_...` value into `backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SKIP_VERIFY=false
```

Then restart the backend before testing Checkout.

## Validation Data Cleanup

The public smoke-test job was archived.

Validation created and then archived one beta job titled like:

```text
Beta Validation Optometrist <timestamp>
```

Public active job count should be exactly the 40 launch seed jobs:

```sql
select count(*)::int
from public.jobs
where status = 'active'
  and is_archived = false;
```

Expected: `40`

The beta candidate may retain a saved job and submitted application from the validation run. To reset only beta workflow data:

```sql
delete from public.job_favorites
where user_id in (
  select id from public.profiles
  where email in (
    'beta.candidate@jobs.vision.test',
    'beta.recruiter@jobs.vision.test',
    'beta.admin@jobs.vision.test'
  )
);

delete from public.job_applications
where user_id in (
  select id from public.profiles
  where email in (
    'beta.candidate@jobs.vision.test',
    'beta.recruiter@jobs.vision.test',
    'beta.admin@jobs.vision.test'
  )
);

update public.jobs
set status = 'archived',
    is_archived = true,
    updated_at = now()
where title like 'Beta Validation Optometrist%';
```

