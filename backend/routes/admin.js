// backend/routes/admin.js
const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { one } = require("../services/db");

const router = express.Router();

// GET /api/admin/dashboard
router.get("/dashboard", requireAdmin(), async (_req, res) => {
  try {
    const [jobs, users, apps] = await Promise.all([
      one("select count(*)::int as count from public.jobs"),
      one("select count(*)::int as count from public.profiles"),
      one("select count(*)::int as count from public.job_applications"),
    ]);

    res.json({
      counts: {
        jobs: jobs?.count ?? 0,
        users: users?.count ?? 0,
        applications: apps?.count ?? 0,
      },
    });
  } catch (e) {
    console.error("admin/dashboard error", e);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
