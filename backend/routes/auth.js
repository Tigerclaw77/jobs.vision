// backend/routes/auth.js
const express = require("express");
const { requireAuth } = require("../middleware/auth.js");
const { supa } = require("../services/supaClient.js");

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
    const { data, error } = await supa
      .from("profiles")
      .select("id,email,role")
      .eq("id", req.user.id)
      .single();

    if (!error && data) {
      profile = data;
      // Keep flat role in sync if DB has it
      if (data.role && data.role !== req.user.role) {
        req.user.role = data.role;
      }
      // Prefer DB email if present
      if (data.email && data.email !== req.user.email) {
        req.user.email = data.email;
      }
    }

    // Backward compatible shape + richer nested profile
    res.json({
      id: req.user.id,
      email: req.user.email || null,
      role: req.user.role || null,
      profile, // { id, email, role } or null
    });
  } catch (e) {
    console.error("Auth me error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
