// src/components/auth/AuthProvider.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [refreshingAuth, setRefreshingAuth] = useState(false);

  const refreshAuth = useCallback(async (sessionResult) => {
    setRefreshingAuth(true);

    try {
      const nextSession =
        sessionResult !== undefined
          ? normalizeSessionResult(sessionResult) ||
            normalizeSessionResult({ data: { session: sessionResult } }) ||
            sessionResult ||
            null
          : (await getNeonSession()).session || null;

      setSession(nextSession);

      if (!nextSession?.access_token) {
        setAccount(null);
        setProfile(null);
        setLoadingProfile(false);
        return { session: null, account: null, profile: null };
      }

      setLoadingProfile(true);
      const me = await fetchMe(nextSession.access_token);
      const nextProfile =
        me.profile || { id: me.id, email: me.email, role: me.role };

      setAccount(me || null);
      setProfile(nextProfile);

      return {
        session: nextSession,
        account: me || null,
        profile: nextProfile,
      };
    } catch (error) {
      await neonAuth.signOut();
      setSession(null);
      setAccount(null);
      setProfile(null);
      throw error;
    } finally {
      setLoadingProfile(false);
      setRefreshingAuth(false);
    }
  }, []);

  useEffect(() => {
    let unsub = null;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        await refreshAuth();
      } catch {
        // refreshAuth signs out and clears state when the stored session is invalid.
      } finally {
        if (!alive) return;
        setLoading(false);
      }

      unsub = neonAuth.onAuthStateChange((_event, nextSession) => {
        refreshAuth(nextSession).catch(() => {});
      }).data?.subscription;
    })();

    return () => {
      alive = false;
      unsub?.unsubscribe?.();
    };
  }, [refreshAuth]);

  const value = useMemo(
    () => {
      const metadata = {
        ...(session?.user?.app_metadata || {}),
        ...(session?.user?.user_metadata || {}),
      };
      const role =
        profile?.role ||
        account?.profile?.role ||
        account?.role ||
        metadata.role ||
        metadata.accountRole ||
        metadata.userRole ||
        null;
      const tier =
        account?.tier ||
        account?.entitlements?.tier ||
        metadata.tier ||
        null;

      return {
        session,
        user: session?.user || null,
        accessToken: session?.access_token || null,
        account,
        profile,
        role,
        tier,
        entitlements: account?.entitlements || null,
        loading: loading || refreshingAuth,
        loadingProfile,
        refreshAuth,
        async signOut() {
          await neonAuth.signOut();
          setSession(null);
          setAccount(null);
          setProfile(null);
        },
      };
    },
    [session, account, profile, loading, refreshingAuth, loadingProfile, refreshAuth]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
