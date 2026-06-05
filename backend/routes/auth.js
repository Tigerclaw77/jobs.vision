// backend/routes/auth.js
const express = require("express");
const { requireAuth } = require("../middleware/auth.js");
const { one } = require("../services/db.js");
const { getUserEntitlements } = require("../services/entitlements.js");
const { upsertProfileForAuthUser } = require("../services/profileBootstrap.js");
const { getProfileSelectList, shapeProfile } = require("../services/profileDetails.js");

const router = express.Router();

/**
 * GET /api/auth/me
 * Returns:
 *  - flat user fields for backward compatibility: { id, email, role }
 *  - plus a nested profile object: { profile: { id, email, role } }
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    let profile = null;

    // Pull canonical role/email from profiles so callers can rely on it
    const selectList = await getProfileSelectList();
    const data = await one(`select ${selectList} from public.profiles where id = $1`, [
      req.user.id,
    ]);

    if (data) {
      profile = shapeProfile(data).profile;
      // Keep flat role in sync if DB has it
      if (data.role && data.role !== req.user.role) {
        req.user.role = data.role;
      }
      // Prefer DB email if present
      if (data.email && data.email !== req.user.email) {
        req.user.email = data.email;
      }
    }

    const entitlements = await getUserEntitlements(req.user);

    // Backward compatible shape + richer nested profile
    res.json({
      id: req.user.id,
      email: req.user.email || null,
      role: req.user.role || null,
      tier: entitlements.tier || null,
      entitlements,
      profile, // { id, email, role } or null
    });
  } catch (e) {
    console.error("Auth me error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bootstrap-profile", requireAuth, async (req, res) => {
  try {
    const profile = await upsertProfileForAuthUser(req.user, req.body || {});
    const entitlements = await getUserEntitlements({
      ...req.user,
      role: profile.role || req.user.role,
    });

    res.status(201).json({
      id: req.user.id,
      email: profile.email || req.user.email || null,
      role: profile.role || null,
      tier: entitlements.tier || null,
      entitlements,
      profile,
    });
  } catch (e) {
    console.error("Bootstrap profile error:", e);
    res.status(500).json({ error: "Failed to bootstrap profile" });
  }
});

module.exports = router;
