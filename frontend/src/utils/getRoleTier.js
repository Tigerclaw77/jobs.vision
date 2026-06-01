// src/utils/getRoleTier.js
import { getNeonSession, getNeonUser } from "./neonAuthClient";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export async function getRoleTier() {
  const { user } = await getNeonUser();
  if (!user) return { role: null, tier: null, entitlements: null, user };

  const metadata = {
    ...(user.app_metadata || {}),
    ...(user.user_metadata || {}),
  };
  let role = metadata.role || metadata.accountRole || metadata.userRole || null;
  let tier = metadata.tier || null;

  const { session } = await getNeonSession();
  const token = session?.access_token;

  if (token) {
    try {
      const res = await fetch(`${apiBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        role = data?.profile?.role || data?.role || role;
        tier = data?.tier || data?.entitlements?.tier || tier;
        return {
          role,
          tier: tier || null,
          entitlements: data?.entitlements || null,
          user,
        };
      }
    } catch {}
  }

  return { role, tier: tier || null, entitlements: null, user };
}
