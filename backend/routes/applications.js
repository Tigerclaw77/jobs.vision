// backend/routes/applications.js
const express = require("express");
const { supa } = require("../services/supaClient.js");
const { requireAuth } = require("../middleware/auth.js");
const crypto = require("crypto");

const router = express.Router();

/**
 * POST /api/applications
 * Body: { job_id, resume_url?, cover_letter? }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { job_id, resume_url, cover_letter } = req.body;
    if (!job_id) return res.status(400).json({ error: "job_id required" });

    const { data, error } = await supa
      .from("job_applications")
      .insert({
        id: crypto.randomUUID(),
        user_id: req.user.id,
        job_id,
        status: "submitted",
        // resume_url,
        // cover_letter,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    console.error("Create application error:", e);
    res.status(500).json({ error: "Failed to apply" });
  }
});

/**
 * GET /api/applications/mine
 * Candidate sees their applications
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supa
      .from("job_applications")
      .select("*, jobs(title, company, city, state)")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("List my applications error:", e);
    res.status(500).json({ error: "Failed to list applications" });
  }
});

/**
 * GET /api/applications/for-my-jobs
 * Recruiter sees applications for jobs they own
 */
router.get("/for-my-jobs", requireAuth, async (req, res) => {
  try {
    const recruiter_id = req.user.id;

    const { data, error } = await supa
      .from("job_applications")
      .select("*, jobs!inner(id, title, company)")
      .filter("jobs.recruiter_id", "eq", recruiter_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("List applications for my jobs error:", e);
    res.status(500).json({ error: "Failed to list applications" });
  }
});

module.exports = router;
