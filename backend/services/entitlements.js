const { one, query } = require("./db.js");

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

const RECRUITER_PLAN_TIERS = {
  recruiter_staff: "staff",
  recruiter_manager: "manager",
  recruiter_doctor: "doctor",
};

const CANDIDATE_PLAN_TIERS = {
  candidate_plus: "plus",
  candidate_premium: "premium",
};

const CANDIDATE_FEATURES_BY_TIER = {
  free: {
    unlimitedSaves: false,
    mapSearch: false,
    emailAlerts: false,
    weeklyMatching: false,
    smsAlerts: false,
    priorityPlacement: false,
    featuredBadge: false,
    premiumInsights: false,
  },
  plus: {
    unlimitedSaves: true,
    mapSearch: true,
    emailAlerts: true,
    weeklyMatching: true,
    smsAlerts: false,
    priorityPlacement: false,
    featuredBadge: false,
    premiumInsights: false,
  },
  premium: {
    unlimitedSaves: true,
    mapSearch: true,
    emailAlerts: true,
    weeklyMatching: true,
    smsAlerts: true,
    priorityPlacement: true,
    featuredBadge: true,
    premiumInsights: true,
  },
};

function isActiveStatus(status) {
  return ACTIVE_STATUSES.has(String(status || "").toLowerCase());
}

function normalizeRecruiterEntitlement(row) {
  const active = isActiveStatus(row?.status);
  const plan = active ? row?.plan || null : null;
  const tier = plan ? RECRUITER_PLAN_TIERS[plan] || null : null;

  return {
    active,
    plan,
    tier,
    status: row?.status || "inactive",
    maxActiveJobs: active ? Number(row?.max_active_jobs || 0) : 0,
    stripeSubscriptionId: row?.stripe_subscription_id || null,
    updatedAt: row?.updated_at || null,
  };
}

function normalizeCandidateEntitlement(row) {
  const active = isActiveStatus(row?.status);
  const paidPlan = active ? row?.plan || null : null;
  const tier = paidPlan ? CANDIDATE_PLAN_TIERS[paidPlan] || "free" : "free";
  const features = CANDIDATE_FEATURES_BY_TIER[tier] || CANDIDATE_FEATURES_BY_TIER.free;

  return {
    active,
    plan: paidPlan || "candidate_free",
    tier,
    status: row?.status || "inactive",
    saveLimit: features.unlimitedSaves ? null : 5,
    applyCapPerDay: active ? Number(row?.apply_cap_per_day || 0) : 0,
    stripeSubscriptionId: row?.stripe_subscription_id || null,
    updatedAt: row?.updated_at || null,
    features,
  };
}

async function getRecruiterEntitlement(profileId) {
  if (!profileId) return normalizeRecruiterEntitlement(null);

  const row = await one(
    `
      select profile_id, plan, status, max_active_jobs, stripe_subscription_id, updated_at
      from public.recruiter_entitlements
      where profile_id = $1
      order by updated_at desc nulls last
      limit 1
    `,
    [profileId]
  );

  return normalizeRecruiterEntitlement(row);
}

async function getCandidateEntitlement(profileId) {
  if (!profileId) return normalizeCandidateEntitlement(null);

  const row = await one(
    `
      select profile_id, plan, status, apply_cap_per_day, stripe_subscription_id, updated_at
      from public.candidate_entitlements
      where profile_id = $1
      order by updated_at desc nulls last
      limit 1
    `,
    [profileId]
  );

  return normalizeCandidateEntitlement(row);
}

async function getUserEntitlements(user = {}) {
  const role = String(user.role || "").toLowerCase();

  if (role === "admin") {
    return {
      tier: "premium",
      recruiter: {
        active: true,
        plan: "admin",
        tier: "doctor",
        status: "active",
        maxActiveJobs: null,
        stripeSubscriptionId: null,
        updatedAt: null,
      },
      candidate: {
        ...normalizeCandidateEntitlement({
          plan: "candidate_premium",
          status: "active",
          apply_cap_per_day: 0,
        }),
        plan: "candidate_premium",
        tier: "premium",
      },
    };
  }

  const [recruiter, candidate] = await Promise.all([
    role === "recruiter"
      ? getRecruiterEntitlement(user.id)
      : Promise.resolve(normalizeRecruiterEntitlement(null)),
    role === "candidate"
      ? getCandidateEntitlement(user.id)
      : Promise.resolve(normalizeCandidateEntitlement(null)),
  ]);

  return {
    tier: role === "recruiter" ? recruiter.tier : candidate.tier,
    recruiter,
    candidate,
  };
}

