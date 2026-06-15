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
  const url = `${apiBaseUrl()}/auth/me`;

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    error.requestUrl = url;
    throw error;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`unauthorized (${res.status})`);
  return body; // { id, email, role, profile: { id,email,role } }
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
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    try {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
    } catch {
      /* Legacy bearer tokens are no longer an auth source. */
    }
  }, []);

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
        setProfileError(null);
        setLoadingProfile(false);
        return { session: null, account: null, profile: null };
      }

      setLoadingProfile(true);
      let me = null;
      try {
        me = await fetchMe(nextSession.access_token);
      } catch (profileLookupError) {
        const nextProfileError = {
          message: profileLookupError?.message || String(profileLookupError),
          url: profileLookupError?.requestUrl || `${apiBaseUrl()}/auth/me`,
        };
        setAccount(null);
        setProfile(null);
        setProfileError(nextProfileError);
        return {
          session: nextSession,
          account: null,
          profile: null,
          profileError: nextProfileError,
        };
      }

      const nextProfile = me.profile || { id: me.id, email: me.email, role: me.role };

      setAccount(me || null);
      setProfile(nextProfile);
      setProfileError(null);

      return {
        session: nextSession,
        account: me || null,
        profile: nextProfile,
        profileError: null,
      };
    } catch (error) {
      await neonAuth.signOut();
      setSession(null);
      setAccount(null);
      setProfile(null);
      setProfileError({
        message: error?.message || String(error),
        url: error?.requestUrl || null,
      });
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
        profileError,
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
          setProfileError(null);
        },
      };
    },
    [session, account, profile, profileError, loading, refreshingAuth, loadingProfile, refreshAuth]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
