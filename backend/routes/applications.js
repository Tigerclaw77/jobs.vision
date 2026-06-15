// backend/routes/applications.js
const express = require("express");
const { one, query } = require("../services/db.js");
const { requireAuth, requireRole } = require("../middleware/auth.js");
const { sendEmail } = require("../services/email.js");
const crypto = require("crypto");

const router = express.Router();
const APP_URL = (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function displayName(profile = {}, fallback = "Candidate") {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return name || profile.email || fallback;
}

async function notifyRecruiterOfApplication({ application, job, candidate, recruiter }) {
  if (!recruiter?.email) return { sent: false, skipped: true, reason: "missing-recipient" };

  const candidateName = displayName(candidate);
  const submittedAt = application.created_at
    ? new Date(application.created_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const dashboardUrl = `${APP_URL}/recruiter/applications`;
  const subject = `New application for ${job.title || "your jobs.vision posting"}`;
  const safeCandidateName = escapeHtml(candidateName);
  const safeJobTitle = escapeHtml(job.title || "Untitled job");
  const safeSubmittedAt = escapeHtml(submittedAt);
  const text = [
    `A candidate applied to ${job.title || "your jobs.vision posting"}.`,
    "",
    `Candidate: ${candidateName}`,
    `Job: ${job.title || "Untitled job"}`,
    `Submitted: ${submittedAt}`,
    "",
    `Review applications: ${dashboardUrl}`,
  ].join("\n");

  return sendEmail({
    to: recruiter.email,
    subject,
    text,
    html: `
      <p>A candidate applied to <strong>${safeJobTitle}</strong>.</p>
      <ul>
        <li><strong>Candidate:</strong> ${safeCandidateName}</li>
        <li><strong>Job:</strong> ${safeJobTitle}</li>
        <li><strong>Submitted:</strong> ${safeSubmittedAt}</li>
      </ul>
      <p><a href="${dashboardUrl}">Review applications in jobs.vision</a></p>
    `,
  });
}

/**
 * POST /api/applications
 * Body: { job_id, resume_url?, cover_letter? }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: "job_id required" });

    const existing = await one(
      "select * from public.job_applications where user_id = $1 and job_id = $2",
      [req.user.id, job_id]
    );
    if (existing) return res.status(200).json(existing);

    const data = await one(
      `
        insert into public.job_applications (id, user_id, job_id, status)
        values ($1, $2, $3, 'submitted')
        returning *
      `,
      [crypto.randomUUID(), req.user.id, job_id]
    );

    const details = await one(
      `
        select
          j.id as job_id,
          j.title as job_title,
          j.recruiter_id,
          j.posted_by,
          candidate.email as candidate_email,
          candidate.first_name as candidate_first_name,
          candidate.last_name as candidate_last_name,
          recruiter.email as recruiter_email,
          recruiter.email_notifications as recruiter_email_notifications
        from public.jobs j
        left join public.profiles candidate on candidate.id = $1
        left join public.profiles recruiter on recruiter.id = coalesce(j.recruiter_id, j.posted_by)
        where j.id = $2
      `,
      [req.user.id, job_id]
    );

    let notification = { sent: false, skipped: true, reason: "missing-details" };
    if (details?.recruiter_email && details.recruiter_email_notifications !== false) {
      try {
        notification = await notifyRecruiterOfApplication({
          application: data,
          job: {
            id: details.job_id,
            title: details.job_title,
          },
          candidate: {
            email: details.candidate_email || req.user.email,
            first_name: details.candidate_first_name,
            last_name: details.candidate_last_name,
          },
          recruiter: {
            email: details.recruiter_email,
          },
        });
      } catch (mailError) {
        console.error("Applicant notification email error:", mailError);
        notification = { sent: false, skipped: true, reason: "send-failed" };
      }
    }

    res.status(201).json({ ...data, notification });
  } catch (e) {
    console.error("Create application error:", e);
    res.status(500).json({ error: "Failed to apply" });
  }
});

/**
 * DELETE /api/applications/:jobId
 * Remove the current user's applied marker for a job.
 */
router.delete("/:jobId", requireAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: "jobId required" });

    const result = await query(
      "delete from public.job_applications where user_id = $1 and job_id = $2 returning id",
      [req.user.id, jobId]
    );

    res.json({ removed: result.rowCount > 0 });
  } catch (e) {
    console.error("Remove application error:", e);
    res.status(500).json({ error: "Failed to remove applied marker" });
  }
});

/**
 * GET /api/applications/mine
 * Candidate sees their applications
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const result = await query(
      `
        select
          a.*,
          json_build_object(
            'title', j.title,
            'company', j.company,
            'city', j.city,
            'state', j.state
          ) as jobs
        from public.job_applications a
        left join public.jobs j on j.id = a.job_id
        where a.user_id = $1
        order by a.created_at desc
      `,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (e) {
    console.error("List my applications error:", e);
    res.status(500).json({ error: "Failed to list applications" });
  }
});

/**
 * GET /api/applications/for-my-jobs
 * Recruiter sees applications for jobs they own
 */
router.get("/for-my-jobs", requireAuth, requireRole(["recruiter", "admin"]), async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const isAdmin = String(req.user.role || "").toLowerCase() === "admin";

    const result = await query(
      `
        select
          a.id,
          a.user_id,
          a.job_id,
          a.status,
          a.created_at,
          json_build_object(
            'id', j.id,
            'title', j.title,
            'company', j.company,
            'employer_name', j.employer_name,
            'recruiter_id', j.recruiter_id
          ) as jobs,
          case
            when p.id is null then null
            else json_build_object(
              'id', p.id,
              'email', p.email,
              'first_name', p.first_name,
              'last_name', p.last_name
            )
          end as applicant
        from public.job_applications a
        inner join public.jobs j on j.id = a.job_id
        left join public.profiles p on p.id = a.user_id
        where ($2::boolean = true or j.recruiter_id = $1 or j.posted_by = $1)
        order by a.created_at desc
      `,
      [recruiterId, isAdmin]
    );

    res.json(result.rows);
  } catch (e) {
    console.error("List applications for my jobs error:", e);
    res.status(500).json({ error: "Failed to list applications" });
  }
});

module.exports = router;
