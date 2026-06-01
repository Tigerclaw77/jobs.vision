// backend/routes/jobs.js
const express = require("express");
const { buildInsert, buildUpdate, one, query } = require("../services/db.js");
const { requireAuth, maybeAuth, requireRole } = require("../middleware/auth.js");
const { getRecruiterJobLimitState } = require("../services/entitlements.js");

const {
  normalizeDomain,
  detectBrandKeyFromText,
  acceptedDomainsForBrand,
  brandByKey,
} = require("../services/brandRegistry");

const router = express.Router();
const requireJobManager = requireRole(["recruiter", "admin"]);

const PUBLIC_JOB_COLUMNS = [
  "id",
  "title",
  "description",
  "location",
  "city",
  "state",
  "latitude",
  "longitude",
  "role",
  "hours",
  "type",
  "opportunity_type",
  "practice_type",
  "employment_type",
  "salary",
  "tag_ids",
  "posted_at",
  "employer_name",
  "employer_brand",
  "employer_brand_verified",
  "venue_brand",
  "venue_name",
  "venue_store_id",
  "venue_note",
  "status",
].join(",");

function isAdmin(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

function canManageJob(user, job) {
  return isAdmin(user) || job?.recruiter_id === user?.id || job?.posted_by === user?.id;
}

async function enforceRecruiterCanPost(req, res, excludeJobId = null) {
  if (isAdmin(req.user)) return false;

  const limitState = await getRecruiterJobLimitState(req.user.id, excludeJobId);

  if (!limitState.entitlement.active) {
    res.status(402).json({
      error: "Active recruiter subscription required to post jobs.",
      code: "recruiter_subscription_required",
      entitlement: limitState.entitlement,
    });
    return true;
  }

  if (!limitState.canPost) {
    const max = limitState.maxActiveJobs;
    res.status(402).json({
      error: `Your ${limitState.entitlement.tier || "current"} plan allows ${max} active job${max === 1 ? "" : "s"}. Archive a job or upgrade to post more.`,
      code: "job_limit_reached",
      entitlement: limitState.entitlement,
      activeJobCount: limitState.activeJobCount,
      maxActiveJobs: limitState.maxActiveJobs,
    });
    return true;
  }

  return false;
}

function normalizeBrand(value) {
  if (!value) return null;
  const asKey = brandByKey(value)?.key;
  return asKey || detectBrandKeyFromText(value) || value;
}

function toTagIds(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function toNullableNumber(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function stripUnverifiedBrandFromName(employerName, venueBrand, venueName) {
  if (!employerName) return { employerName, venueBrand, venueName, employerBrand: undefined };

  const hitKey = detectBrandKeyFromText(employerName);
  if (!hitKey) return { employerName, venueBrand, venueName, employerBrand: undefined };

  const brand = brandByKey(hitKey);
  let nextName = employerName;
  const aliases = (brand?.aliases || []).map((alias) =>
    alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );

  if (aliases.length) {
    const re = new RegExp(aliases.join("|"), "ig");
    nextName = employerName.replace(re, "").replace(/\s{2,}/g, " ").trim();
  }

  return {
    employerName: nextName || null,
    venueBrand: venueBrand || brand?.key || null,
    venueName: venueName || brand?.label || null,
    employerBrand: null,
  };
}

async function isBrandVerifiedForRecruiter(recruiterId, employerBrand, employerDomain) {
  if (!employerBrand || !brandByKey(employerBrand)) return false;

  const accepted = acceptedDomainsForBrand(employerBrand).map(normalizeDomain);
  const candidates = new Set(accepted);
  if (employerDomain) candidates.add(normalizeDomain(employerDomain));

  const result = await query(
    "select domain, status from public.recruiter_domains where user_id = $1",
    [recruiterId]
  );

  return (result.rows || []).some(
    (domain) =>
      domain.status === "verified" && candidates.has(normalizeDomain(domain.domain))
  );
}

router.get("/", maybeAuth, async (req, res) => {
  try {
    const { q, city, state, tags, limit = "20", offset = "0" } = req.query;
    const tagIds = typeof tags === "string" && tags.length ? tags.split(",") : [];
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    const where = ["status = 'active'", "is_archived = false"];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(`title ilike $${params.length}`);
    }
    if (city) {
      params.push(city);
      where.push(`city = $${params.length}`);
    }
    if (state) {
      params.push(state);
      where.push(`state = $${params.length}`);
    }
    if (tagIds.length) {
      params.push(tagIds);
      where.push(`tag_ids @> $${params.length}::text[]`);
    }

    params.push(safeLimit);
    const limitParam = params.length;
    params.push(safeOffset);
    const offsetParam = params.length;

    const result = await query(
      `
        select ${PUBLIC_JOB_COLUMNS}
        from public.jobs
        where ${where.join(" and ")}
        order by posted_at desc
        limit $${limitParam}
        offset $${offsetParam}
      `,
      params
    );

    res.json(result.rows);
  } catch (e) {
    console.error("List jobs error:", e);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

router.get("/recruiter", requireAuth, requireJobManager, async (req, res) => {
  try {
    const result = isAdmin(req.user)
      ? await query("select * from public.jobs order by posted_at desc")
      : await query(
          "select * from public.jobs where recruiter_id = $1 or posted_by = $1 order by posted_at desc",
          [req.user.id]
        );

    return res.json({ data: result.rows || [] });
  } catch (e) {
    console.error("Recruiter jobs error:", e);
    return res.status(500).json({ error: "Failed to fetch recruiter jobs" });
  }
});

router.get("/:id", requireAuth, requireJobManager, async (req, res) => {
  try {
    const job = await one("select * from public.jobs where id = $1", [req.params.id]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(job);
  } catch (e) {
    console.error("Fetch job error:", e);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.post("/", requireAuth, requireJobManager, async (req, res) => {
  try {
    const user = req.user;
    const recruiter_id = user.id;
    const nowIso = new Date().toISOString();

    if (await enforceRecruiterCanPost(req, res)) return;

    let employer_name = req.body.employer_name ?? req.body.company ?? null;
    let employer_brand = normalizeBrand(req.body.employer_brand ?? req.body.brand ?? null);
    let employer_domain = normalizeDomain(req.body.employer_domain ?? req.body.company_domain ?? "");
    let venue_brand = normalizeBrand(req.body.venue_brand ?? null);
    let venue_name = req.body.venue_name ?? null;

    const venue_store_id = req.body.venue_store_id ?? null;
    const venue_note = req.body.venue_note ?? null;

    let status = "active";
    let employer_brand_verified = false;

    if (employer_brand && brandByKey(employer_brand)) {
      employer_brand_verified = await isBrandVerifiedForRecruiter(
        recruiter_id,
        employer_brand,
        employer_domain
      );

      if (!employer_brand_verified) status = "pending_domain";
    }

    if (!employer_brand_verified && employer_name) {
      const downgraded = stripUnverifiedBrandFromName(
        employer_name,
        venue_brand,
        venue_name
      );
      employer_name = downgraded.employerName;
      venue_brand = downgraded.venueBrand;
      venue_name = downgraded.venueName;
      if (downgraded.employerBrand === null) {
        employer_brand = null;
        employer_domain = null;
      }
    }

    const payload = {
      title: req.body.title,
      description: req.body.description ?? null,
      company: employer_name ?? null,
      employer_name: employer_name ?? null,
      location: req.body.location ?? null,
      city: req.body.city ?? null,
      state: req.body.state ?? null,
      latitude: toNullableNumber(req.body.latitude),
      longitude: toNullableNumber(req.body.longitude),
      role: req.body.role ?? null,
      hours: req.body.hours ?? null,
      type: req.body.type ?? req.body.employment_type ?? null,
      opportunity_type: toNullableText(req.body.opportunity_type),
      practice_type: toNullableText(req.body.practice_type),
      employment_type: toNullableText(req.body.employment_type),
      salary: req.body.salary ?? null,
      tag_ids: toTagIds(req.body.tag_ids),
      recruiter_id,
      is_archived: false,
      posted_at: nowIso,
      employer_brand: employer_brand ?? null,
      employer_domain: employer_brand_verified ? employer_domain || null : null,
      employer_brand_verified,
      venue_brand: venue_brand || null,
      venue_name: venue_name || null,
      venue_store_id: venue_store_id || null,
      venue_note: venue_note || null,
      status,
      posted_by: recruiter_id,
      updated_at: nowIso,
    };

    const insert = buildInsert("public.jobs", payload);
    const data = await one(insert.text, insert.params);

    res.status(201).json({
      job: data,
      requiresVerification: status === "pending_domain",
      message:
        status === "pending_domain"
          ? "Brand postings require domain verification. We saved this as Pending Domain."
          : undefined,
    });
  } catch (e) {
    console.error("Create job error:", e);
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.patch("/:id", requireAuth, requireJobManager, async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await one("select * from public.jobs where id = $1", [jobId]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const blockedLifecycleFields = [
      "status",
      "is_archived",
      "archived_at",
      "last_activated_at",
      "first_activated_at",
      "total_active_seconds",
    ].filter((field) => field in req.body);

    if (blockedLifecycleFields.length) {
      return res.status(400).json({
        error: "Use archive/unarchive endpoints for job lifecycle changes.",
        fields: blockedLifecycleFields,
      });
    }

    const allowed = [
      "title",
      "description",
      "location",
      "city",
      "state",
      "latitude",
      "longitude",
      "role",
      "hours",
      "type",
      "opportunity_type",
      "practice_type",
      "employment_type",
      "salary",
      "tag_ids",
      "employer_name",
      "employer_brand",
      "employer_domain",
      "venue_brand",
      "venue_name",
      "venue_store_id",
      "venue_note",
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ("tag_ids" in updates) updates.tag_ids = toTagIds(updates.tag_ids);
    if ("latitude" in updates) updates.latitude = toNullableNumber(updates.latitude);
    if ("longitude" in updates) updates.longitude = toNullableNumber(updates.longitude);
    if ("opportunity_type" in updates) updates.opportunity_type = toNullableText(updates.opportunity_type);
    if ("practice_type" in updates) updates.practice_type = toNullableText(updates.practice_type);
    if ("employment_type" in updates) updates.employment_type = toNullableText(updates.employment_type);
    if ("employment_type" in updates && !("type" in updates)) updates.type = updates.employment_type;

    let employer_name =
      ("employer_name" in updates ? updates.employer_name : job.employer_name) ??
      job.company ??
      null;
    let employer_brand = normalizeBrand(
      "employer_brand" in updates ? updates.employer_brand : job.employer_brand
    );
    let employer_domain = normalizeDomain(
      "employer_domain" in updates ? updates.employer_domain : job.employer_domain || ""
    );
    let venue_brand = normalizeBrand(
      "venue_brand" in updates ? updates.venue_brand : job.venue_brand
    );
    let venue_name = ("venue_name" in updates ? updates.venue_name : job.venue_name) ?? null;
    let status = job.status || "active";
    let employer_brand_verified = job.employer_brand_verified || false;

    if ("employer_name" in updates || "employer_brand" in updates || "employer_domain" in updates) {
      employer_brand_verified = false;

      if (employer_brand && brandByKey(employer_brand)) {
        const ownerRecruiterId = job.recruiter_id || job.posted_by || req.user.id;
        employer_brand_verified = await isBrandVerifiedForRecruiter(
          ownerRecruiterId,
          employer_brand,
          employer_domain
        );
        status = job.is_archived
          ? "archived"
          : employer_brand_verified
          ? "active"
          : "pending_domain";
      } else {
        status = job.is_archived ? "archived" : "active";
      }

      if (!employer_brand_verified && employer_name) {
        const downgraded = stripUnverifiedBrandFromName(
          employer_name,
          venue_brand,
          venue_name
        );
        employer_name = downgraded.employerName;
        venue_brand = downgraded.venueBrand;
        venue_name = downgraded.venueName;
        if (downgraded.employerBrand === null) {
          employer_brand = null;
          employer_domain = null;
        }
      }

      updates.employer_name = employer_name;
      updates.company = employer_name;
      updates.employer_brand = employer_brand;
      updates.employer_brand_verified = employer_brand_verified;
      updates.status = status;
      updates.employer_domain = employer_brand_verified ? employer_domain || null : null;
      updates.venue_brand = venue_brand || null;
      updates.venue_name = venue_name || null;
    }

    updates.updated_at = new Date().toISOString();

    const valueCount = Object.values(updates).filter((value) => value !== undefined).length;
    const update = buildUpdate("public.jobs", updates, `id = $${valueCount + 1}`, [jobId]);
    const data = await one(update.text, update.params);

    res.json(data);
  } catch (e) {
    console.error("Update job error:", e);
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.post("/:id/unarchive", requireAuth, requireJobManager, async (req, res) => {
  try {
    const jobId = req.params.id;
    const now = new Date().toISOString();
    const job = await one("select * from public.jobs where id = $1", [jobId]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const nextStatus =
      job.employer_brand && !job.employer_brand_verified ? "pending_domain" : "active";

    if (!job.is_archived && job.status === nextStatus) return res.json(job);
    if (await enforceRecruiterCanPost(req, res, jobId)) return;

    const update = buildUpdate(
      "public.jobs",
      {
        status: nextStatus,
        is_archived: false,
        archived_at: null,
        last_activated_at: now,
        first_activated_at: job.first_activated_at ?? now,
        updated_at: now,
      },
      "id = $7",
      [jobId]
    );
    const data = await one(update.text, update.params);

    res.json(data);
  } catch (e) {
    console.error("Unarchive job error:", e);
    res.status(500).json({ error: "Failed to unarchive job" });
  }
});

router.post("/:id/archive", requireAuth, requireJobManager, async (req, res) => {
  try {
    const jobId = req.params.id;
    const now = new Date();
    const job = await one("select * from public.jobs where id = $1", [jobId]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const addSeconds =
      job.last_activated_at && !job.is_archived
        ? Math.max(0, Math.floor((now - new Date(job.last_activated_at)) / 1000))
        : 0;

    const update = buildUpdate(
      "public.jobs",
      {
        status: "archived",
        is_archived: true,
        archived_at: now.toISOString(),
        total_active_seconds: (job.total_active_seconds ?? 0) + addSeconds,
        updated_at: now.toISOString(),
      },
      "id = $6",
      [jobId]
    );
    const data = await one(update.text, update.params);

    res.json(data);
  } catch (e) {
    console.error("Archive job error:", e);
    res.status(500).json({ error: "Failed to archive job" });
  }
});

module.exports = router;
