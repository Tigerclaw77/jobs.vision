// backend/middleware/auth.js (CommonJS)
const { one } = require("../services/db.js");
const { verifyNeonAuthToken } = require("../services/neonAuthVerifier.js");
const { ensureProfileForAuthUser } = require("../services/profileBootstrap.js");

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
  const row = await one("select role from public.profiles where id = $1", [userId]);
  return row?.role || null;
}

async function ensureUserRole(req) {
  if (!req.user?.id) return;

  if (req.profile?.role) {
    req.user.role = req.profile.role;
    setCachedRole(req.user.id, req.profile.role);
    return;
  }

  // 1) Try cache
  const cached = getCachedRole(req.user.id);
  if (cached) {
    req.user.role = cached;
    return;
  }

  // 2) Prefer the canonical profile role. Fall back only to app_metadata.
  const role = await fetchRoleFromProfiles(req.user.id);
  if (role) {
    req.user.role = role;
    setCachedRole(req.user.id, role);
  } else if (req.user.role) {
    setCachedRole(req.user.id, req.user.role);
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

    const user = await verifyNeonAuthToken(token);

    // basic identity
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || undefined,
      claims: user.claims || {},
    };

    const profile = await ensureProfileForAuthUser(req.user);
    req.profile = profile;
    res.locals.profile = profile;

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
async function maybeAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (token) {
      const user = await verifyNeonAuthToken(token);
      if (user?.id) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role || undefined,
          claims: user.claims || {},
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

function requireRole(allowedRoles = []) {
  const allowed = new Set(allowedRoles.map((role) => String(role).toLowerCase()));

  return async function requireRoleMiddleware(req, res, next) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      await ensureUserRole(req);
      const role = String(req.user.role || "").toLowerCase();

      if (!role || !allowed.has(role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      return next();
    } catch (e) {
      console.error("Role check error:", e);
      return res.status(500).json({ error: "Authorization failed" });
    }
  };
}

module.exports = { requireAuth, maybeAuth, requireRole };
