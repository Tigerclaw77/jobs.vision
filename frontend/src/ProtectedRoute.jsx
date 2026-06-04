// src/ProtectedRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminViewMode } from "./components/auth/AdminViewModeProvider";
import { useAuth } from "./components/auth/AuthProvider";

/**
 * Route guard:
 * - Uses AuthProvider as the source of truth for session/profile.
 * - Avoids duplicate /api/auth/me calls inside protected routes.
 * - Fails closed without flashing protected content.
 */
export default function ProtectedRoute({
  children,
  allowedUserRoles = [],
  allowedTiers = [],
}) {
  const loc = useLocation();
  const { isRealAdmin, mode, effectiveRole, effectivePlan } = useAdminViewMode();
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
  const role = String(
    authRole ||
      profile?.role ||
      account?.profile?.role ||
      account?.role ||
      metadata.role ||
      metadata.accountRole ||
      metadata.userRole ||
      ""
  ).toLowerCase();
  const tier = String(
    authTier ||
      account?.tier ||
      account?.entitlements?.tier ||
      metadata.tier ||
      ""
  ).toLowerCase();

  const hasEffectiveMode = isRealAdmin && mode !== "admin";
  const guardAuthed = hasEffectiveMode ? effectiveRole !== "guest" : Boolean(session);
  const guardRole =
    hasEffectiveMode && effectiveRole !== "guest"
      ? String(effectiveRole || "").toLowerCase()
      : role;
  const guardTier =
    hasEffectiveMode && effectiveRole !== "guest"
      ? String(effectivePlan || "").toLowerCase()
      : tier;

  if (loading || (session && loadingProfile && !guardRole)) {
    return <RouteLoading />;
  }

  if (!guardAuthed) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!guardRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (guardRole === "admin") return children;

  const roleAllowed =
    allowedUserRoles.length === 0 ||
    allowedUserRoles.map((r) => r.toLowerCase()).includes(guardRole);

  const tierAllowed =
    allowedTiers.length === 0 ||
    (guardTier ? allowedTiers.map((t) => t.toLowerCase()).includes(guardTier) : false);

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
