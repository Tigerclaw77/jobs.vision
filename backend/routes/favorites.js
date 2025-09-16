// backend/routes/favorites.js
const express = require("express");
const { supa } = require("../services/supaClient.js");
const { requireAuth } = require("../middleware/auth.js");

const router = express.Router();

/**
 * GET /api/favorites
 * List current user's favorites
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supa
      .from("job_favorites")
      .select("job_id, created_at, jobs(*)")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    console.error("List favorites error:", e);
    res.status(500).json({ error: "Failed to list favorites" });
  }
});

/**
 * POST /api/favorites
 * Body: { job_id }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: "job_id required" });

    const { data, error } = await supa
      .from("job_favorites")
      .insert({ user_id: req.user.id, job_id })
      .select()
      .single();

    // ignore duplicate unique errors gracefully
    if (error && error.code !== "23505") throw error;

    res.status(201).json(data || { ok: true });
  } catch (e) {
    console.error("Add favorite error:", e);
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

/**
 * DELETE /api/favorites/:jobId
 */
router.delete("/:jobId", requireAuth, async (req, res) => {
  try {
    const jobId = req.params.jobId;
    const { error } = await supa
      .from("job_favorites")
      .delete()
      .eq("user_id", req.user.id)
      .eq("job_id", jobId);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error("Remove favorite error:", e);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

module.exports = router;
