// src/components/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getNeonSession, neonAuth, normalizeSessionResult } from "../../utils/neonAuthClient";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

async function fetchMe(accessToken) {
  const res = await fetch(`${apiBaseUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("unauthorized");
  return res.json(); // { id, email, role, profile: { id,email,role } }
}

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider/>");
  return ctx;
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    let unsub = null;
    let alive = true;

    (async () => {
      setLoading(true);
      const { session: currentSession } = await getNeonSession();
      if (!alive) return;

      setSession(currentSession || null);
      setLoading(false);

      unsub = neonAuth.onAuthStateChange((_event, nextSession) => {
        setSession(normalizeSessionResult({ data: { session: nextSession } }) || null);
      }).data?.subscription;
    })();

    return () => {
      alive = false;
      unsub?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!session) {
        setProfile(null);
        return;
      }

      setLoadingProfile(true);
      try {
        const me = await fetchMe(session.access_token);
        setProfile(me.profile || { id: me.id, email: me.email, role: me.role });
      } catch {
        await neonAuth.signOut();
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [session]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      accessToken: session?.access_token || null,
      profile,
      role: profile?.role || null,
      loading,
      loadingProfile,
      async signOut() {
        await neonAuth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, loading, loadingProfile]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
