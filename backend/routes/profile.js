const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { buildUpdate, one } = require("../services/db");

const router = express.Router();

function shapeProfile(row = {}) {
  return {
    id: row.id,
    email: row.email || null,
    role: row.role || null,
    userRole: row.role || null,
    profile: {
      id: row.id,
      email: row.email || null,
      role: row.role || null,
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      company: row.company || null,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
    },
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const data = await one(
      "select id, email, role, first_name, last_name, company from public.profiles where id = $1",
      [req.user.id]
    );
    if (!data) return res.status(404).json({ error: "Profile not found" });

    return res.json(shapeProfile(data));
  } catch (err) {
    console.error("GET /api/profile error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const updates = {};
    const firstName = req.body?.firstName ?? req.body?.first_name;
    const lastName = req.body?.lastName ?? req.body?.last_name;

    if (firstName !== undefined) updates.first_name = String(firstName).trim();
    if (lastName !== undefined) updates.last_name = String(lastName).trim();
    if (req.body?.company !== undefined) {
      const company = String(req.body.company).trim();
      updates.company = company || null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No supported profile fields provided" });
    }

    updates.updated_at = new Date().toISOString();

    const update = buildUpdate("public.profiles", updates, "id = $" + (Object.keys(updates).length + 1), [req.user.id], {
      returning: "id, email, role, first_name, last_name, company",
    });
    const data = await one(update.text, update.params);
    if (!data) return res.status(404).json({ error: "Profile not found" });

    return res.json({
      message: "Profile updated successfully",
      ...shapeProfile(data),
    });
  } catch (err) {
    console.error("PUT /api/profile error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
