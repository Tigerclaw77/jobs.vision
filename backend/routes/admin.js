// backend/routes/admin.js
const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { buildInsert, one, query } = require("../services/db");
const {
  classifyJobForReview,
  discoverJobsForSource,
  createDuplicateKey,
} = require("../../src/lib/job-discovery");
const eyecareDiscoveryConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const {
  backfillJobImportClassifications,
  getJobImport,
  jobImportClassificationBackfillStatus,
  listJobImports,
  markJobImportPublished,
  saveDiscoveryRun,
  updateJobImport,
} = require("../services/jobImportRepository");
const {
  createDiscoverySource,
  deleteDiscoverySource,
  getDiscoverySource,
  listDiscoverySources,
  recordDiscoverySourceRun,
  toSourceInput,
  updateDiscoverySource,
} = require("../services/jobDiscoverySourceRepository");
const {
  normalizeCityStateLocation,
  normalizeImportedLocationFields,
  providedCoordinatePair,
  resolveImportedJobCoordinates,
} = require("../services/jobLocationService");
const { inferEmployerAttribution } = require("../services/employerAttribution");
const { sendEmail } = require("../services/email");

const APP_URL = (process.env.APP_URL || process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");

const router = express.Router();
const SOURCE_TYPES = new Set([
  "career_page",
  "smartrecruiters",
  "greenhouse",
  "lever",
  "workday",
  "icims",
  "taleo",
  "unknown",
]);
const PUBLISHABLE_IMPORT_STATUSES = new Set(["discovered", "needs_review"]);
const PUBLIC_REJECTED_IMPORT_ROLE_BADGES = new Set(["OTHER"]);
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
const LISTING_OPPORTUNITY_TYPES = new Set(["job", "practice_sale", "partnership", "lease"]);
const LISTING_SOURCES = new Set(["imported", "employer_submitted"]);
const LISTING_TIERS = new Set(["imported", "standard_paid", "featured", "sponsor"]);
const LOCATION_PRECISIONS = new Set([
  "exact",
  "facility",
  "city",
  "metro",
  "state",
  "remote",
  "multiple",
  "unknown",
]);
const CONTACT_STATUSES = new Set([
  "not_contacted",
  "contacted",
  "responded",
  "claimed",
  "declined",
]);
const ROLE_TAG_TO_JOB_ROLE = {
  optometrist: "optometrist",
  optician: "optician",
  ophthalmic_technician: "ophthalmic_technician",
  practice_manager: "practice_manager",
  front_desk: "front_desk",
  optical_sales: "optician",
  contact_lens_technician: "ophthalmic_technician",
  ophthalmology_adjacent: "other",
};
const ROLE_BADGE_TO_JOB_ROLE = {
  OD: "optometrist",
  OPTICIAN: "optician",
  OPTICAL: "optician",
  TECH: "ophthalmic_technician",
  MANAGER: "practice_manager",
  FRONT_DESK: "front_desk",
};

function toTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function toNullableText(value) {
  const text = toTrimmedString(value);
  return text || null;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function notifyClaimDecision({ claim, job, status }) {
  const claimant = await one("select email, first_name, last_name from public.profiles where id = $1", [
    claim.requested_by_user_id,
  ]);
  const to = claimant?.email || claim.requester_email;
  if (!to) return { sent: false, skipped: true, reason: "missing-recipient" };

  const claimantName =
    [claimant?.first_name, claimant?.last_name].filter(Boolean).join(" ").trim() ||
    claim.requester_name ||
    "there";
  const approved = status === "approved";
  const actionUrl = approved
    ? `${APP_URL}/recruiter/dashboard`
    : `${APP_URL}/claim-listing/${claim.job_id}`;
  const nextAction = approved
    ? "You can now manage this listing from your recruiter dashboard."
    : "Review the decision and submit another claim if you have updated verification details.";
  const title = job?.title || "your claimed listing";
  const subject = `Listing claim ${approved ? "approved" : "rejected"}: ${title}`;
  const safeClaimantName = escapeHtml(claimantName);
  const safeStatus = escapeHtml(status);
  const safeTitle = escapeHtml(title);
  const safeNextAction = escapeHtml(nextAction);
  const text = [
    `Hi ${claimantName},`,
    "",
    `Your jobs.vision listing claim has been ${status}.`,
    `Listing: ${title}`,
    `Status: ${status}`,
    "",
    nextAction,
    actionUrl,
  ].join("\n");

  return sendEmail({
    to,
    subject,
    text,
    html: `
      <p>Hi ${safeClaimantName},</p>
      <p>Your jobs.vision listing claim has been <strong>${safeStatus}</strong>.</p>
      <ul>
        <li><strong>Listing:</strong> ${safeTitle}</li>
        <li><strong>Status:</strong> ${safeStatus}</li>
      </ul>
      <p>${safeNextAction}</p>
      <p><a href="${actionUrl}">${approved ? "Open recruiter dashboard" : "Review listing claim"}</a></p>
    `,
  });
}

function normalizeEnum(value, allowed, fallback) {
  const text = toTrimmedString(value).toLowerCase();
  return text && allowed.has(text) ? text : fallback;
}

function normalizeListingOpportunityType(value, fallback = "job") {
  return normalizeEnum(value, LISTING_OPPORTUNITY_TYPES, fallback);
}

function normalizeListingSource(value, fallback = "imported") {
  return normalizeEnum(value, LISTING_SOURCES, fallback);
}

function normalizeListingTier(value, fallback = "imported") {
  return normalizeEnum(value, LISTING_TIERS, fallback);
}

function normalizeLocationPrecision(value, fallback = "unknown") {
  return normalizeEnum(value, LOCATION_PRECISIONS, fallback);
}

function blockedImportPublishReason(row = {}, normalizedJob = {}) {
  const status = toTrimmedString(row.status).toLowerCase();
  const recommendation = toTrimmedString(
    normalizedJob.recommendation || row.recommendation
  ).toLowerCase();
  const roleBadge = toTrimmedString(normalizedJob.roleBadge || row.role_badge).toUpperCase();

  if (status === "rejected") {
    return "Rejected imports cannot be published.";
  }
  if (row.evergreen === true || normalizedJob.evergreen === true || status === "evergreen") {
    return "Evergreen imports are reserved for future openings/talent-pool handling and cannot be published as active jobs.";
  }
  if (recommendation === "reject") {
    return "Imports recommended for rejection cannot be published.";
  }
  if (PUBLIC_REJECTED_IMPORT_ROLE_BADGES.has(roleBadge)) {
    return "Imports classified as OTHER cannot be published.";
  }

  return null;
}

function normalizeContactStatus(value, fallback = "not_contacted") {
  return normalizeEnum(value, CONTACT_STATUSES, fallback);
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
    contactEmail: toTrimmedString(input.contactEmail || input.contact_email) || null,
    contactStatus: normalizeContactStatus(input.contactStatus || input.contact_status),
    enabled: input.enabled !== false,
    notes: toTrimmedString(input.notes) || null,
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
  if (source.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source.contactEmail)) {
    const error = new Error("Contact email must be a valid email address.");
    error.statusCode = 400;
    throw error;
  }

  return source;
}

function discoveryConfigFor(source) {
  return source.industryKey === "eyecare" ? eyecareDiscoveryConfig : null;
}

function discoveryRunOptionsFor(source) {
  return {
    industryConfig: discoveryConfigFor(source),
    maxDepth: 1,
    maxFollowLinks: 1,
    maxAtsJobs: Number(process.env.JOB_DISCOVERY_MAX_ATS_JOBS || 1200),
    maxIcimsPages: Number(process.env.JOB_DISCOVERY_MAX_ICIMS_PAGES || 10),
    atsPageDelayMs: Number(process.env.JOB_DISCOVERY_ATS_PAGE_DELAY_MS || 150),
    delayMs: 500,
    logger: console,
  };
}

async function runDiscoveryForSource(source, { discoveredBy = null } = {}) {
  const run = await discoverJobsForSource(source, discoveryRunOptionsFor(source));
  const saved = await saveDiscoveryRun(run, { discoveredBy });

  return {
    source: run.source,
    discoveredAt: run.discoveredAt,
    notes: run.notes,
    error: run.error || null,
    discoveredCount: run.jobs.length,
    savedCount: saved.length,
    rejectedClassifications: run.rejectedClassifications || {},
    items: saved,
  };
}

function adminUserId(req) {
  return req.profile?.id || req.user?.id || null;
}

function normalizedJobFromRow(row = {}) {
  const parsed =
    row.normalized_job && typeof row.normalized_job === "object"
      ? row.normalized_job
      : {};
  const parsedClassification = parsed.classificationSummary || {};
  const title = parsed.title || row.normalized_title || row.raw_title || "";
  const company = parsed.company || row.normalized_company || row.employer_name || "";
  const location = parsed.location || row.normalized_location || row.raw_location || null;
  const employmentType = parsed.employmentType || row.normalized_employment_type || null;
  const compensation = parsed.compensation || row.normalized_compensation || null;
  const description = parsed.description || row.normalized_description || row.raw_description || null;
  const roleTags = Array.isArray(parsed.roleTags) ? parsed.roleTags : row.role_tags || [];
  const refreshedClassification = classifyJobForReview({
    title,
    location,
    description,
    employmentType,
    compensation,
    roleTags,
  });

  return {
    title,
    company,
    parentCompany: parsed.parentCompany || row.parent_company || null,
    employerBrand: parsed.employerBrand || row.employer_brand || null,
    practiceName: parsed.practiceName || row.practice_name || null,
    location,
    employmentType,
    compensation,
    description,
    applyUrl: parsed.applyUrl || row.normalized_apply_url || row.apply_url || null,
    sourceUrl: parsed.sourceUrl || row.normalized_source_url || row.source_url,
    sourceType: parsed.sourceType || row.normalized_source_type || row.source_type,
    industryTags: Array.isArray(parsed.industryTags)
      ? parsed.industryTags
      : row.industry_tags || [],
    roleTags,
    evergreen: parsed.evergreen ?? row.evergreen ?? false,
    evergreenReason: parsed.evergreenReason || row.evergreen_reason || null,
    sourcePostedAt: parsed.sourcePostedAt || row.source_posted_at || null,
    sourceUpdatedAt: parsed.sourceUpdatedAt || row.source_updated_at || null,
    sourcePostingAgeDays: parsed.sourcePostingAgeDays ?? row.source_posting_age_days ?? null,
    freshnessCheckedAt: parsed.freshnessCheckedAt || row.freshness_checked_at || null,
    classificationSummary: {
      primaryRole: refreshedClassification.primaryRole || row.primary_role || parsedClassification.primaryRole || parsed.primaryRole || null,
      secondaryRole: refreshedClassification.secondaryRole || row.secondary_role || parsedClassification.secondaryRole || parsed.secondaryRole || null,
      specialty: refreshedClassification.specialty || row.specialty || parsedClassification.specialty || parsed.specialty || null,
      employmentType:
        refreshedClassification.employmentType ||
        row.classification_employment_type ||
        parsedClassification.employmentType ||
        parsed.employmentType ||
        null,
      practiceType:
        refreshedClassification.practiceType ||
        row.classification_practice_type ||
        parsedClassification.practiceType ||
        parsed.practiceType ||
        null,
      compensationSummary:
        refreshedClassification.compensationSummary ||
        row.compensation_summary ||
        parsedClassification.compensationSummary ||
        parsed.compensationSummary ||
        parsed.compensation ||
        null,
      jobsVisionRelevant: refreshedClassification.jobsVisionRelevant,
      recommendation:
        refreshedClassification.recommendation ||
        row.recommendation ||
        parsedClassification.recommendation ||
        parsed.recommendation ||
        null,
      recommendationReason:
        refreshedClassification.recommendationReason ||
        row.recommendation_reason ||
        parsedClassification.recommendationReason ||
        parsed.recommendationReason ||
        null,
      confidenceScore:
        refreshedClassification.confidenceScore ??
        row.classification_confidence_score ??
        parsedClassification.confidenceScore ??
        parsed.classificationConfidenceScore ??
        null,
      roleBadge: refreshedClassification.roleBadge || row.role_badge || parsedClassification.roleBadge || parsed.roleBadge || "UNKNOWN",
    },
    primaryRole: refreshedClassification.primaryRole || row.primary_role || parsed.primaryRole || parsedClassification.primaryRole || null,
    secondaryRole: refreshedClassification.secondaryRole || row.secondary_role || parsed.secondaryRole || parsedClassification.secondaryRole || null,
    specialty: refreshedClassification.specialty || row.specialty || parsed.specialty || parsedClassification.specialty || null,
    practiceType:
      refreshedClassification.practiceType || row.classification_practice_type || parsed.practiceType || parsedClassification.practiceType || null,
    compensationSummary:
      refreshedClassification.compensationSummary ||
      row.compensation_summary ||
      parsed.compensationSummary ||
      parsedClassification.compensationSummary ||
      parsed.compensation ||
      null,
    jobsVisionRelevant: refreshedClassification.jobsVisionRelevant,
    recommendation: refreshedClassification.recommendation || row.recommendation || parsed.recommendation || parsedClassification.recommendation || null,
    recommendationReason:
      refreshedClassification.recommendationReason ||
      row.recommendation_reason ||
      parsed.recommendationReason ||
      parsedClassification.recommendationReason ||
      null,
    classificationConfidenceScore:
      refreshedClassification.confidenceScore ??
      row.classification_confidence_score ??
      parsed.classificationConfidenceScore ??
      parsedClassification.confidenceScore ??
      null,
    roleBadge: refreshedClassification.roleBadge || row.role_badge || parsed.roleBadge || parsedClassification.roleBadge || "UNKNOWN",
    status: parsed.status || row.status || "needs_review",
    duplicateKey: parsed.duplicateKey || row.duplicate_key,
    listingSource: normalizeListingSource(parsed.listingSource || row.listing_source, "imported"),
    listingTier: normalizeListingTier(parsed.listingTier || row.listing_tier, "imported"),
    listingOpportunityType: normalizeListingOpportunityType(
      parsed.listingOpportunityType || row.listing_opportunity_type,
      "job"
    ),
    locationPrecision: normalizeLocationPrecision(
      parsed.locationPrecision || row.location_precision,
      row.normalized_location || row.raw_location ? "city" : "unknown"
    ),
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
    "parentCompany",
    "employerBrand",
    "practiceName",
    "listingSource",
    "listingTier",
    "listingOpportunityType",
    "locationPrecision",
    "primaryRole",
    "secondaryRole",
    "specialty",
    "practiceType",
    "compensationSummary",
    "jobsVisionRelevant",
    "recommendation",
    "recommendationReason",
    "classificationConfidenceScore",
    "roleBadge",
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
  next.parentCompany = toTrimmedString(next.parentCompany) || base.parentCompany || null;
  next.employerBrand = toTrimmedString(next.employerBrand) || base.employerBrand || null;
  next.practiceName = toTrimmedString(next.practiceName) || base.practiceName || null;
  next.employmentType = normalizeEmploymentType(next.employmentType);
  next.listingSource = normalizeListingSource(next.listingSource, base.listingSource || "imported");
  next.listingTier = normalizeListingTier(next.listingTier, base.listingTier || "imported");
  next.listingOpportunityType = normalizeListingOpportunityType(
    next.listingOpportunityType,
    base.listingOpportunityType || "job"
  );
  next.locationPrecision = normalizeLocationPrecision(
    next.locationPrecision,
    base.locationPrecision || (next.location ? "city" : "unknown")
  );
  next.compensation = toTrimmedString(next.compensation) || null;
  next.primaryRole = toTrimmedString(next.primaryRole) || null;
  next.secondaryRole = toTrimmedString(next.secondaryRole) || null;
  next.specialty = toTrimmedString(next.specialty) || null;
  next.practiceType = toTrimmedString(next.practiceType) || null;
  next.compensationSummary = toTrimmedString(next.compensationSummary) || next.compensation || null;
  next.jobsVisionRelevant =
    typeof next.jobsVisionRelevant === "boolean" ? next.jobsVisionRelevant : null;
  next.recommendation = toTrimmedString(next.recommendation).toLowerCase() || null;
  next.recommendationReason = toTrimmedString(next.recommendationReason) || null;
  next.classificationConfidenceScore = Number.isFinite(Number(next.classificationConfidenceScore))
    ? Number(next.classificationConfidenceScore)
    : null;
  next.roleBadge = toTrimmedString(next.roleBadge).toUpperCase() || "UNKNOWN";
  next.classificationSummary = {
    ...(next.classificationSummary || {}),
    primaryRole: next.primaryRole,
    secondaryRole: next.secondaryRole,
    specialty: next.specialty,
    employmentType: next.classificationSummary?.employmentType || null,
    practiceType: next.practiceType,
    compensationSummary: next.compensationSummary,
    jobsVisionRelevant: next.jobsVisionRelevant,
    recommendation: next.recommendation,
    recommendationReason: next.recommendationReason,
    confidenceScore: next.classificationConfidenceScore,
    roleBadge: next.roleBadge,
  };
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

  const badgeRole = ROLE_BADGE_TO_JOB_ROLE[toTrimmedString(normalizedJob.roleBadge).toUpperCase()];
  if (badgeRole) return badgeRole;

  for (const tag of normalizedJob.roleTags || []) {
    const role = ROLE_TAG_TO_JOB_ROLE[tag];
    if (role) return role;
  }

  return "other";
}

function tagIdsFromImport(normalizedJob) {
  return Array.from(
    new Set([...(normalizedJob.industryTags || []), ...(normalizedJob.roleTags || [])])
  ).filter(Boolean);
}

function coordinateInputFromImport(normalizedJob = {}, override = {}, locationParts = {}) {
  const fields = {
    location: locationParts.location,
    city: locationParts.city,
    state: locationParts.state,
  };
  const lat = override.latitude ?? override.lat ?? normalizedJob.latitude ?? normalizedJob.lat;
  const lng = override.longitude ?? override.lng ?? normalizedJob.longitude ?? normalizedJob.lng;

  if (lat !== undefined) fields.latitude = lat;
  if (lng !== undefined) fields.longitude = lng;

  return fields;
}

async function buildJobPayloadFromImport(row, normalizedJob, override = {}, req) {
  const now = new Date().toISOString();
  const role = roleFromImport(normalizedJob, override.role);
  const employmentType = normalizeEmploymentType(
    override.employment_type || override.employmentType || normalizedJob.employmentType
  );
  const locationParts = normalizeImportedLocationFields({
    location: override.location ?? normalizedJob.location,
    city: override.city ?? normalizedJob.city,
    state: override.state ?? normalizedJob.state,
  });
  const location = locationParts.location;
  const city = locationParts.city;
  const state = locationParts.state;
  const company = toTrimmedString(override.company || normalizedJob.company || row.employer_name);
  const attribution = inferEmployerAttribution({
    parentCompany: normalizedJob.parentCompany || row.parent_company,
    employerName: row.employer_name,
    employerBrand: normalizedJob.employerBrand || row.employer_brand,
    practiceName: normalizedJob.practiceName || row.practice_name,
    company,
    title: normalizedJob.title,
    description: normalizedJob.description,
    sourceUrl: normalizedJob.sourceUrl,
    applyUrl: normalizedJob.applyUrl,
  });
  const listingTier = normalizeListingTier(
    override.listing_tier || override.listingTier || normalizedJob.listingTier || row.listing_tier,
    "imported"
  );
  const listingOpportunityType = normalizeListingOpportunityType(
    override.listing_opportunity_type ||
      override.listingOpportunityType ||
      override.marketplace_opportunity_type ||
      normalizedJob.listingOpportunityType ||
      row.listing_opportunity_type,
    "job"
  );
  const locationPrecision = normalizeLocationPrecision(
    override.location_precision || override.locationPrecision || normalizedJob.locationPrecision || row.location_precision,
    location ? "city" : "unknown"
  );

  if (!normalizedJob.title || !company) {
    const error = new Error("Imported jobs require a title and company before publishing.");
    error.statusCode = 400;
    throw error;
  }

  const coordinateFields = coordinateInputFromImport(normalizedJob, override, locationParts);
  const hasProvidedCoordinates =
    Object.prototype.hasOwnProperty.call(coordinateFields, "latitude") ||
    Object.prototype.hasOwnProperty.call(coordinateFields, "longitude");
  const coordinates = await resolveImportedJobCoordinates(coordinateFields, { required: true });
  const resolvedLocationPrecision =
    hasProvidedCoordinates && providedCoordinatePair(coordinateFields) ? locationPrecision : "city";

  return {
    title: normalizedJob.title,
    description: normalizedJob.description,
    company: attribution.parentCompany || company,
    employer_name: attribution.parentCompany || company,
    parent_company: attribution.parentCompany || company,
    employer_brand: attribution.employerBrand,
    practice_name: attribution.practiceName,
    location,
    city,
    state,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
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
    listing_source: "imported",
    listing_tier: listingTier,
    listing_opportunity_type: listingOpportunityType,
    location_precision: resolvedLocationPrecision,
    featured: listingTier === "featured" || listingTier === "sponsor",
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

async function publishJobImport(row, override = {}, req, options = {}) {
  if (!row) {
    const error = new Error("Job import not found");
    error.statusCode = 404;
    throw error;
  }

  if (row.status === "published") {
    const error = new Error("This import has already been published.");
    error.statusCode = 409;
    throw error;
  }

  if (!PUBLISHABLE_IMPORT_STATUSES.has(row.status)) {
    const error = new Error("This import cannot be published from its current state.");
    error.statusCode = 400;
    throw error;
  }

  const normalizedJob = mergeNormalizedJob(row, override || {});
  const blockedReason = blockedImportPublishReason(row, normalizedJob);
  if (blockedReason) {
    const error = new Error(blockedReason);
    error.statusCode = 400;
    throw error;
  }

  const importRow = await updateJobImport(row.id, { normalizedJob });
  const jobPayload = await buildJobPayloadFromImport(importRow, normalizedJob, override || {}, req);
  const insert = buildInsert("public.jobs", jobPayload);
  const job = await one(insert.text, insert.params);
  const updatedImport = await markJobImportPublished(row.id, job.id, adminUserId(req), {
    reviewAction: "publish",
    reviewSource: options.reviewSource || "manual",
  });

  return {
    job,
    import: updatedImport,
  };
}

async function jobImportReviewSummary() {
  const summary = await one(`
    select
      count(*)::int as total_imports,
      count(*) filter (where status in ('discovered', 'needs_review'))::int as review_queue,
      count(*) filter (
        where status in ('discovered', 'needs_review')
          and coalesce(evergreen, false) = false
          and recommendation = 'approve'
      )::int as recommended_approve,
      count(*) filter (
        where status in ('discovered', 'needs_review')
          and coalesce(evergreen, false) = false
          and recommendation = 'reject'
      )::int as recommended_reject,
      count(*) filter (
        where status in ('discovered', 'needs_review')
          and coalesce(evergreen, false) = false
          and coalesce(recommendation, 'review') = 'review'
      )::int as human_review_required,
      count(*) filter (where coalesce(evergreen, false) = true or status = 'evergreen')::int as evergreen_jobs,
      count(*) filter (
        where coalesce(evergreen, false) = false
          and auto_decision_applied = true
          and auto_decision = 'approve'
      )::int as auto_approved,
      count(*) filter (
        where coalesce(evergreen, false) = false
          and auto_decision_applied = true
          and auto_decision = 'reject'
      )::int as auto_rejected,
      count(*) filter (where status = 'published')::int as published_live,
      0::int as removed
    from public.job_imports
  `);

  return {
    totalImports: Number(summary?.total_imports || 0),
    reviewQueue: Number(summary?.review_queue || 0),
    pendingReview: Number(summary?.review_queue || 0),
    recommendedApprove: Number(summary?.recommended_approve || 0),
    recommendedReject: Number(summary?.recommended_reject || 0),
    humanReviewRequired: Number(summary?.human_review_required || 0),
    needsReview: Number(summary?.human_review_required || 0),
    evergreenJobs: Number(summary?.evergreen_jobs || 0),
    autoApproved: Number(summary?.auto_approved || 0),
    autoRejected: Number(summary?.auto_rejected || 0),
    publishedLive: Number(summary?.published_live || 0),
    removed: Number(summary?.removed || 0),
  };
}

async function highConfidenceApproveRows() {
  const result = await query(`
    select *
    from public.job_imports
    where status in ('discovered', 'needs_review')
      and coalesce(evergreen, false) = false
      and recommendation = 'approve'
      and classification_confidence_score >= 95
      and coalesce(role_badge, '') not in ('UNKNOWN', 'OTHER', 'OMD')
      and coalesce(normalized_apply_url, apply_url, normalized_job->>'applyUrl', '') <> ''
    order by classification_confidence_score desc, discovered_at desc
    limit 500
  `);
  return result.rows || [];
}

async function highConfidenceRejectRows() {
  const result = await query(`
    select *
    from public.job_imports
    where status in ('discovered', 'needs_review')
      and coalesce(evergreen, false) = false
      and recommendation = 'reject'
      and classification_confidence_score >= 95
      and coalesce(role_badge, '') not in ('UNKNOWN')
    order by classification_confidence_score desc, discovered_at desc
    limit 500
  `);
  return result.rows || [];
}

function logJobImportBatchActionRequest(req, _res, next) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(toTrimmedString).filter(Boolean) : [];
  const action = toTrimmedString(req.body?.action);
  const defaults = req.body?.defaults && typeof req.body.defaults === "object" ? req.body.defaults : {};
  const reason = toTrimmedString(req.body?.reason);
  console.log("admin/job-imports batch-action route hit", {
    action,
    payload: {
      action,
      idCount: ids.length,
      ids: ids.slice(0, 20),
      defaults,
      hasReason: Boolean(reason),
    },
  });
  next();
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

router.get("/marketplace-dashboard", requireAdmin(), async (_req, res) => {
  try {
    const [
      inventory,
      evergreenImports,
      discoveryByAts,
      discoveryByEmployer,
      discoveryByState,
      importedThisWeek,
      claimCounts,
      listingReportCounts,
      pendingListingReports,
      conversion,
      opportunityTypes,
      employerOutreach,
    ] = await Promise.all([
      one(`
        select
          count(*) filter (where status = 'active' and is_archived = false)::int as active_jobs,
          count(*) filter (
            where listing_source = 'imported'
               or source in ('discovery', 'import', 'imported')
          )::int as imported_jobs,
          count(*) filter (where claim_status = 'claimed')::int as claimed_jobs,
          count(*) filter (where claim_status = 'pending')::int as pending_claims,
          count(*) filter (where listing_tier = 'featured' or featured = true)::int as featured_jobs,
          count(*) filter (where listing_tier = 'sponsor')::int as sponsor_jobs
        from public.jobs
      `),
      one(`
        select count(*)::int as count
        from public.job_imports
        where coalesce(evergreen, false) = true
           or status = 'evergreen'
      `),
      query(`
        select coalesce(nullif(normalized_source_type, ''), nullif(source_type, ''), 'unknown') as label,
               count(*)::int as count
        from public.job_imports
        group by label
        order by count desc, label asc
      `),
      query(`
        select coalesce(nullif(employer_name, ''), 'Unknown employer') as label,
               count(*)::int as count
        from public.job_imports
        group by label
        order by count desc, label asc
        limit 25
      `),
      query(`
        with imported_locations as (
          select upper(coalesce(
            nullif(substring(coalesce(normalized_location, raw_location, '') from ',[[:space:]]*([A-Za-z]{2})([[:space:]]|,|$)'), ''),
            'Unknown'
          )) as label
          from public.job_imports
        )
        select label, count(*)::int as count
        from imported_locations
        group by label
        order by count desc, label asc
      `),
      one(`
        select count(*)::int as count
        from public.job_imports
        where created_at >= date_trunc('week', now())
      `),
      query(`
        select status as label, count(*)::int as count
        from public.job_listing_claims
        group by status
        order by status asc
      `),
      query(`
        select status as label, count(*)::int as count
        from public.job_listing_reports
        group by status
        order by status asc
      `),
      query(`
        select
          r.id,
          r.job_id,
          r.reason,
          r.comment,
          r.status,
          r.created_at,
          r.reported_by_user_id,
          j.title,
          coalesce(j.employer_brand, j.practice_name, j.company, j.employer_name) as display_company,
          j.location
        from public.job_listing_reports r
        join public.jobs j on j.id = r.job_id
        where r.status = 'pending'
        order by r.created_at desc
        limit 10
      `),
      one(`
        select
          count(*) filter (
            where listing_source = 'imported'
               or source in ('discovery', 'import', 'imported')
          )::int as imported_total,
          count(*) filter (
            where (listing_source = 'imported'
                   or source in ('discovery', 'import', 'imported'))
              and claim_status = 'claimed'
          )::int as imported_claimed,
          case
            when count(*) filter (
              where listing_source = 'imported'
                 or source in ('discovery', 'import', 'imported')
            ) = 0 then 0
            else round(
              (
                count(*) filter (
                  where (listing_source = 'imported'
                         or source in ('discovery', 'import', 'imported'))
                    and claim_status = 'claimed'
                )::numeric
                /
                count(*) filter (
                  where listing_source = 'imported'
                     or source in ('discovery', 'import', 'imported')
                )::numeric
              ) * 100,
              1
            )
          end as conversion_percent
        from public.jobs
      `),
      query(`
        select coalesce(nullif(listing_opportunity_type, ''), 'job') as label,
               count(*)::int as count
        from public.jobs
        group by label
        order by count desc, label asc
      `),
      query(`
        with employer_keys as (
          select lower(trim(employer_name)) as employer_key, employer_name
          from public.job_discovery_sources
          where employer_name is not null and trim(employer_name) <> ''
          union
          select lower(trim(employer_name)) as employer_key, employer_name
          from public.job_imports
          where employer_name is not null and trim(employer_name) <> ''
          union
          select lower(trim(coalesce(employer_name, company))) as employer_key,
                 coalesce(employer_name, company) as employer_name
          from public.jobs
          where coalesce(employer_name, company) is not null
            and trim(coalesce(employer_name, company)) <> ''
        ),
        sources as (
          select distinct on (lower(trim(employer_name)))
            lower(trim(employer_name)) as employer_key,
            employer_name,
            employer_website_url as website,
            careers_url,
            contact_email,
            contact_status
          from public.job_discovery_sources
          order by lower(trim(employer_name)), updated_at desc
        ),
        imports as (
          select lower(trim(employer_name)) as employer_key,
                 count(*)::int as imported_jobs
          from public.job_imports
          group by lower(trim(employer_name))
        ),
        published as (
          select lower(trim(coalesce(employer_name, company))) as employer_key,
                 count(*) filter (
                   where listing_source = 'imported'
                      or source in ('discovery', 'import', 'imported')
                 )::int as published_imported_jobs,
                 count(*) filter (
                   where (listing_source = 'imported'
                          or source in ('discovery', 'import', 'imported'))
                     and claim_status = 'claimed'
                 )::int as claimed_jobs
          from public.jobs
          group by lower(trim(coalesce(employer_name, company)))
        )
        select
          coalesce(s.employer_name, ek.employer_name) as employer_name,
          s.website,
          s.careers_url,
          s.contact_email,
          coalesce(s.contact_status, 'not_contacted') as contact_status,
          coalesce(i.imported_jobs, 0)::int as imported_jobs,
          coalesce(p.published_imported_jobs, 0)::int as published_imported_jobs,
          coalesce(p.claimed_jobs, 0)::int as claimed_jobs,
          case
            when coalesce(p.published_imported_jobs, 0) = 0 then 0
            else round((coalesce(p.claimed_jobs, 0)::numeric / p.published_imported_jobs::numeric) * 100, 1)
          end as claim_rate
        from employer_keys ek
        left join sources s on s.employer_key = ek.employer_key
        left join imports i on i.employer_key = ek.employer_key
        left join published p on p.employer_key = ek.employer_key
        order by imported_jobs desc, published_imported_jobs desc, employer_name asc
        limit 50
      `),
    ]);

    const claimMap = Object.fromEntries(
      (claimCounts.rows || []).map((row) => [row.label, Number(row.count || 0)])
    );
    const listingReportMap = Object.fromEntries(
      (listingReportCounts.rows || []).map((row) => [row.label, Number(row.count || 0)])
    );
    const opportunityMap = Object.fromEntries(
      (opportunityTypes.rows || []).map((row) => [row.label, Number(row.count || 0)])
    );

    res.json({
      inventory: {
        activeJobs: Number(inventory?.active_jobs || 0),
        evergreenJobs: Number(evergreenImports?.count || 0),
        importedJobs: Number(inventory?.imported_jobs || 0),
        claimedJobs: Number(inventory?.claimed_jobs || 0),
        pendingClaims: Number(inventory?.pending_claims || 0),
        pendingListingReports: Number(listingReportMap.pending || 0),
        featuredJobs: Number(inventory?.featured_jobs || 0),
        sponsorJobs: Number(inventory?.sponsor_jobs || 0),
      },
      discovery: {
        byAts: discoveryByAts.rows || [],
        byEmployer: discoveryByEmployer.rows || [],
        byState: discoveryByState.rows || [],
        importedThisWeek: Number(importedThisWeek?.count || 0),
        employerOutreach: employerOutreach.rows || [],
      },
      claiming: {
        pending: Number(claimMap.pending || 0),
        approved: Number(claimMap.approved || 0),
        rejected: Number(claimMap.rejected || 0),
        importedTotal: Number(conversion?.imported_total || 0),
        importedClaimed: Number(conversion?.imported_claimed || 0),
        importedToClaimedConversionPercent: Number(conversion?.conversion_percent || 0),
      },
      listingReports: {
        pending: Number(listingReportMap.pending || 0),
        reviewed: Number(listingReportMap.reviewed || 0),
        dismissed: Number(listingReportMap.dismissed || 0),
        pendingItems: pendingListingReports.rows || [],
      },
      opportunityTypes: {
        jobs: Number(opportunityMap.job || 0),
        practiceSales: Number(opportunityMap.practice_sale || 0),
        partnerships: Number(opportunityMap.partnership || 0),
        leases: Number(opportunityMap.lease || 0),
        rows: opportunityTypes.rows || [],
      },
    });
  } catch (e) {
    console.error("admin/marketplace-dashboard error", e);
    res.status(500).json({ error: "Failed to load marketplace dashboard" });
  }
});

router.get("/listing-reports", requireAdmin(), async (req, res) => {
  try {
    const status = toTrimmedString(req.query.status || "pending").toLowerCase();
    const allowedStatuses = new Set(["pending", "reviewed", "dismissed", "all"]);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: "Choose a valid report status." });
    }

    const params = [];
    const where = [];
    if (status !== "all") {
      params.push(status);
      where.push(`r.status = $${params.length}`);
    }

    params.push(Math.min(100, Math.max(1, Number(req.query.limit) || 50)));
    const limitParam = params.length;
    params.push(Math.max(0, Number(req.query.offset) || 0));
    const offsetParam = params.length;

    const reports = await query(
      `
        select
          r.*,
          j.title,
          coalesce(j.employer_brand, j.practice_name, j.company, j.employer_name) as display_company,
          j.location,
          j.external_apply_url
        from public.job_listing_reports r
        join public.jobs j on j.id = r.job_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by r.created_at desc
        limit $${limitParam}
        offset $${offsetParam}
      `,
      params
    );

    res.json({ items: reports.rows || [] });
  } catch (e) {
    console.error("admin/listing-reports list error", e);
    res.status(500).json({ error: "Failed to list listing reports" });
  }
});

router.get("/job-imports", requireAdmin(), async (req, res) => {
  try {
    const items = await listJobImports({
      status: req.query.status || "needs_review",
      limit: req.query.limit || 50,
      offset: req.query.offset || 0,
      listingTier: req.query.listingTier || req.query.listing_tier || "all",
      listingOpportunityType:
        req.query.listingOpportunityType || req.query.listing_opportunity_type || "all",
    });
    res.json({
      summary: await jobImportReviewSummary(),
      items: items.map((item) => {
        const normalized = normalizedJobFromRow(item);
        return {
          ...item,
          normalized_job: normalized,
          primary_role: normalized.primaryRole,
          secondary_role: normalized.secondaryRole,
          specialty: normalized.specialty,
          classification_practice_type: normalized.practiceType,
          compensation_summary: normalized.compensationSummary,
          jobs_vision_relevant: normalized.jobsVisionRelevant,
          recommendation: normalized.recommendation,
          recommendation_reason: normalized.recommendationReason,
          classification_confidence_score: normalized.classificationConfidenceScore,
          role_badge: normalized.roleBadge,
        };
      }),
    });
  } catch (e) {
    console.error("admin/job-imports list error", e);
    res.status(500).json({ error: "Failed to list job imports" });
  }
});

router.get("/job-imports/summary", requireAdmin(), async (_req, res) => {
  try {
    res.json({ summary: await jobImportReviewSummary() });
  } catch (e) {
    console.error("admin/job-imports summary error", e);
    res.status(500).json({ error: "Failed to summarize job imports" });
  }
});

router.get("/job-imports/classification-backfill", requireAdmin(), async (_req, res) => {
  try {
    res.json({ status: await jobImportClassificationBackfillStatus() });
  } catch (e) {
    console.error("admin/job-imports classification backfill status error", e);
    res.status(500).json({ error: "Failed to load classification backfill status" });
  }
});

router.post("/job-imports/classification-backfill", requireAdmin(), async (req, res) => {
  try {
    const force = req.body?.force === true;
    const limit = Math.min(5000, Math.max(1, Number(req.body?.limit) || 1000));
    console.log("admin/job-imports classification backfill requested", {
      force,
      limit,
      adminUserId: adminUserId(req),
    });
    const result = await backfillJobImportClassifications({ force, limit });
    console.log("admin/job-imports classification backfill complete", {
      totalScanned: result.totalScanned,
      totalClassified: result.totalClassified,
      totalSkipped: result.totalSkipped,
      totalFailures: result.totalFailures,
      rowsRemaining: result.rowsRemaining,
    });
    res.json(result);
  } catch (e) {
    console.error("admin/job-imports classification backfill error", e);
    res.status(500).json({ error: "Classification backfill failed." });
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
      const run = await runDiscoveryForSource(source, { discoveredBy: adminUserId(req) });
      runs.push({
        source: run.source,
        discoveredAt: run.discoveredAt,
        notes: run.notes,
        error: run.error,
        discoveredCount: run.discoveredCount,
        savedCount: run.savedCount,
        rejectedClassifications: run.rejectedClassifications || {},
      });
      savedItems.push(...run.items);
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

router.get("/discovery-sources", requireAdmin(), async (req, res) => {
  try {
    const includeDisabled = req.query.includeDisabled !== "false";
    const items = await listDiscoverySources({ includeDisabled });
    res.json({ items });
  } catch (e) {
    console.error("admin/discovery-sources list error", e);
    res.status(500).json({ error: "Failed to list discovery sources" });
  }
});

router.post("/discovery-sources", requireAdmin(), async (req, res) => {
  try {
    const source = normalizeSourceInput(req.body || {});
    const item = await createDiscoverySource(source, adminUserId(req));
    res.status(201).json(item);
  } catch (e) {
    console.error("admin/discovery-source create error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to create discovery source" });
  }
});

router.post("/discovery-sources/run", requireAdmin(), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : null;
    const sources = await listDiscoverySources({ includeDisabled: true });
    const selected = sources
      .filter((source) => (ids ? ids.includes(String(source.id)) : source.enabled))
      .slice(0, 10);

    const runs = [];
    const savedItems = [];

    for (const row of selected) {
      try {
        const run = await runDiscoveryForSource(toSourceInput(row), {
          discoveredBy: adminUserId(req),
        });
        await recordDiscoverySourceRun(row.id, {
          status: "success",
          message: `${run.savedCount} review item(s) saved.`,
          discoveredCount: run.savedCount,
        });
        runs.push({ sourceId: row.id, ...run, items: undefined });
        savedItems.push(...run.items);
      } catch (error) {
        await recordDiscoverySourceRun(row.id, {
          status: "failed",
          message: error.message,
          discoveredCount: 0,
        });
        runs.push({
          sourceId: row.id,
          source: toSourceInput(row),
          error: error.message,
          discoveredCount: 0,
          savedCount: 0,
          notes: [],
        });
      }
    }

    res.status(201).json({ runs, items: savedItems, count: savedItems.length });
  } catch (e) {
    console.error("admin/discovery-sources run error", e);
    res.status(500).json({ error: "Failed to run discovery sources" });
  }
});

router.patch("/discovery-sources/:id", requireAdmin(), async (req, res) => {
  try {
    const existing = await getDiscoverySource(req.params.id);
    if (!existing) return res.status(404).json({ error: "Discovery source not found" });

    const source = normalizeSourceInput(req.body || {});
    const item = await updateDiscoverySource(existing.id, source, adminUserId(req));
    res.json(item);
  } catch (e) {
    console.error("admin/discovery-source update error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to update discovery source" });
  }
});

