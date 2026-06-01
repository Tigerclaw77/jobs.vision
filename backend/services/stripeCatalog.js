const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

const STRIPE_PRODUCTS = [
  {
    audience: "recruiter",
    planKey: "staff",
    dbPlan: "recruiter_staff",
    name: "jobs.vision Recruiter Staff",
    recurringLookupKey: "recruiter_staff_monthly",
    recurringAmountCents: 4900,
    firstMonthAdjustmentLookupKey: "recruiter_staff_first_month_adjustment",
    firstMonthAdjustmentAmountCents: 3000,
    entitlement: {
      table: "recruiter_entitlements",
      values: { plan: "recruiter_staff", max_active_jobs: 1 },
    },
  },
  {
    audience: "recruiter",
    planKey: "manager",
    dbPlan: "recruiter_manager",
    name: "jobs.vision Recruiter Manager",
    recurringLookupKey: "recruiter_manager_monthly",
    recurringAmountCents: 9900,
    firstMonthAdjustmentLookupKey: "recruiter_manager_first_month_adjustment",
    firstMonthAdjustmentAmountCents: 5000,
    entitlement: {
      table: "recruiter_entitlements",
      values: { plan: "recruiter_manager", max_active_jobs: 5 },
    },
  },
  {
    audience: "recruiter",
    planKey: "doctor",
    dbPlan: "recruiter_doctor",
    name: "jobs.vision Recruiter Doctor",
    recurringLookupKey: "recruiter_doctor_monthly",
    recurringAmountCents: 14900,
    firstMonthAdjustmentLookupKey: "recruiter_doctor_first_month_adjustment",
    firstMonthAdjustmentAmountCents: 15000,
    entitlement: {
      table: "recruiter_entitlements",
      values: { plan: "recruiter_doctor", max_active_jobs: 10 },
    },
  },
  {
    audience: "candidate",
    planKey: "plus",
    dbPlan: "candidate_plus",
    name: "jobs.vision Candidate Plus",
    recurringLookupKey: "candidate_plus_monthly",
    recurringAmountCents: 2000,
    entitlement: {
      table: "candidate_entitlements",
      values: { plan: "candidate_plus", apply_cap_per_day: 0 },
    },
  },
  {
    audience: "candidate",
    planKey: "premium",
    dbPlan: "candidate_premium",
    name: "jobs.vision Candidate Premium",
    recurringLookupKey: "candidate_premium_monthly",
    recurringAmountCents: 5000,
    entitlement: {
      table: "candidate_entitlements",
      values: { plan: "candidate_premium", apply_cap_per_day: 0 },
    },
  },
];

const STRIPE_PLANS = Object.fromEntries(
  STRIPE_PRODUCTS.map((plan) => [plan.planKey, plan])
);

const STRIPE_PLANS_BY_RECURRING_LOOKUP_KEY = Object.fromEntries(
  STRIPE_PRODUCTS.map((plan) => [plan.recurringLookupKey, plan])
);

const STRIPE_PLANS_BY_DB_PLAN = Object.fromEntries(
  STRIPE_PRODUCTS.map((plan) => [plan.dbPlan, plan])
);

function metadataForPlan(plan, priceKind = "monthly_recurring") {
  return {
    app: "jobs.vision",
    audience: plan.audience,
    plan_key: plan.planKey,
    db_plan: plan.dbPlan,
    price_kind: priceKind,
  };
}

function getPlanByKey(planKey) {
  return STRIPE_PLANS[String(planKey || "").trim().toLowerCase()] || null;
}

function getPlanByStripePrice(price = {}) {
  const lookupKey = price.lookup_key || price.lookupKey;
  if (lookupKey && STRIPE_PLANS_BY_RECURRING_LOOKUP_KEY[lookupKey]) {
    return STRIPE_PLANS_BY_RECURRING_LOOKUP_KEY[lookupKey];
  }

  const metadata = price.metadata || {};
  if (metadata.db_plan && STRIPE_PLANS_BY_DB_PLAN[metadata.db_plan]) {
    return STRIPE_PLANS_BY_DB_PLAN[metadata.db_plan];
  }

  if (metadata.plan_key && STRIPE_PLANS[metadata.plan_key]) {
    return STRIPE_PLANS[metadata.plan_key];
  }

  return null;
}

function getPlanFromSubscription(subscription = {}) {
  const items = subscription?.items?.data || [];
  for (const item of items) {
    const plan = getPlanByStripePrice(item.price);
    if (plan) return plan;
  }
  return null;
}

function normalizeStripeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["active", "trialing", "past_due", "canceled", "incomplete"].includes(value)) {
    return value;
  }
  if (value === "unpaid" || value === "paused") return "past_due";
  if (value === "incomplete_expired") return "incomplete";
  return "inactive";
}

module.exports = {
  STRIPE_PRODUCTS,
  STRIPE_PLANS,
  STRIPE_WEBHOOK_EVENTS,
  getPlanByKey,
  getPlanByStripePrice,
  getPlanFromSubscription,
  metadataForPlan,
  normalizeStripeStatus,
};
