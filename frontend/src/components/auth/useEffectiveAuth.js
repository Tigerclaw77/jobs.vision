import { useSelector } from "react-redux";
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

function roleFromState(auth, authState) {
  return (
    auth.role ||
    authState.userRole ||
    authState.user?.userRole ||
    authState.user?.role ||
    authState.user?.accountRole ||
    null
  );
}

export function useEffectiveAuth() {
  const auth = useAuth();
  const authState = useSelector((state) => state.auth || {});
  const viewMode = useAdminViewMode();

  const realRole = String(roleFromState(auth, authState) || "").toLowerCase();
  const realUser = authState.user || auth.user || null;
  const realTier =
    authState.user?.tier ||
    auth.tier ||
    authState.user?.entitlements?.tier ||
    auth.entitlements?.tier ||
    null;
  const realEntitlements = authState.user?.entitlements || auth.entitlements || null;
  const realIsAuthenticated =
    !!auth.session || !!authState.isAuthenticated || !!authState.token || !!authState.user;

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
