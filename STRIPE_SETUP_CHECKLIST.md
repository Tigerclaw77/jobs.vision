# Stripe Setup Checklist

Test-mode setup for the jobs.vision Stripe integration. The implementation uses Stripe lookup keys and metadata, not hard-coded generated Stripe IDs.

## Current Code State

- Active webhook route: `backend/server.js`
- Webhook endpoint path: `/api/stripe/webhook`
- Stripe SDK dependency: `backend/package.json`
- Active checkout route: `backend/routes/stripe.js`
- Active catalog config: `backend/services/stripeCatalog.js`
- Test catalog setup script: `backend/scripts/setup-stripe-catalog.js`
- Confirmed jobs.vision Stripe test account: `acct_1TdWCRJgo9pmORhC`
- Checkout route creates or reuses a Stripe Customer and stores it in `public.profiles.stripe_customer_id`.
- Checkout route uses Stripe Price lookup keys, then redirects the user to Stripe Checkout.
- Webhook maps subscription recurring prices by lookup key or Stripe metadata.
- Webhook writes `stripe_subscription_id` into entitlement tables.

## Required Stripe Products

Create these products in Stripe test mode first:

1. `jobs.vision Recruiter Staff`
2. `jobs.vision Recruiter Manager`
3. `jobs.vision Recruiter Doctor`
4. `jobs.vision Candidate Plus`
5. `jobs.vision Candidate Premium`

No Stripe product is required for Candidate Free. Free remains an app-side plan.

## Required Recurring Prices

Create these recurring monthly prices. Do not assume Stripe generated IDs.

| Product | Amount | Interval | Lookup key |
|---|---:|---|---|
| `jobs.vision Recruiter Staff` | `$49.00` | Monthly | `recruiter_staff_monthly` |
| `jobs.vision Recruiter Manager` | `$99.00` | Monthly | `recruiter_manager_monthly` |
| `jobs.vision Recruiter Doctor` | `$149.00` | Monthly | `recruiter_doctor_monthly` |
| `jobs.vision Candidate Plus` | `$20.00` | Monthly | `candidate_plus_monthly` |
| `jobs.vision Candidate Premium` | `$50.00` | Monthly | `candidate_premium_monthly` |

## Required First-Month Adjustment Prices

The UI says recruiter plans have a higher first month and lower renewal. The lowest-complexity Stripe Checkout model is:

- Monthly recurring renewal price
- One-time first-month adjustment price added to the initial Checkout Session

Create these one-time prices:

| Product | One-time amount | First month total | Lookup key |
|---|---:|---:|---|
| `jobs.vision Recruiter Staff` | `$30.00` | `$79.00` | `recruiter_staff_first_month_adjustment` |
| `jobs.vision Recruiter Manager` | `$50.00` | `$149.00` | `recruiter_manager_first_month_adjustment` |
| `jobs.vision Recruiter Doctor` | `$150.00` | `$299.00` | `recruiter_doctor_first_month_adjustment` |

Candidate plans do not need first-month adjustment prices.

## Required Metadata

### Required by current code

Checkout writes these Checkout Session and Subscription metadata fields:

| Metadata field | Required on | Purpose |
|---|---|---|
| `userId` | Checkout Session | App profile/user ID for future customer/profile linking. |
| `profileId` | Checkout Session and Subscription | App profile/user ID for entitlement reconciliation. |
| `productKey` | Checkout Session and Subscription | App plan key for checkout reconciliation. |
| `planKey` | Checkout Session and Subscription | App plan key for webhook fallback mapping. |
| `audience` | Checkout Session and Subscription | Distinguishes recruiter and candidate plans. |
| `dbPlan` | Checkout Session and Subscription | App entitlement plan value. |

The webhook maps subscription Prices by lookup key first, then falls back to these Product/Price metadata fields:

| Metadata field | Values |
|---|---|
| `app` | `jobs.vision` |
| `audience` | `recruiter` or `candidate` |
| `plan_key` | `staff`, `manager`, `doctor`, `plus`, `premium` |
| `db_plan` | `recruiter_staff`, `recruiter_manager`, `recruiter_doctor`, `candidate_plus`, `candidate_premium` |
| `price_kind` | `monthly_recurring` or `first_month_adjustment` |

## Required Webhook Events

Configure one webhook endpoint:

`https://<backend-domain>/api/stripe/webhook`

For local testing with Stripe CLI, forward to:

