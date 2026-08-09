const express = require("express");
const { runBillingSummary } = require("../controllers/billingController");
const { one } = require("../services/db");
const { runMaintenance } = require("../services/jobMaintenance");

const router = express.Router();

function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "CRON_SECRET is not configured." });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

router.use(requireCronSecret);

router.get("/billing", async (_req, res) => {
  let run = null;
  try {
    run = await one(
      "insert into public.job_maintenance_runs (run_type) values ('billing') returning id"
    );
    const metrics = await runBillingSummary();
    await one(
      `
        update public.job_maintenance_runs
        set status = 'success', completed_at = now(), metrics = $2::jsonb
        where id = $1
        returning id
      `,
      [run.id, JSON.stringify(metrics)]
    );
    return res.json({ ok: true, runId: run.id, metrics });
  } catch (error) {
    if (run?.id) {
      await one(
        `
          update public.job_maintenance_runs
          set status = 'failed', completed_at = now(), error_message = $2
          where id = $1
          returning id
        `,
        [run.id, error?.message || "Billing summary failed."]
      );
    }
    console.error("Billing cron error", error);
    return res.status(500).json({ error: "Billing cron failed." });
  }
});

router.get("/maintenance", async (_req, res) => {
  try {
    return res.json(await runMaintenance());
  } catch (error) {
    console.error("Job maintenance cron error", error);
    return res.status(500).json({ error: "Job maintenance cron failed." });
  }
});

module.exports = router;
