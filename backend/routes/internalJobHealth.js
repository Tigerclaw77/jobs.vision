const crypto = require("node:crypto");
const express = require("express");
const { runDueJobHealthChecks } = require("../services/jobHealth/runner");

const router = express.Router();

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

router.get("/run", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({
      ok: false,
      error: "Job Health scheduling is not configured.",
    });
  }
  if (!secureEqual(req.get("authorization"), `Bearer ${cronSecret}`)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  try {
    const limit = Math.min(
      100,
      Math.max(1, Number(process.env.JOB_HEALTH_CRON_BATCH_SIZE || 25))
    );
    const concurrency = Math.min(
      10,
      Math.max(1, Number(process.env.JOB_HEALTH_CONCURRENCY || 5))
    );
    const summary = await runDueJobHealthChecks({ limit, concurrency });
    return res.json({ ok: true, ...summary });
  } catch (error) {
    console.error("Job Health cron failed:", error);
    return res.status(500).json({
      ok: false,
      error: "Job Health worker failed.",
    });
  }
});

module.exports = router;