router.delete("/discovery-sources/:id", requireAdmin(), async (req, res) => {
  try {
    const deleted = await deleteDiscoverySource(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Discovery source not found" });
    res.json({ ok: true, item: deleted });
  } catch (e) {
    console.error("admin/discovery-source delete error", e);
    res.status(500).json({ error: "Failed to delete discovery source" });
  }
});

router.post("/discovery-sources/:id/run", requireAdmin(), async (req, res) => {
  try {
    const row = await getDiscoverySource(req.params.id);
    if (!row) return res.status(404).json({ error: "Discovery source not found" });

    try {
      const run = await runDiscoveryForSource(toSourceInput(row), {
        discoveredBy: adminUserId(req),
      });
      await recordDiscoverySourceRun(row.id, {
        status: "success",
        message: `${run.savedCount} review item(s) saved.`,
        discoveredCount: run.savedCount,
      });
      res.status(201).json({ ...run, items: run.items, count: run.savedCount });
    } catch (error) {
      await recordDiscoverySourceRun(row.id, {
        status: "failed",
        message: error.message,
        discoveredCount: 0,
      });
      res.status(500).json({ error: error.message || "Discovery failed" });
    }
  } catch (e) {
    console.error("admin/discovery-source run error", e);
    res.status(500).json({ error: "Failed to run discovery source" });
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

router.post("/job-imports/bulk-publish", requireAdmin(), async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const defaults = req.body?.defaults || {};
    const itemInputs = rawItems.length
      ? rawItems
      : rawIds.map((id) => ({ id }));

    if (!itemInputs.length) {
      return res.status(400).json({ error: "Select at least one import to publish." });
    }

    const normalizedDefaults = {
      listingTier: normalizeListingTier(defaults.listingTier || defaults.listing_tier, "imported"),
      locationPrecision: normalizeLocationPrecision(
        defaults.locationPrecision || defaults.location_precision,
        "city"
      ),
    };

    const results = [];
    for (const itemInput of itemInputs) {
      const id = toTrimmedString(itemInput.id);
      if (!id) {
        results.push({
          id: null,
          ok: false,
          error: "Missing import id.",
        });
        continue;
      }

      try {
        const row = await getJobImport(id);
        const override = {
          ...(itemInput.job || itemInput.normalizedJob || itemInput),
          listingTier: normalizedDefaults.listingTier,
          listing_tier: normalizedDefaults.listingTier,
          locationPrecision: normalizedDefaults.locationPrecision,
          location_precision: normalizedDefaults.locationPrecision,
        };
        delete override.id;

        const result = await publishJobImport(row, override, req, { reviewSource: "batch" });
        results.push({
          id,
          ok: true,
          jobId: result.job?.id || null,
          importId: result.import?.id || id,
          title: result.job?.title || null,
        });
      } catch (error) {
        results.push({
          id,
          ok: false,
          error: error?.message || "Failed to publish import.",
          statusCode: error?.statusCode || 500,
        });
      }
    }

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;

    res.status(successCount ? 201 : 400).json({
      previewCount: itemInputs.length,
      publishCount: results.length,
      successCount,
      failureCount,
      results,
    });
  } catch (e) {
    console.error("admin/job-import bulk publish error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to bulk publish job imports" });
  }
});

router.post("/job-imports/batch-action", logJobImportBatchActionRequest, requireAdmin(), async (req, res) => {
  try {
    const action = toTrimmedString(req.body?.action);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(toTrimmedString).filter(Boolean) : [];
    const defaults = req.body?.defaults || {};
    const reason = toTrimmedString(req.body?.reason) || null;
    console.log("admin/job-imports batch-action authorized", {
      action,
      idCount: ids.length,
      hasDefaults: Boolean(defaults && Object.keys(defaults).length),
      hasReason: Boolean(reason),
    });
    let rows = [];

    if (action === "publish_high_confidence_approve") {
      rows = await highConfidenceApproveRows();
    } else if (action === "reject_high_confidence_reject") {
      rows = await highConfidenceRejectRows();
    } else if (action === "reject_selected") {
      for (const id of ids.slice(0, 500)) {
        const row = await getJobImport(id);
        if (row) rows.push(row);
      }
    } else {
      return res.status(400).json({ error: "Unsupported batch action." });
    }

    if (!rows.length) {
      return res.json({
        action,
        count: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      });
    }

    const results = [];
    for (const row of rows) {
      try {
        if (action === "publish_high_confidence_approve") {
          const result = await publishJobImport(row, defaults, req, { reviewSource: "batch" });
          results.push({ id: row.id, ok: true, jobId: result.job?.id || null });
        } else {
          const updated = await updateJobImport(row.id, {
            status: "rejected",
            rejectionReason: reason || "Batch rejected from import review.",
            reviewedBy: adminUserId(req),
            reviewAction: "reject",
            reviewSource: "batch",
          });
          results.push({ id: row.id, ok: true, item: updated });
        }
      } catch (error) {
        results.push({
          id: row.id,
          ok: false,
          error: error?.message || "Batch action failed.",
        });
      }
    }

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;

    res.status(failureCount ? 207 : 200).json({
      action,
      count: rows.length,
      publishCount: action === "publish_high_confidence_approve" ? rows.length : 0,
      rejectCount: action !== "publish_high_confidence_approve" ? rows.length : 0,
      successCount,
      failureCount,
      results,
    });
  } catch (e) {
    console.error("admin/job-import batch action error", e);
    res.status(500).json({ error: "Batch action failed." });
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
      reviewAction: "reject",
      reviewSource: "manual",
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
    const result = await publishJobImport(row, req.body?.job || req.body || {}, req);

    res.status(201).json({
      job: result.job,
      import: result.import,
    });
  } catch (e) {
    console.error("admin/job-import approve error", e);
    res.status(e.statusCode || 500).json({ error: e.message || "Failed to publish job import" });
  }
});

router.get("/listing-claims", requireAdmin(), async (req, res) => {
  try {
    const status = toTrimmedString(req.query.status || "pending").toLowerCase();
    const params = [];
    const where = [];

    if (status && status !== "all") {
      params.push(status);
      where.push(`c.status = $${params.length}`);
    }

    params.push(Math.min(100, Math.max(1, Number(req.query.limit) || 50)));
    const limitParam = params.length;
    params.push(Math.max(0, Number(req.query.offset) || 0));
    const offsetParam = params.length;

    const result = await query(
      `
        select
          c.*,
          j.title as job_title,
          coalesce(j.employer_name, j.company) as job_company,
          j.location as job_location,
          j.listing_source,
          j.listing_tier,
          j.listing_opportunity_type,
          j.claim_status as job_claim_status,
          j.claimed_by_user_id
        from public.job_listing_claims c
        join public.jobs j on j.id = c.job_id
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by c.created_at desc
        limit $${limitParam}
        offset $${offsetParam}
      `,
      params
    );

    res.json({ items: result.rows || [] });
  } catch (e) {
    console.error("admin/listing-claims list error", e);
    res.status(500).json({ error: "Failed to list listing claims" });
  }
});

router.post("/listing-claims/:id/approve", requireAdmin(), async (req, res) => {
  try {
    const claim = await one("select * from public.job_listing_claims where id = $1", [
      req.params.id,
    ]);
    if (!claim) return res.status(404).json({ error: "Listing claim not found" });

    const job = await one("select * from public.jobs where id = $1", [claim.job_id]);
    if (!job) return res.status(404).json({ error: "Claimed listing not found" });
    if (job.claim_status === "claimed" && job.claimed_by_user_id !== claim.requested_by_user_id) {
      return res.status(409).json({ error: "This listing is already claimed by another user." });
    }

    const updatedClaim = await one(
      `
        update public.job_listing_claims
        set status = 'approved',
            reviewed_by = $1,
            reviewed_at = now(),
            review_note = $2,
            updated_at = now()
        where id = $3
        returning *
      `,
      [adminUserId(req), toNullableText(req.body?.note), claim.id]
    );

    const updatedJob = await one(
      `
        update public.jobs
        set claimed_by_user_id = $1,
            claimed_at = now(),
            claim_status = 'claimed',
            recruiter_id = $1,
            posted_by = $1,
            updated_at = now()
        where id = $2
        returning *
      `,
      [claim.requested_by_user_id, claim.job_id]
    );

    let notification = { sent: false, skipped: true, reason: "not-attempted" };
    try {
      notification = await notifyClaimDecision({
        claim: updatedClaim,
        job: updatedJob,
        status: "approved",
      });
    } catch (mailError) {
      console.error("listing claim approval email error", mailError);
      notification = { sent: false, skipped: true, reason: "send-failed" };
    }

    res.json({ ok: true, claim: updatedClaim, job: updatedJob, notification });
  } catch (e) {
    console.error("admin/listing-claim approve error", e);
    res.status(500).json({ error: "Failed to approve listing claim" });
  }
});

router.post("/listing-claims/:id/reject", requireAdmin(), async (req, res) => {
  try {
    const claim = await one("select * from public.job_listing_claims where id = $1", [
      req.params.id,
    ]);
    if (!claim) return res.status(404).json({ error: "Listing claim not found" });

    const updatedClaim = await one(
      `
        update public.job_listing_claims
        set status = 'rejected',
            reviewed_by = $1,
            reviewed_at = now(),
            review_note = $2,
            updated_at = now()
        where id = $3
        returning *
      `,
      [adminUserId(req), toNullableText(req.body?.note), claim.id]
    );

    const pending = await one(
      `
        select count(*)::int as count
        from public.job_listing_claims
        where job_id = $1
          and status = 'pending'
      `,
      [claim.job_id]
    );

    if ((pending?.count || 0) === 0) {
      await query(
        `
          update public.jobs
          set claim_status = case when claimed_by_user_id is null then 'rejected' else 'claimed' end,
              updated_at = now()
          where id = $1
        `,
        [claim.job_id]
      );
    }

    const job = await one("select * from public.jobs where id = $1", [claim.job_id]);
    let notification = { sent: false, skipped: true, reason: "not-attempted" };
    try {
      notification = await notifyClaimDecision({
        claim: updatedClaim,
        job,
        status: "rejected",
      });
    } catch (mailError) {
      console.error("listing claim rejection email error", mailError);
      notification = { sent: false, skipped: true, reason: "send-failed" };
    }

    res.json({ ok: true, claim: updatedClaim, notification });
  } catch (e) {
    console.error("admin/listing-claim reject error", e);
    res.status(500).json({ error: "Failed to reject listing claim" });
  }
});

router.patch("/jobs/:id/ownership", requireAdmin(), async (req, res) => {
  try {
    const userId = toNullableText(req.body?.userId || req.body?.claimed_by_user_id);
    const job = await one("select * from public.jobs where id = $1", [req.params.id]);
    if (!job) return res.status(404).json({ error: "Job not found" });

    const updated = await one(
      `
        update public.jobs
        set claimed_by_user_id = $1,
            claimed_at = case when $1::text is null then null else coalesce(claimed_at, now()) end,
            claim_status = case when $1::text is null then 'unclaimed' else 'claimed' end,
            recruiter_id = $1,
            posted_by = $1,
            updated_at = now()
        where id = $2
        returning *
      `,
      [userId, job.id]
    );

    res.json({ ok: true, job: updated });
  } catch (e) {
    console.error("admin/job ownership transfer error", e);
    res.status(500).json({ error: "Failed to transfer listing ownership" });
  }
});

module.exports = router;
