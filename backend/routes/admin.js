// backend/routes/admin.js
const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { buildInsert, one } = require("../services/db");
const {
  discoverJobsForSource,
  createDuplicateKey,
} = require("../../src/lib/job-discovery");
const eyecareDiscoveryConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const {
  getJobImport,
  listJobImports,
  markJobImportPublished,
  saveDiscoveryRun,
  updateJobImport,
} = require("../services/jobImportRepository");

const router = express.Router();
const SOURCE_TYPES = new Set(["career_page", "greenhouse", "lever", "workday", "unknown"]);
const PUBLISHABLE_IMPORT_STATUSES = new Set(["discovered", "needs_review", "rejected"]);
const JOB_ROLES = new Set([
  "optometrist",
  "optician",
  "ophthalmic_technician",
  "optical_lab",
  "front_desk",
  "practice_manager",
  "other",
]);
const EMPLOYMENT_TYPES = new Set(["full_time", "part_time", "per_diem_fill_in"]);
const ROLE_TAG_TO_JOB_ROLE = {
  optometrist: "optometrist",
  optician: "optician",
  ophthalmic_technician: "ophthalmic_technician",
  practice_manager: "practice_manager",
  optical_sales: "optician",
  contact_lens_technician: "ophthalmic_technician",
  ophthalmology_adjacent: "other",
};

function toTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function isHttpUrl(value, { required = true } = {}) {
  const text = toTrimmedString(value);
  if (!text) return !required;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSourceInput(input = {}) {
  const source = {
    employerName: toTrimmedString(input.employerName),
    employerWebsiteUrl: toTrimmedString(input.employerWebsiteUrl),
    careersUrl: toTrimmedString(input.careersUrl) || null,
    industryKey: toTrimmedString(input.industryKey) || null,
    sourceType: toTrimmedString(input.sourceType) || "unknown",
  };

  if (!source.employerName) {
    const error = new Error("Employer name is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!isHttpUrl(source.employerWebsiteUrl)) {
    const error = new Error("Employer website URL must be a valid http(s) URL.");
    error.statusCode = 400;
    throw error;
  }
  if (source.careersUrl && !isHttpUrl(source.careersUrl, { required: false })) {
    const error = new Error("Careers URL must be a valid http(s) URL.");
    error.statusCode = 400;
    throw error;
  }
  if (!SOURCE_TYPES.has(source.sourceType)) {
    const error = new Error("Source type is not supported.");
    error.statusCode = 400;
    throw error;
  }

  return source;
}

function discoveryConfigFor(source) {
  return source.industryKey === "eyecare" ? eyecareDiscoveryConfig : null;
}

function adminUserId(req) {
  return req.profile?.id || req.user?.id || null;
}

function normalizedJobFromRow(row = {}) {
  const parsed =
    row.normalized_job && typeof row.normalized_job === "object"
      ? row.normalized_job
      : {};

  return {
    title: parsed.title || row.normalized_title || row.raw_title || "",
    company: parsed.company || row.normalized_company || row.employer_name || "",
    location: parsed.location || row.normalized_location || row.raw_location || null,
    employmentType:
      parsed.employmentType || row.normalized_employment_type || null,
    compensation: parsed.compensation || row.normalized_compensation || null,
    description:
      parsed.description || row.normalized_description || row.raw_description || null,
    applyUrl: parsed.applyUrl || row.normalized_apply_url || row.apply_url || null,
    sourceUrl: parsed.sourceUrl || row.normalized_source_url || row.source_url,
    sourceType: parsed.sourceType || row.normalized_source_type || row.source_type,
    industryTags: Array.isArray(parsed.industryTags)
      ? parsed.industryTags
      : row.industry_tags || [],
    roleTags: Array.isArray(parsed.roleTags) ? parsed.roleTags : row.role_tags || [],
    status: parsed.status || row.status || "needs_review",
    duplicateKey: parsed.duplicateKey || row.duplicate_key,
  };
}

function mergeNormalizedJob(row, edits = {}) {
  const incoming = edits.normalizedJob || edits.job || edits;
  const base = normalizedJobFromRow(row);
  const next = { ...base };

  for (const field of [
    "title",
    "company",
    "location",
    "employmentType",
    "compensation",
    "description",
    "applyUrl",
    "sourceUrl",
    "sourceType",
  ]) {
    if (Object.prototype.hasOwnProperty.call(incoming, field)) {
      const value = incoming[field];
      next[field] = value === "" ? null : value;
    }
  }

  for (const field of ["industryTags", "roleTags"]) {
    if (Object.prototype.hasOwnProperty.call(incoming, field)) {
      next[field] = Array.isArray(incoming[field])
        ? incoming[field].map(String).filter(Boolean)
        : [];
    }
  }

  next.title = toTrimmedString(next.title);
  next.company = toTrimmedString(next.company);
  next.location = toTrimmedString(next.location) || null;
  next.description = toTrimmedString(next.description) || null;
  next.applyUrl = toTrimmedString(next.applyUrl) || null;
  next.sourceUrl = toTrimmedString(next.sourceUrl) || base.sourceUrl;
  next.sourceType = toTrimmedString(next.sourceType) || base.sourceType || "unknown";
  next.employmentType = normalizeEmploymentType(next.employmentType);
  next.compensation = toTrimmedString(next.compensation) || null;
  next.status = next.status || "needs_review";
  next.duplicateKey = createDuplicateKey(next);

  return next;
}

function normalizeEmploymentType(value) {
  const text = toTrimmedString(value);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/[-\s]+/g, "_");
  return EMPLOYMENT_TYPES.has(normalized) ? normalized : null;
}

function normalizeJobRole(value) {
  const text = toTrimmedString(value).toLowerCase().replace(/[-\s]+/g, "_");
  if (!text) return null;
  return JOB_ROLES.has(text) ? text : null;
}

function roleFromImport(normalizedJob, overrideRole) {
  const explicit = normalizeJobRole(overrideRole);
  if (explicit) return explicit;

  for (const tag of normalizedJob.roleTags || []) {
    const role = ROLE_TAG_TO_JOB_ROLE[tag];
    if (role) return role;
  }

  return "other";
}

function parseCityState(location) {
  const text = toTrimmedString(location);
  if (!text) return { city: null, state: null };
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { city: text, state: null };

  const state = parts[parts.length - 1].replace(/\bUSA\b|\bUnited States\b/gi, "").trim();
  return {
    city: parts.slice(0, -1).join(", ") || null,
    state: state || null,
  };
}

function tagIdsFromImport(normalizedJob) {
  return Array.from(
    new Set([...(normalizedJob.industryTags || []), ...(normalizedJob.roleTags || [])])
  ).filter(Boolean);
}

function buildJobPayloadFromImport(row, normalizedJob, override = {}, req) {
  const now = new Date().toISOString();
  const role = roleFromImport(normalizedJob, override.role);
  const employmentType = normalizeEmploymentType(
    override.employment_type || override.employmentType || normalizedJob.employmentType
  );
  const location = override.location ?? normalizedJob.location;
  const { city, state } = parseCityState(location);
  const company = toTrimmedString(override.company || normalizedJob.company || row.employer_name);

  if (!normalizedJob.title || !company) {
    const error = new Error("Imported jobs require a title and company before publishing.");
    error.statusCode = 400;
    throw error;
  }

  return {
    title: normalizedJob.title,
    description: normalizedJob.description,
    company,
    employer_name: company,
    location,
    city,
    state,
    latitude: null,
    longitude: null,
    role,
    hours: null,
    type: employmentType,
    opportunity_type: null,
    opportunity_types: [],
    practice_type: null,
    employment_type: employmentType,
    employment_types: employmentType ? [employmentType] : [],
    work_arrangement: null,
    work_arrangements: [],
    salary: normalizedJob.compensation,
    tag_ids: tagIdsFromImport(normalizedJob),
    recruiter_id: null,
    posted_by: adminUserId(req),
    is_archived: false,
    status: "active",
    source: "discovery",
    seed_batch: null,
    external_apply_url: normalizedJob.applyUrl,
    source_url: normalizedJob.sourceUrl,
    posted_at: now,
    updated_at: now,
  };
}

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

router.get("/job-imports", requireAdmin(), async (req, res) => {
  try {
    const items = await listJobImports({
      status: req.query.status || "needs_review",
      limit: req.query.limit || 50,
      offset: req.query.offset || 0,
    });
    res.json({ items });
  } catch (e) {
    console.error("admin/job-imports list error", e);
    res.status(500).json({ error: "Failed to list job imports" });
  }
});

router.post("/job-imports/discover", requireAdmin(), async (req, res) => {
  try {
    const inputSources = Array.isArray(req.body?.sources) ? req.body.sources : [req.body?.source || req.body];
    const sources = inputSources.filter(Boolean).map(normalizeSourceInput);
    if (!sources.length) {
      return res.status(400).json({ error: "At least one source is required." });
    }

    const runs = [];
    const savedItems = [];

    for (const source of sources.slice(0, 10)) {
      const run = await discoverJobsForSource(source, {
        industryConfig: discoveryConfigFor(source),
        maxDepth: 1,
        maxFollowLinks: 1,
        delayMs: 500,
        logger: console,
      });
      const saved = await saveDiscoveryRun(run, { discoveredBy: adminUserId(req) });
      runs.push({
        source: run.source,
        discoveredAt: run.discoveredAt,
        notes: run.notes,
        error: run.error || null,
        discoveredCount: run.jobs.length,
        savedCount: saved.length,
      });
      savedItems.push(...saved);
    }

    res.status(201).json({
      runs,
      items: savedItems,
      count: savedItems.length,
    });
  } catch (e) {
    console.error("admin/job-imports discover error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to run discovery" });
  }
});

