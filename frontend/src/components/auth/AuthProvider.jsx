// src/components/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../utils/supabaseClient"; // ✅ your existing client

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");

async function fetchMe(accessToken) {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
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
  const [loading, setLoading] = useState(true);          // session loading
  const [loadingProfile, setLoadingProfile] = useState(false); // profile loading

  // Load session on mount + subscribe
  useEffect(() => {
    let unsub = null;
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      setLoading(false);

      unsub = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession || null);
      }).data?.subscription;
    })();
    return () => { unsub?.unsubscribe?.(); };
  }, []);

  // Load profile whenever session changes
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
        // invalid/expired token → sign out to avoid loops
        await supabase.auth.signOut();
        setProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [session]);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    accessToken: session?.access_token || null,
    profile,                // { id, email, role } | null
    role: profile?.role || null,
    loading,
    loadingProfile,
    async signOut() {
      await supabase.auth.signOut();
      setProfile(null);
    },
  }), [session, profile, loading, loadingProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
