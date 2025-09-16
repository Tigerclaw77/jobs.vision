// backend/middleware/auth.js (CommonJS)
const { supa } = require("../services/supaClient.js");

// --- tiny role cache to cut down DB lookups ---
const ROLE_CACHE_TTL_MS = 60 * 1000; // 1 minute
const roleCache = new Map(); // key: userId, value: { role, expiresAt }

function getCachedRole(userId) {
  const cached = roleCache.get(userId);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    roleCache.delete(userId);
    return null;
  }
  return cached.role || null;
}

function setCachedRole(userId, role) {
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
}

async function fetchRoleFromProfiles(userId) {
  const { data, error } = await supa
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data?.role || null;
}

async function ensureUserRole(req) {
  if (!req.user?.id) return;

  // 1) If the JWT already had a role (custom claims), trust it
  if (req.user.role) {
    setCachedRole(req.user.id, req.user.role);
    return;
  }

  // 2) Try cache
  const cached = getCachedRole(req.user.id);
  if (cached) {
    req.user.role = cached;
    return;
  }

  // 3) Fallback to DB
  const role = await fetchRoleFromProfiles(req.user.id);
  if (role) {
    req.user.role = role;
    setCachedRole(req.user.id, role);
  }
}

// Extract bearer token safely
function getBearerToken(req) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : null;
  return token || null;
}

// Requires: Authorization: Bearer <access_token>
async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const { data, error } = await supa.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });

    // Some SDKs put email on user, but guard anyway
    const email =
      data.user.email ||
      data.user.user_metadata?.email ||
      data.user.identities?.[0]?.identity_data?.email ||
      null;

    // basic identity
    req.user = {
      id: data.user.id,
      email,
      // some JWTs may carry custom claims (e.g., app_metadata / role)
      role:
        data.user.app_metadata?.role ||
        data.user.user_metadata?.role ||
        undefined,
    };

    // ensure role present (via cache/DB)
    await ensureUserRole(req);

    // also expose on res.locals for downstream middlewares if needed
    res.locals.user = req.user;

    return next();
  } catch (e) {
    console.error("Auth error:", e);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Optional: allow anonymous, but attach req.user if token present
async function maybeAuth(req, _res, next) {
  try {
    const token = getBearerToken(req);

    if (token) {
      const { data } = await supa.auth.getUser(token);
      if (data?.user) {
        const email =
          data.user.email ||
          data.user.user_metadata?.email ||
          data.user.identities?.[0]?.identity_data?.email ||
          null;

        req.user = {
          id: data.user.id,
          email,
          role:
            data.user.app_metadata?.role ||
            data.user.user_metadata?.role ||
            undefined,
        };
        await ensureUserRole(req);
        res.locals.user = req.user;
      }
    }
  } catch (_) {
    // swallow errors here: anonymous access is allowed
  } finally {
    next();
  }
}

module.exports = { requireAuth, maybeAuth };
