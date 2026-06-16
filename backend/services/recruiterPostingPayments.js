const { one, query } = require("./db.js");

const ACTIVE_PAYMENT_STATUSES = new Set(["active", "trialing"]);

const RECRUITER_POSTING_PLAN_LABELS = {
  staff: "Staff Posting",
  manager: "Manager Posting",
  doctor: "Doctor Posting",
};

const RECRUITER_POSTING_DB_PLANS = {
  staff: "recruiter_staff",
  manager: "recruiter_manager",
  doctor: "recruiter_doctor",
};

const ROLE_REQUIRED_RECRUITER_PLAN = {
  optometrist: "doctor",
  practice_manager: "manager",
  optical_manager: "manager",
  optician: "staff",
  ophthalmic_technician: "staff",
  optical_lab: "staff",
  front_desk: "staff",
  other: "staff",
};

const ROLE_ALIASES = new Map([
  ["od", "optometrist"],
  ["doctor", "optometrist"],
  ["optometrist", "optometrist"],
  ["optician", "optician"],
  ["tech", "ophthalmic_technician"],
  ["technician", "ophthalmic_technician"],
  ["optometric tech", "ophthalmic_technician"],
  ["ophthalmic tech", "ophthalmic_technician"],
  ["ophthalmic technician", "ophthalmic_technician"],
  ["ophthalmic_technician", "ophthalmic_technician"],
  ["optical lab", "optical_lab"],
  ["optical_lab", "optical_lab"],
  ["front desk", "front_desk"],
  ["front desk reception", "front_desk"],
  ["front_desk", "front_desk"],
  ["office manager", "practice_manager"],
  ["manager", "practice_manager"],
  ["practice manager", "practice_manager"],
  ["practice_manager", "practice_manager"],
  ["optical manager", "optical_manager"],
  ["optical_manager", "optical_manager"],
  ["vision center manager", "optical_manager"],
  ["other", "other"],
]);

function normalizeRecruiterPostingRole(value = "") {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ");
  return ROLE_ALIASES.get(key) || "";
}

function getRequiredRecruiterPlanKey(role) {
  const normalizedRole = normalizeRecruiterPostingRole(role);
  return ROLE_REQUIRED_RECRUITER_PLAN[normalizedRole] || "staff";
}

function dbPlanForRecruiterPlanKey(planKey) {
  return RECRUITER_POSTING_DB_PLANS[String(planKey || "").toLowerCase()] || null;
}

function isActivePaymentStatus(status) {
  return ACTIVE_PAYMENT_STATUSES.has(String(status || "").toLowerCase());
}

function normalizePostingPayment(row = null, expected = {}) {
  const requiredPlanKey = expected.requiredPlanKey || row?.required_plan_key || null;
  const role = expected.role || row?.role || null;
  const status = row?.status || "unpaid";
  const active =
    Boolean(row) &&
    isActivePaymentStatus(status) &&
    (!requiredPlanKey || row.required_plan_key === requiredPlanKey) &&
    (!role || normalizeRecruiterPostingRole(row.role) === normalizeRecruiterPostingRole(role));

  return {
    active,
    status,
    role: row?.role || role,
    requiredPlanKey,
    dbPlan: row?.db_plan || dbPlanForRecruiterPlanKey(requiredPlanKey),
    stripeCustomerId: row?.stripe_customer_id || null,
    stripeCheckoutSessionId: row?.stripe_checkout_session_id || null,
    stripeSubscriptionId: row?.stripe_subscription_id || null,
    stripePriceId: row?.stripe_price_id || null,
    stripeLookupKey: row?.stripe_lookup_key || null,
    paidAt: row?.paid_at || null,
    updatedAt: row?.updated_at || null,
  };
}

async function getRecruiterPostingPaymentState(jobId, { role = null } = {}) {
  if (!jobId) return normalizePostingPayment(null, { role });
  const normalizedRole = normalizeRecruiterPostingRole(role);
  const requiredPlanKey = getRequiredRecruiterPlanKey(normalizedRole || role);

  const row = await one(
    `
      select *
      from public.recruiter_posting_payments
      where job_id = $1
      order by updated_at desc nulls last, created_at desc
      limit 1
    `,
    [jobId]
  );

  return normalizePostingPayment(row, {
    role: normalizedRole || role,
    requiredPlanKey,
  });
}

