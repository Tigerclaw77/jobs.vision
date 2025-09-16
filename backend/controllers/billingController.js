// backend/controllers/billingController.js
const { supa } = require("../services/supaClient.js");

/**
 * Bill jobs monthly (placeholder implementation).
 * For now it summarizes active jobs per recruiter using Supabase,
 * so the cron can run without Mongo models.
 */
async function billJobsMonthly(req, res) {
  try {
    // Pull all jobs (min fields) and summarize in JS
    const { data: jobs, error } = await supa
      .from("jobs")
      .select("id,recruiter_id,is_archived");

    if (error) throw error;

    const byRecruiter = {};
    let activeCount = 0;

    for (const j of jobs || []) {
      if (j && j.recruiter_id && j.is_archived === false) {
        activeCount += 1;
        byRecruiter[j.recruiter_id] = (byRecruiter[j.recruiter_id] || 0) + 1;
      }
    }

    // Return a summary (you can extend to write invoices/usage later)
    return res.status(200).json({
      ok: true,
      total_jobs: (jobs || []).length,
      active_jobs: activeCount,
      recruiters_with_active: Object.keys(byRecruiter).length,
      breakdown: byRecruiter, // { recruiter_id: activeJobCount }
    });
  } catch (err) {
    console.error("Billing run failed:", err);
    return res.status(500).json({ error: "Billing run failed" });
  }
}

module.exports = { billJobsMonthly };
