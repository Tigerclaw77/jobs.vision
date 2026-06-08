// src/ProtectedRoute.jsx
import React, { useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./components/auth/AuthProvider";
import { useAuthDiagnostics } from "./components/auth/AuthDiagnostics";

/**
 * Route guard:
 * - Uses AuthProvider as the source of truth for session/profile.
 * - Authorizes with the authenticated role only.
 * - Admin View Mode supplies a preview role for presentation through useEffectiveAuth().
 * - Preview role must never decide whether a real user may enter a route.
 * - Avoids duplicate /api/auth/me calls inside protected routes.
 * - Fails closed without flashing protected content.
 */
export default function ProtectedRoute({
  children,
  allowedUserRoles = [],
  allowedTiers = [],
}) {
  const loc = useLocation();
  const { setAuthCheck } = useAuthDiagnostics();
  const {
    session,
    user,
    account,
    profile,
    role: authRole,
    tier: authTier,
    loading,
    loadingProfile,
  } = useAuth();

  const metadata = {
    ...(user?.app_metadata || {}),
    ...(user?.user_metadata || {}),
  };

  // Authenticated role: the actual account/profile role returned by auth + /api/auth/me.
  // This is the only role used for route authorization.
  const authorizationRole = String(
    authRole ||
      profile?.role ||
      account?.profile?.role ||
      account?.role ||
      metadata.role ||
      metadata.accountRole ||
      metadata.userRole ||
      ""
  ).toLowerCase();

  // Authorization tier follows the real authenticated account too.
  // Preview plan/tier is intentionally ignored here.
  const authorizationTier = String(
    authTier ||
      account?.tier ||
      account?.entitlements?.tier ||
      metadata.tier ||
      ""
  ).toLowerCase();

  const allowedRolesKey = allowedUserRoles
    .map((r) => String(r || "").toLowerCase())
    .join("|");
  const allowedTiersKey = allowedTiers
    .map((t) => String(t || "").toLowerCase())
    .join("|");
  const normalizedAllowedRoles = useMemo(
    () => (allowedRolesKey ? allowedRolesKey.split("|") : []),
    [allowedRolesKey]
  );
  const normalizedAllowedTiers = useMemo(
    () => (allowedTiersKey ? allowedTiersKey.split("|") : []),
    [allowedTiersKey]
  );
  const authenticatedUserId =
    profile?.id || account?.profile?.id || account?.id || user?.id || null;
  const authenticatedEmail =
    profile?.email ||
    account?.profile?.email ||
    account?.email ||
    user?.email ||
    null;
  const route = loc.pathname + loc.search;
  const isAdmin = authorizationRole === "admin";
  const roleAllowed =
    isAdmin ||
    normalizedAllowedRoles.length === 0 ||
    normalizedAllowedRoles.includes(authorizationRole);
  const tierAllowed =
    isAdmin ||
    normalizedAllowedTiers.length === 0 ||
    (authorizationTier
      ? normalizedAllowedTiers.includes(authorizationTier)
      : false);

  let authorizationResult = "authorized";
  if (loading || (session && loadingProfile && !authorizationRole)) {
    authorizationResult = "loading";
  } else if (!session) {
    authorizationResult = "login_required";
  } else if (!authorizationRole) {
    authorizationResult = "missing_role";
  } else if (isAdmin) {
    authorizationResult = "authorized_admin";
  } else if (!roleAllowed) {
    authorizationResult = "denied_role";
  } else if (!tierAllowed) {
    authorizationResult = "denied_tier";
  }

  const requiredRoles = useMemo(
    () =>
      normalizedAllowedRoles.length > 0
        ? normalizedAllowedRoles
        : ["authenticated"],
    [normalizedAllowedRoles]
  );
  const requiredTiers = normalizedAllowedTiers;
  const authDebug = useMemo(
    () => ({
      authenticatedUserId,
      authenticatedEmail,
      authenticatedRole: authorizationRole || null,
      route,
      requiredRoles,
      requiredTiers,
      authorizationResult,
    }),
    [
      authenticatedUserId,
      authenticatedEmail,
      authorizationRole,
      route,
      requiredRoles,
      requiredTiers,
      authorizationResult,
    ]
  );

  useEffect(() => {
    setAuthCheck(authDebug);
  }, [setAuthCheck, authDebug]);

  if (loading || (session && loadingProfile && !authorizationRole)) {
    return <RouteLoading />;
  }

  if (!session) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!authorizationRole) {
    return <Navigate to="/unauthorized" replace state={{ authDebug }} />;
  }

  // Real admins always pass protected-route authorization.
  // Presentation may still be rendered as guest/candidate/recruiter elsewhere
  // through Admin View Mode, but admin tooling stays reachable.
  if (isAdmin) return children;

  if (!roleAllowed || !tierAllowed) {
    return <Navigate to="/unauthorized" replace state={{ authDebug }} />;
  }

  return children;
}

function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "220px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#f8fafc",
        fontWeight: 700,
      }}
    >
      Loading...
    </div>
  );
}
