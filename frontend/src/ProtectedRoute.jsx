// src/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./components/auth/AuthProvider";

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

  if (loading || (session && loadingProfile && !authorizationRole)) {
    return <RouteLoading />;
  }

  if (!session) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!authorizationRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Real admins always pass protected-route authorization.
  // Presentation may still be rendered as guest/candidate/recruiter elsewhere
  // through Admin View Mode, but admin tooling stays reachable.
  if (authorizationRole === "admin") return children;

  const roleAllowed =
    allowedUserRoles.length === 0 ||
    allowedUserRoles.map((r) => r.toLowerCase()).includes(authorizationRole);

  const tierAllowed =
    allowedTiers.length === 0 ||
    (authorizationTier
      ? allowedTiers.map((t) => t.toLowerCase()).includes(authorizationTier)
      : false);

  if (!roleAllowed || !tierAllowed) {
    return <Navigate to="/unauthorized" replace />;
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