async function upsertRecruiterPostingPayment({
  jobId,
  profileId,
  role,
  requiredPlanKey,
  status,
  stripeCustomerId = null,
  stripeCheckoutSessionId = null,
  stripeSubscriptionId = null,
  stripePriceId = null,
  stripeLookupKey = null,
}) {
  const normalizedRole = normalizeRecruiterPostingRole(role);
  const planKey = requiredPlanKey || getRequiredRecruiterPlanKey(normalizedRole);
  const dbPlan = dbPlanForRecruiterPlanKey(planKey);
  if (!jobId || !profileId || !normalizedRole || !planKey || !dbPlan) {
    throw new Error("Missing recruiter posting payment identity.");
  }

  const paidAt = isActivePaymentStatus(status) ? new Date().toISOString() : null;

  const row = await one(
    `
      insert into public.recruiter_posting_payments
        (
          job_id,
          profile_id,
          role,
          required_plan_key,
          db_plan,
          status,
          stripe_customer_id,
          stripe_checkout_session_id,
          stripe_subscription_id,
          stripe_price_id,
          stripe_lookup_key,
          paid_at,
          updated_at
        )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
      on conflict (job_id) do update set
        profile_id = excluded.profile_id,
        role = excluded.role,
        required_plan_key = excluded.required_plan_key,
        db_plan = excluded.db_plan,
        status = excluded.status,
        stripe_customer_id = coalesce(excluded.stripe_customer_id, public.recruiter_posting_payments.stripe_customer_id),
        stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, public.recruiter_posting_payments.stripe_checkout_session_id),
        stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.recruiter_posting_payments.stripe_subscription_id),
        stripe_price_id = coalesce(excluded.stripe_price_id, public.recruiter_posting_payments.stripe_price_id),
        stripe_lookup_key = coalesce(excluded.stripe_lookup_key, public.recruiter_posting_payments.stripe_lookup_key),
        paid_at = coalesce(excluded.paid_at, public.recruiter_posting_payments.paid_at),
        updated_at = excluded.updated_at
      returning *
    `,
    [
      jobId,
      profileId,
      normalizedRole,
      planKey,
      dbPlan,
      status || "incomplete",
      stripeCustomerId,
      stripeCheckoutSessionId,
      stripeSubscriptionId,
      stripePriceId,
      stripeLookupKey,
      paidAt,
    ]
  );

  return normalizePostingPayment(row, {
    role: normalizedRole,
    requiredPlanKey: planKey,
  });
}

async function findRecruiterPostingPaymentBySubscription(subscriptionId) {
  if (!subscriptionId) return null;
  return one(
    `
      select *
      from public.recruiter_posting_payments
      where stripe_subscription_id = $1
      order by updated_at desc nulls last
      limit 1
    `,
    [subscriptionId]
  );
}

async function markRecruiterPostingPaymentCanceled(subscriptionId, status = "canceled") {
  if (!subscriptionId) return null;
  const row = await one(
    `
      update public.recruiter_posting_payments
      set status = $2,
          updated_at = now()
      where stripe_subscription_id = $1
      returning *
    `,
    [subscriptionId, status]
  );
  return normalizePostingPayment(row);
}

function paymentMetadataForJob({ jobId, profileId, role, requiredPlanKey }) {
  const normalizedRole = normalizeRecruiterPostingRole(role);
  const planKey = requiredPlanKey || getRequiredRecruiterPlanKey(normalizedRole);
  return {
    paymentScope: "recruiter_posting",
    jobId: String(jobId || ""),
    role: normalizedRole,
    requiredPlanKey: planKey,
    profileId: String(profileId || ""),
  };
}

module.exports = {
  ACTIVE_PAYMENT_STATUSES,
  RECRUITER_POSTING_PLAN_LABELS,
  dbPlanForRecruiterPlanKey,
  findRecruiterPostingPaymentBySubscription,
  getRecruiterPostingPaymentState,
  getRequiredRecruiterPlanKey,
  isActivePaymentStatus,
  markRecruiterPostingPaymentCanceled,
  normalizeRecruiterPostingRole,
  paymentMetadataForJob,
  upsertRecruiterPostingPayment,
};
