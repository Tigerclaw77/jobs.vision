// backend/routes/applications.js
const express = require("express");
const { one, query } = require("../services/db.js");
const { requireAuth, requireRole } = require("../middleware/auth.js");
const crypto = require("crypto");

const router = express.Router();

/**
 * POST /api/applications
 * Body: { job_id, resume_url?, cover_letter? }
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: "job_id required" });

    const data = await one(
      `
        insert into public.job_applications (id, user_id, job_id, status)
        values ($1, $2, $3, 'submitted')
        on conflict (user_id, job_id) do update set
          updated_at = public.job_applications.updated_at
        returning *
      `,
      [crypto.randomUUID(), req.user.id, job_id]
    );

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