async function countRecruiterOpenJobSlots(profileId, excludeJobId = null) {
  const params = [profileId];
  const excludeClause = excludeJobId ? "and id <> $2" : "";
  if (excludeJobId) params.push(excludeJobId);

  const row = await one(
    `
      select count(*)::int as count
      from public.jobs
      where (recruiter_id = $1 or posted_by = $1)
        and is_archived = false
        and status in ('active', 'pending_domain')
        ${excludeClause}
    `,
    params
  );

  return Number(row?.count || 0);
}

async function getRecruiterJobLimitState(profileId, excludeJobId = null) {
  const entitlement = await getRecruiterEntitlement(profileId);
  const activeJobCount = await countRecruiterOpenJobSlots(profileId, excludeJobId);
  const maxActiveJobs = entitlement.maxActiveJobs;
  const unlimited = maxActiveJobs === null;

  return {
    entitlement,
    activeJobCount,
    maxActiveJobs,
    remainingJobs: unlimited ? null : Math.max(0, maxActiveJobs - activeJobCount),
    canPost: entitlement.active && (unlimited || activeJobCount < maxActiveJobs),
  };
}

async function countCandidateFavorites(profileId) {
  const row = await one(
    "select count(*)::int as count from public.job_favorites where user_id = $1",
    [profileId]
  );
  return Number(row?.count || 0);
}

async function getCandidateSaveState(profileId) {
  const entitlement = await getCandidateEntitlement(profileId);
  const savedJobCount = await countCandidateFavorites(profileId);
  const saveLimit = entitlement.saveLimit;
  const unlimited = saveLimit === null;

  return {
    entitlement,
    savedJobCount,
    saveLimit,
    remainingSaves: unlimited ? null : Math.max(0, saveLimit - savedJobCount),
    canSaveMore: unlimited || savedJobCount < saveLimit,
  };
}

async function upsertStripeEntitlement(profileId, plan, status, subscriptionId) {
  const payload = {
    profile_id: profileId,
    status,
    updated_at: new Date().toISOString(),
    stripe_subscription_id: subscriptionId || null,
    ...plan.entitlement.values,
  };

  if (plan.entitlement.table === "recruiter_entitlements") {
    await query(
      `
        insert into public.recruiter_entitlements
          (profile_id, status, updated_at, plan, max_active_jobs, stripe_subscription_id)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (profile_id) do update set
          status = excluded.status,
          updated_at = excluded.updated_at,
          plan = excluded.plan,
          max_active_jobs = excluded.max_active_jobs,
          stripe_subscription_id = excluded.stripe_subscription_id
      `,
      [
        payload.profile_id,
        payload.status,
        payload.updated_at,
        payload.plan,
        payload.max_active_jobs,
        payload.stripe_subscription_id,
      ]
    );
    return payload;
  }

  if (plan.entitlement.table === "candidate_entitlements") {
    await query(
      `
        insert into public.candidate_entitlements
          (profile_id, status, updated_at, plan, apply_cap_per_day, stripe_subscription_id)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (profile_id) do update set
          status = excluded.status,
          updated_at = excluded.updated_at,
          plan = excluded.plan,
          apply_cap_per_day = excluded.apply_cap_per_day,
          stripe_subscription_id = excluded.stripe_subscription_id
      `,
      [
        payload.profile_id,
        payload.status,
        payload.updated_at,
        payload.plan,
        payload.apply_cap_per_day,
        payload.stripe_subscription_id,
      ]
    );
    return payload;
  }

  throw new Error(`Unsupported entitlement table: ${plan.entitlement.table}`);
}

async function markSubscriptionCanceled(profileId, subscriptionId) {
  const updatedAt = new Date().toISOString();
  const params = [updatedAt, profileId, subscriptionId || null];

  await query(
    `
      update public.recruiter_entitlements
      set status = 'canceled', updated_at = $1
      where profile_id = $2 or ($3::text is not null and stripe_subscription_id = $3)
    `,
    params
  );

  await query(
    `
      update public.candidate_entitlements
      set status = 'canceled', updated_at = $1
      where profile_id = $2 or ($3::text is not null and stripe_subscription_id = $3)
    `,
    params
  );
}

module.exports = {
  CANDIDATE_FEATURES_BY_TIER,
  getCandidateEntitlement,
  getCandidateSaveState,
  getRecruiterEntitlement,
  getRecruiterJobLimitState,
  getUserEntitlements,
  isActiveStatus,
  markSubscriptionCanceled,
  normalizeCandidateEntitlement,
  normalizeRecruiterEntitlement,
  upsertStripeEntitlement,
};
