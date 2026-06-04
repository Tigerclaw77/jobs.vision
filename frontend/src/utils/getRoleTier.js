// src/utils/getRoleTier.js
import { getNeonSession, getNeonUser } from "./neonAuthClient";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function roleFromAccount(account, fallbackRole) {
  return account?.profile?.role || account?.role || fallbackRole || null;
}

function tierFromAccount(account, fallbackTier) {
  return account?.tier || account?.entitlements?.tier || fallbackTier || null;
}

export async function getRoleTier(options = {}) {
  const { account = null, user: providedUser = null, session: providedSession = null } = options || {};
  const { user } = providedUser ? { user: providedUser } : await getNeonUser();
  if (!user) return { role: null, tier: null, entitlements: null, user };

  const metadata = {
    ...(user.app_metadata || {}),
    ...(user.user_metadata || {}),
  };
  let role = metadata.role || metadata.accountRole || metadata.userRole || null;
  let tier = metadata.tier || null;

  if (account) {
    role = roleFromAccount(account, role);
    tier = tierFromAccount(account, tier);
    return {
      role,
      tier: tier || null,
      entitlements: account?.entitlements || null,
      user,
    };
  }

  const { session } = providedSession
    ? { session: providedSession }
    : await getNeonSession();
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
