# Stripe Products And Prices

This file is the concrete product and price inventory for the refreshed jobs.vision pricing UI. It intentionally does not include Stripe-generated IDs.

## Product Inventory

| Product name | Audience | App plan key | App DB plan value | Stripe required? |
|---|---|---|---|---|
| `jobs.vision Recruiter Staff` | Recruiter | `staff` | `recruiter_staff` | Yes |
| `jobs.vision Recruiter Manager` | Recruiter | `manager` | `recruiter_manager` | Yes |
| `jobs.vision Recruiter Doctor` | Recruiter | `doctor` | `recruiter_doctor` | Yes |
| `jobs.vision Candidate Free` | Candidate | `free` | `candidate_free` | No |
| `jobs.vision Candidate Plus` | Candidate | `plus` | `candidate_plus` | Yes |
| `jobs.vision Candidate Premium` | Candidate | `premium` | `candidate_premium` | Yes |

## Recurring Price Inventory

These are the exact recurring Stripe Prices needed.

| Product | Lookup key | Amount cents | Currency | Interval | Metadata |
|---|---|---:|---|---|---|
| `jobs.vision Recruiter Staff` | `recruiter_staff_monthly` | `4900` | `usd` | `month` | `app=jobs.vision`, `audience=recruiter`, `plan_key=staff`, `db_plan=recruiter_staff`, `price_kind=monthly_recurring` |
| `jobs.vision Recruiter Manager` | `recruiter_manager_monthly` | `9900` | `usd` | `month` | `app=jobs.vision`, `audience=recruiter`, `plan_key=manager`, `db_plan=recruiter_manager`, `price_kind=monthly_recurring` |
| `jobs.vision Recruiter Doctor` | `recruiter_doctor_monthly` | `14900` | `usd` | `month` | `app=jobs.vision`, `audience=recruiter`, `plan_key=doctor`, `db_plan=recruiter_doctor`, `price_kind=monthly_recurring` |
| `jobs.vision Candidate Plus` | `candidate_plus_monthly` | `2000` | `usd` | `month` | `app=jobs.vision`, `audience=candidate`, `plan_key=plus`, `db_plan=candidate_plus`, `price_kind=monthly_recurring` |
| `jobs.vision Candidate Premium` | `candidate_premium_monthly` | `5000` | `usd` | `month` | `app=jobs.vision`, `audience=candidate`, `plan_key=premium`, `db_plan=candidate_premium`, `price_kind=monthly_recurring` |

## First-Month Adjustment Price Inventory

These are one-time Prices, not recurring Prices. They are needed to make the first invoice match the UI while renewals use the monthly recurring Prices.

| Product | Lookup key | Amount cents | Currency | First month total | Metadata |
|---|---|---:|---|---:|---|
| `jobs.vision Recruiter Staff` | `recruiter_staff_first_month_adjustment` | `3000` | `usd` | `$79.00` | `app=jobs.vision`, `audience=recruiter`, `plan_key=staff`, `db_plan=recruiter_staff`, `price_kind=first_month_adjustment` |
| `jobs.vision Recruiter Manager` | `recruiter_manager_first_month_adjustment` | `5000` | `usd` | `$149.00` | `app=jobs.vision`, `audience=recruiter`, `plan_key=manager`, `db_plan=recruiter_manager`, `price_kind=first_month_adjustment` |
| `jobs.vision Recruiter Doctor` | `recruiter_doctor_first_month_adjustment` | `15000` | `usd` | `$299.00` | `app=jobs.vision`, `audience=recruiter`, `plan_key=doctor`, `db_plan=recruiter_doctor`, `price_kind=first_month_adjustment` |

## Checkout Line Item Shape

| Plan | Subscription mode line items |
|---|---|
| Staff | `recruiter_staff_monthly` recurring price plus `recruiter_staff_first_month_adjustment` one-time price |
| Manager | `recruiter_manager_monthly` recurring price plus `recruiter_manager_first_month_adjustment` one-time price |
| Doctor | `recruiter_doctor_monthly` recurring price plus `recruiter_doctor_first_month_adjustment` one-time price |
| Candidate Plus | `candidate_plus_monthly` recurring price only |
| Candidate Premium | `candidate_premium_monthly` recurring price only |

## Refreshed UI Pricing Source

Frontend source: `frontend/src/components/PricingTable.jsx`

| UI plan | Current UI copy |
|---|---|
| Staff | `$79 first month`, `$49 per month thereafter` |
| Manager | `$149 first month`, `$99 per month thereafter` |
| Doctor | `$299 first month`, `$149 per month thereafter` |
| Free | `$0/month`, Browse jobs, Apply to jobs, Save up to 5 jobs |
| Plus | `$20/month`, Unlimited saves, Map search, Email alerts, Weekly matching |
| Premium | `$50/month`, SMS alerts, Priority profile placement, Featured candidate badge, Unlimited saves |

## Active Code Mapping

Active catalog mapping lives in `backend/services/stripeCatalog.js`.

The app resolves checkout prices by lookup key and maps webhook subscription prices by lookup key or metadata. Generated Stripe Price IDs are not committed.

| Plan | Entitlement table | Entitlement values |
|---|---|
| Staff | `recruiter_entitlements` | `plan = recruiter_staff`, `max_active_jobs = 1` |
| Manager | `recruiter_entitlements` | `plan = recruiter_manager`, `max_active_jobs = 5` |
| Doctor | `recruiter_entitlements` | `plan = recruiter_doctor`, `max_active_jobs = 10` |
| Candidate Plus | `candidate_entitlements` | `plan = candidate_plus`, `apply_cap_per_day = 0` |
| Candidate Premium | `candidate_entitlements` | `plan = candidate_premium`, `apply_cap_per_day = 0` |

Checkout route: `POST /api/stripe/checkout`

Webhook route: `POST /api/stripe/webhook`

Setup script: `backend/scripts/setup-stripe-catalog.js`

Confirmed jobs.vision Stripe test account: `acct_1TdWCRJgo9pmORhC`

Set `STRIPE_ACCOUNT_ID=acct_1TdWCRJgo9pmORhC` before running the setup script. The script retrieves the account for `STRIPE_SECRET_KEY` and exits before writing anything if it does not match.

## Metadata Field Reference

Use string values in Stripe metadata.

| Field | Required value pattern |
|---|---|
| `app` | `jobs.vision` |
| `audience` | `recruiter` or `candidate` |
| `plan_key` | `staff`, `manager`, `doctor`, `plus`, or `premium` |
| `db_plan` | `recruiter_staff`, `recruiter_manager`, `recruiter_doctor`, `candidate_plus`, or `candidate_premium` |
| `price_kind` | `monthly_recurring` or `first_month_adjustment` |

## Values Still Requiring Feature Enforcement

The billing integration stores paid plan status. The feature gates below are separate app logic and are not fully represented in the current entitlement schema:

| Area | Current schema/code field | Decision needed |
|---|---|---|
| Candidate saves | Not currently represented in `candidate_entitlements` | Enforce 5 saves for Free and unlimited saves for Plus/Premium |
| Candidate alerts | Not currently represented in `candidate_entitlements` | Gate email alerts, weekly matching, and SMS |
| Candidate profile promotion | Not currently represented in `candidate_entitlements` | Gate priority placement and badge |
