import { useAuth } from "./AuthProvider";
import { useAdminViewMode } from "./AdminViewModeProvider";

const CANDIDATE_FEATURES = {
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

const RECRUITER_SLOT_LIMITS = {
  staff: 1,
  manager: 5,
  doctor: 10,
};

function candidateEntitlement(plan) {
  const tier = CANDIDATE_FEATURES[plan] ? plan : "free";
  const features = CANDIDATE_FEATURES[tier];
  return {
    active: tier !== "free",
    plan: tier === "free" ? "candidate_free" : `candidate_${tier}`,
    tier,
    status: tier === "free" ? "inactive" : "active",
    saveLimit: features.unlimitedSaves ? null : 5,
    applyCapPerDay: 0,
    stripeSubscriptionId: null,
    updatedAt: null,
    features,
  };
}

function recruiterEntitlement(plan) {
  const tier = RECRUITER_SLOT_LIMITS[plan] ? plan : "staff";
  return {
    active: true,
    plan: `recruiter_${tier}`,
    tier,
    status: "active",
    maxActiveJobs: RECRUITER_SLOT_LIMITS[tier],
    stripeSubscriptionId: null,
    updatedAt: null,
  };
}

function buildEntitlements(role, plan) {
  if (role === "candidate") {
    const candidate = candidateEntitlement(plan);
    return {
      tier: candidate.tier,
      candidate,
      recruiter: {
        active: false,
        plan: null,
        tier: null,
        status: "inactive",
        maxActiveJobs: 0,
        stripeSubscriptionId: null,
        updatedAt: null,
      },
    };
  }

  if (role === "recruiter") {
    const recruiter = recruiterEntitlement(plan);
    return {
      tier: recruiter.tier,
      recruiter,
      candidate: candidateEntitlement("free"),
    };
  }

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
      candidate: candidateEntitlement("premium"),
    };
  }

  return null;
}

export function useEffectiveAuth() {
  const auth = useAuth();
  const viewMode = useAdminViewMode();

  const realRole = String(
    auth.role ||
      auth.profile?.role ||
      auth.account?.profile?.role ||
      auth.account?.role ||
      ""
  ).toLowerCase();
  const realTier =
    auth.tier ||
    auth.account?.tier ||
    auth.account?.entitlements?.tier ||
    auth.entitlements?.tier ||
    null;
  const realEntitlements =
    auth.entitlements || auth.account?.entitlements || null;
  // AuthProvider's real Neon session is the only sign-in source of truth.
  // Redux/localStorage may cache user details, but must not decide auth state.
  const realIsAuthenticated = !!auth.session;
  const realUser = auth.session
    ? {
        ...(auth.user || {}),
        id: auth.account?.id || auth.profile?.id || auth.user?.id || null,
        email: auth.account?.email || auth.profile?.email || auth.user?.email || null,
        userRole: realRole || null,
        role: realRole || null,
        accountRole: realRole || null,
        tier: realTier,
        entitlements: realEntitlements,
      }
    : null;

  if (!viewMode.isRealAdmin || viewMode.mode === "admin") {
    return {
      ...auth,
      user: realUser,
      role: realRole || auth.role || null,
      tier: realTier,
      entitlements: realEntitlements,
      isAuthenticated: realIsAuthenticated,
      realRole,
      effectiveRole: realRole || auth.role || null,
      effectivePlan: realTier,
      viewingAs: false,
    };
  }

  if (viewMode.effectiveRole === "guest") {
    return {
      ...auth,
      session: null,
      user: null,
      profile: null,
      accessToken: null,
      role: null,
      tier: null,
      entitlements: null,
      isAuthenticated: false,
      realRole,
      effectiveRole: "guest",
      effectivePlan: "guest",
      viewingAs: true,
    };
  }

  const effectiveRole = viewMode.effectiveRole;
  const effectivePlan = viewMode.effectivePlan;
  const entitlements = buildEntitlements(effectiveRole, effectivePlan);
  const tier = entitlements?.tier || effectivePlan;
  const effectiveUser = {
    ...(realUser || {}),
    id: realUser?.id || auth.user?.id || "admin-view-mode",
    email: realUser?.email || auth.user?.email || "",
    userRole: effectiveRole,
    role: effectiveRole,
    accountRole: effectiveRole,
    tier,
    entitlements,
    isAdminViewMode: true,
    realRole,
  };

  return {
    ...auth,
    user: effectiveUser,
    role: effectiveRole,
    tier,
    entitlements,
    isAuthenticated: true,
    realRole,
    effectiveRole,
    effectivePlan,
    viewingAs: true,
  };
}
