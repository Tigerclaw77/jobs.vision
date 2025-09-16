// src/ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./utils/supabaseClient";
import { getRoleTier } from "./utils/getRoleTier";

/**
 * Minimal route guard:
 * - Reads session from Supabase directly.
 * - Resolves role (and optionally tier) via getRoleTier().
 * - Admin bypass.
 * - Preserves ?next= on redirect.
 * - No external providers. No styling changes.
 */
export default function ProtectedRoute({
  children,
  allowedUserRoles = [],
  allowedTiers = [],
}) {
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState(null);
  const [tier, setTier] = useState(null);

  const needsTier = allowedTiers.length > 0;

  useEffect(() => {
    let alive = true;

    async function load() {
      // 1) Session
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      if (!data?.session) {
        setAuthed(false);
        setReady(true);
        return;
      }

      // 2) Role (and tier if requested)
      try {
        const rt = await getRoleTier(); // expected { role, tier }
        if (!alive) return;

        setAuthed(true);
        setRole(rt?.role ? String(rt.role).toLowerCase() : null);
        setTier(rt?.tier ? String(rt.tier).toLowerCase() : null);
      } catch {
        if (!alive) return;
        setAuthed(true);
        setRole(null);
        setTier(null);
      } finally {
        if (alive) setReady(true);
      }
    }

    load();
    const sub = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!alive) return;
      if (!session) {
        setAuthed(false);
        setRole(null);
        setTier(null);
        setReady(true);
      } else {
        // re-run load to refresh role/tier
        load();
      }
    });

    return () => {
      alive = false;
      sub.data?.subscription?.unsubscribe?.();
    };
  }, [needsTier]);

  // Wait until we definitively know session/role
  if (!ready) return null;

  // Not authenticated → bounce to login with ?next=
  if (!authed) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // If role hasn’t resolved yet, pause to avoid mis-routing
  if (!role) return null;

  // Admin bypass
  if (role === "admin") return children;

  // Role gating
  const roleAllowed =
    allowedUserRoles.length === 0 ||
    allowedUserRoles.map((r) => r.toLowerCase()).includes(role);

  // Tier gating (only if requested)
  const tierAllowed =
    allowedTiers.length === 0 ||
    (tier ? allowedTiers.map((t) => t.toLowerCase()).includes(tier) : false);

  if (!roleAllowed || !tierAllowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