router.patch("/job-imports/:id", requireAdmin(), async (req, res) => {
  try {
    const row = await getJobImport(req.params.id);
    if (!row) return res.status(404).json({ error: "Job import not found" });

    const normalizedJob = mergeNormalizedJob(row, req.body || {});
    const updated = await updateJobImport(row.id, { normalizedJob });
    res.json(updated);
  } catch (e) {
    console.error("admin/job-import update error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to update job import" });
  }
});

router.post("/job-imports/:id/reject", requireAdmin(), async (req, res) => {
  try {
    const row = await getJobImport(req.params.id);
    if (!row) return res.status(404).json({ error: "Job import not found" });

    const updated = await updateJobImport(row.id, {
      status: "rejected",
      rejectionReason: req.body?.reason || null,
      reviewedBy: adminUserId(req),
    });
    res.json(updated);
  } catch (e) {
    console.error("admin/job-import reject error", e);
    res.status(500).json({ error: "Failed to reject job import" });
  }
});

router.post("/job-imports/:id/approve", requireAdmin(), async (req, res) => {
  try {
    const row = await getJobImport(req.params.id);
    if (!row) return res.status(404).json({ error: "Job import not found" });
    if (row.status === "published") {
      return res.status(409).json({ error: "This import has already been published." });
    }
    if (!PUBLISHABLE_IMPORT_STATUSES.has(row.status)) {
      return res.status(400).json({ error: "This import cannot be published from its current state." });
    }

    const normalizedJob = mergeNormalizedJob(row, req.body || {});
    const importRow = await updateJobImport(row.id, { normalizedJob });
    const jobPayload = buildJobPayloadFromImport(importRow, normalizedJob, req.body?.job || req.body || {}, req);
    const insert = buildInsert("public.jobs", jobPayload);
    const job = await one(insert.text, insert.params);
    const updatedImport = await markJobImportPublished(row.id, job.id, adminUserId(req));

    res.status(201).json({
      job,
      import: updatedImport,
    });
  } catch (e) {
    console.error("admin/job-import approve error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to publish job import" });
  }
});

module.exports = router;