`http://localhost:5000/api/stripe/webhook`

Subscribe to these events:

| Event | Required now | Current behavior |
|---|---:|---|
| `checkout.session.completed` | Yes | Active code retrieves the subscription and upserts the matching entitlement. |
| `customer.subscription.deleted` | Yes | Active code marks recruiter and candidate entitlements as `canceled`. |
| `customer.subscription.updated` | Yes | Active code syncs the entitlement status and plan from subscription prices. |
| `invoice.paid` | Yes | Active code syncs the entitlement status and plan from the invoice subscription. |
| `invoice.payment_failed` | Yes before launch | Active code marks the entitlement `past_due` when the subscription is available. |

## Required Environment Variables

### Currently read by active backend code

| Variable | Required for Stripe | Notes |
|---|---:|---|
| `STRIPE_SECRET_KEY` | Yes | Enables the webhook route and Stripe client. Must be a test key (`sk_test_`); backend startup refuses live keys. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Required when `STRIPE_SKIP_VERIFY=false`. |
| `STRIPE_SKIP_VERIFY` | Yes | Must be `false` outside local throwaway tests. Production fails closed if `true`. |
| `NODE_ENV` | Yes for production safety | `production` blocks unsafe webhook verification bypass. |
| `FRONTEND_URL` | Yes for checkout redirects | Used for Checkout success/cancel URLs. Defaults to `http://localhost:3000`. |
| `STRIPE_ACCOUNT_ID` | Optional setup safety | Set to `acct_1TdWCRJgo9pmORhC` so the setup script refuses to write to any other Stripe account. |
| `STRIPE_WEBHOOK_URL` | Optional setup script only | If set, the setup script creates/updates a Stripe Dashboard webhook endpoint. |

### Price ID variables

No generated Stripe Price IDs are required in environment variables. The app resolves prices by lookup key at checkout time.

No frontend Stripe environment variables are currently required.

## Create Products And Prices Through The Stripe API

Use a Stripe test secret key only. The script refuses to run with a non-test key.

From `backend/`:

```bash
export STRIPE_ACCOUNT_ID=acct_1TdWCRJgo9pmORhC
node scripts/setup-stripe-catalog.js
```

To also create/update a Dashboard webhook endpoint through the Stripe API:

```bash
export STRIPE_ACCOUNT_ID=acct_1TdWCRJgo9pmORhC
STRIPE_WEBHOOK_URL=https://your-backend-domain/api/stripe/webhook node scripts/setup-stripe-catalog.js
```

On Windows PowerShell:

```powershell
$env:STRIPE_ACCOUNT_ID="acct_1TdWCRJgo9pmORhC"
$env:STRIPE_WEBHOOK_URL="https://your-backend-domain/api/stripe/webhook"
node scripts/setup-stripe-catalog.js
```

If the script creates a webhook endpoint, Stripe returns the signing secret once. Copy it to `STRIPE_WEBHOOK_SECRET`.
If `STRIPE_ACCOUNT_ID` is set and the secret key belongs to a different account, the script exits before creating products or prices.

## Dashboard Actions Paul Must Eventually Perform

If not using the setup script:

1. Work in Stripe test mode first.
2. Create the 5 Products listed above.
3. Create the 5 recurring monthly Prices listed above.
4. Create the 3 one-time first-month adjustment Prices listed above.
5. Add the exact lookup keys listed in this document to each Price.
6. Add the recommended metadata fields to Products and Prices.
7. Create a webhook endpoint for `/api/stripe/webhook`.
8. Select webhook events listed above.
9. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
10. Copy the test backend secret key to `STRIPE_SECRET_KEY`.
11. Set `STRIPE_ACCOUNT_ID=acct_1TdWCRJgo9pmORhC` before running the setup script.
12. Keep `STRIPE_SKIP_VERIFY=false`.
13. Run a test checkout for each paid plan and confirm entitlement rows update in Neon.

## Remaining Manual Checks

- The setup script can create products/prices immediately with `STRIPE_SECRET_KEY`.
- Webhook endpoint creation needs either a deployed backend URL or a local Stripe CLI forwarder.
- Recruiter entitlement caps are currently Staff `1`, Manager `5`, Doctor `10`.
- Candidate paid entitlements currently activate `candidate_plus` or `candidate_premium`; feature enforcement for saves, alerts, matching, SMS, placement, and badges remains separate application logic.
