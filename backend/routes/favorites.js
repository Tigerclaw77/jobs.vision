// backend/routes/favorites.js
const express = require("express");
const { one, query } = require("../services/db.js");
const { requireAuth } = require("../middleware/auth.js");
const { getCandidateSaveState } = require("../services/entitlements.js");

const router = express.Router();

/**
 * GET /api/favorites
 * List current user's favorites
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        select
          f.job_id,
          f.created_at,
          row_to_json(j) as jobs
        from public.job_favorites f
        left join public.jobs j on j.id = f.job_id
        where f.user_id = $1
        order by f.created_at desc
      `,
      [req.user.id]
    );

    res.json(result.rows);
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

    const existing = await one(
      "select user_id, job_id, created_at from public.job_favorites where user_id = $1 and job_id = $2",
      [req.user.id, job_id]
    );

    if (existing) return res.status(200).json(existing);

    const role = String(req.user.role || "").toLowerCase();
    if (role !== "admin") {
      const saveState = await getCandidateSaveState(req.user.id);
      if (!saveState.canSaveMore) {
        return res.status(402).json({
          error:
            "Free candidates can save up to 5 jobs. Upgrade to Plus or Premium for unlimited saves.",
          code: "save_limit_reached",
          entitlement: saveState.entitlement,
          savedJobCount: saveState.savedJobCount,
          saveLimit: saveState.saveLimit,
        });
      }
    }

    const data = await one(
      `
        insert into public.job_favorites (user_id, job_id)
        values ($1, $2)
        on conflict (user_id, job_id) do nothing
        returning *
      `,
      [req.user.id, job_id]
    );

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
    await query(
      "delete from public.job_favorites where user_id = $1 and job_id = $2",
      [req.user.id, req.params.jobId]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("Remove favorite error:", e);
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

module.exports = router;
