// backend/routes/jobs.js
const express = require("express");
const { buildInsert, buildUpdate, one, query } = require("../services/db.js");
const { requireAuth, maybeAuth, requireRole } = require("../middleware/auth.js");
const {
  RECRUITER_POSTING_PLAN_LABELS,
  getRecruiterPostingPaymentState,
  getRequiredRecruiterPlanKey,
} = require("../services/recruiterPostingPayments.js");
const {
  LOCATION_MAP_ERROR,
  normalizeCityStateLocation,
  resolveJobCoordinates,
} = require("../services/jobLocationService.js");

const {
  normalizeDomain,
  detectBrandKeyFromText,
  acceptedDomainsForBrand,
  brandByKey,
} = require("../services/brandRegistry");
const { inferEmployerAttribution } = require("../services/employerAttribution");

const router = express.Router();
const requireJobManager = requireRole(["recruiter", "admin"]);
const requireListingClaimAccount = requireRole([
  "recruiter",
  "employer",
  "practice_owner",
  "hiring_manager",
  "admin",
]);
const CANONICAL_ROLES = new Set([
  "optometrist",
  "optician",
  "ophthalmic_technician",
  "optical_lab",
  "front_desk",
  "practice_manager",
  "optical_manager",
  "other",
]);
const ROLE_ALIASES = new Map([
  ["tech", "ophthalmic_technician"],
  ["technician", "ophthalmic_technician"],
  ["ophthalmic tech", "ophthalmic_technician"],
  ["ophthalmic technician", "ophthalmic_technician"],
  ["ophthalmic_technician", "ophthalmic_technician"],
  ["optical lab", "optical_lab"],
  ["optical_lab", "optical_lab"],
  ["front desk", "front_desk"],
  ["front_desk", "front_desk"],
  ["manager", "practice_manager"],
  ["practice manager", "practice_manager"],
  ["practice_manager", "practice_manager"],
  ["optical manager", "optical_manager"],
  ["optical_manager", "optical_manager"],
  ["vision center manager", "optical_manager"],
  ["optometrist", "optometrist"],
  ["optician", "optician"],
  ["other", "other"],
]);
const ROLE_LABELS = {
  optometrist: "Optometrist",
  optician: "Optician",
  ophthalmic_technician: "Ophthalmic Technician",
  optical_lab: "Optical Lab",
  front_desk: "Front Desk",
  practice_manager: "Practice Manager",
  optical_manager: "Optical Manager",
  other: "Other",
};
const OPPORTUNITY_TYPE_ALIASES = new Map([
  ["associate w2", "associate_w2"],
  ["associate w 2", "associate_w2"],
  ["associate position", "associate_w2"],
  ["associate 1099", "associate_1099"],
  ["corporate employment", "corporate_employment"],
  ["corporate lease", "corporate_lease"],
  ["lease opportunity", "corporate_lease"],
  ["partnership opportunity", "partnership_opportunity"],
  ["ownership track", "partnership_opportunity"],
  ["buy in opportunity", "partnership_opportunity"],
  ["practice acquisition", "practice_acquisition"],
]);
const EMPLOYMENT_TYPE_ALIASES = new Map([
  ["full time", "full_time"],
  ["part time", "part_time"],
  ["per diem fill in", "per_diem_fill_in"],
  ["per diem", "per_diem_fill_in"],
  ["fill in", "per_diem_fill_in"],
]);
const WORK_ARRANGEMENT_ALIASES = new Map([
  ["on site", "on_site"],
  ["onsite", "on_site"],
  ["hybrid", "hybrid"],
  ["remote", "remote"],
]);
const COMPENSATION_TYPE_ALIASES = new Map([
  ["annual salary", "annual_salary"],
  ["annual_salary", "annual_salary"],
  ["salary", "annual_salary"],
  ["hourly wage", "hourly_wage"],
  ["hourly_wage", "hourly_wage"],
  ["hourly", "hourly_wage"],
  ["per diem", "per_diem"],
  ["per_diem", "per_diem"],
  ["production based", "production_based"],
  ["production_based", "production_based"],
  ["production", "production_based"],
  ["other", "other"],
]);
const CLINICAL_FOCUS_ALIASES = new Map([
  ["dry eye", "dry_eye"],
  ["dry_eye", "dry_eye"],
  ["myopia management", "myopia_management"],
  ["myopia_management", "myopia_management"],
  ["myopia control", "myopia_management"],
  ["specialty contact lenses", "specialty_contact_lenses"],
  ["specialty_contact_lenses", "specialty_contact_lenses"],
  ["specialty contacts", "specialty_contact_lenses"],
  ["vision therapy", "vision_therapy"],
  ["vision_therapy", "vision_therapy"],
  ["medical optometry", "medical_optometry"],
  ["medical_optometry", "medical_optometry"],
  ["pediatrics", "pediatrics"],
  ["pediatric", "pediatrics"],
  ["glaucoma", "glaucoma"],
  ["low vision", "low_vision"],
  ["low_vision", "low_vision"],
  ["primary care", "primary_care"],
  ["primary_care", "primary_care"],
  ["refractive surgical co management", "refractive_surgical_comanagement"],
  ["refractive surgical comanagement", "refractive_surgical_comanagement"],
  ["refractive_surgical_comanagement", "refractive_surgical_comanagement"],
  ["scleral lenses", "scleral_lenses"],
  ["scleral_lenses", "scleral_lenses"],
  ["scleral lens", "scleral_lenses"],
  ["ocular disease", "ocular_disease"],
  ["ocular_disease", "ocular_disease"],
]);
const PRACTICE_TYPE_ALIASES = new Map([
  ["private practice", "private_practice"],
  ["private_practice", "private_practice"],
  ["family practice", "family_practice"],
  ["family_practice", "family_practice"],
  ["retail optical", "retail_optical"],
  ["retail_optical", "retail_optical"],
  ["retail", "retail_optical"],
  ["corporate", "retail_optical"],
  ["od md", "od_md"],
  ["od/md", "od_md"],
  ["od_md", "od_md"],
  ["multi location group", "multi_location_group"],
  ["multi_location_group", "multi_location_group"],
  ["multi location", "multi_location_group"],
  ["academic", "academic"],
  ["nonprofit", "nonprofit"],
  ["non profit", "nonprofit"],
  ["government", "government"],
]);
const BENEFIT_FLAG_ALIASES = new Map([
  ["sign on bonus", "sign_on_bonus"],
  ["sign_on_bonus", "sign_on_bonus"],
  ["sign-on bonus", "sign_on_bonus"],
  ["ce allowance", "ce_allowance"],
  ["ce_allowance", "ce_allowance"],
  ["continuing education", "ce_allowance"],
  ["relocation assistance", "relocation_assistance"],
  ["relocation_assistance", "relocation_assistance"],
  ["relocation", "relocation_assistance"],
  ["student loan assistance", "student_loan_assistance"],
  ["student_loan_assistance", "student_loan_assistance"],
  ["student loan", "student_loan_assistance"],
]);
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
const LOCATION_MODES = new Set(["single", "multiple", "remote"]);
const SATURDAY_SCHEDULES = new Set([
  "none",
  "occasional",
  "alternating",
  "most",
  "every",
  "unknown",
]);
const LISTING_REPORT_REASONS = new Set([
  "expired",
  "broken_apply_link",
  "incorrect_location",
  "incorrect_employer",
  "duplicate_listing",
  "other",
]);
const JOB_APPLY_EVENT_TYPES = new Set(["listing_view", "apply_click"]);
const JOB_APPLY_DESTINATION_TYPES = new Set([
  "external_url",
  "recruiter_email",
  "recruiter_website",
]);

const PUBLIC_JOB_COLUMN_NAMES = [
  "id",
  "title",
  "description",
  "company",
  "location",
  "city",
  "state",
  "location_mode",
  "additional_locations",
  "latitude",
  "longitude",
  "role",
  "hours",
  "type",
  "opportunity_type",
  "opportunity_types",
  "practice_type",
  "employment_type",
  "employment_types",
  "work_arrangement",
  "work_arrangements",
  "saturday_schedule",
  "sign_on_bonus",
  "relocation_assistance",
  "benefits",
  "ce_allowance",
  "student_loan_assistance",
  "compensation_type",
  "salary_min",
  "salary_max",
  "hourly_min",
  "hourly_max",
  "daily_rate",
  "compensation_notes",
  "salary",
  "clinical_focuses",
  "practice_types",
  "benefit_flags",
  "tag_ids",
  "featured",
  "posted_at",
  "created_at",
  "updated_at",
  "source",
  "seed_batch",
  "external_apply_url",
  "application_email",
  "source_url",
  "listing_source",
  "listing_tier",
  "listing_opportunity_type",
  "location_precision",
  "claimed_by_user_id",
  "claimed_at",
  "claim_status",
  "parent_company",
  "employer_name",
  "employer_brand",
  "practice_name",
  "employer_brand_verified",
  "venue_brand",
  "venue_name",
  "venue_store_id",
  "venue_note",
  "status",
];
const PUBLIC_JOB_COLUMNS_CACHE_MS = 60_000;
let cachedPublicJobColumns = null;
let cachedPublicJobColumnsAt = 0;
const PUBLIC_JOB_COLUMN_FALLBACKS = {
  opportunity_types: "array[]::text[] as opportunity_types",
  employment_types: "array[]::text[] as employment_types",
  work_arrangements: "array[]::text[] as work_arrangements",
  work_arrangement: "null::text as work_arrangement",
  saturday_schedule: "null::text as saturday_schedule",
  sign_on_bonus: "null::text as sign_on_bonus",
  relocation_assistance: "false::boolean as relocation_assistance",
  benefits: "null::text as benefits",
  ce_allowance: "null::text as ce_allowance",
  student_loan_assistance: "false::boolean as student_loan_assistance",
  compensation_type: "null::text as compensation_type",
  salary_min: "null::numeric as salary_min",
  salary_max: "null::numeric as salary_max",
  hourly_min: "null::numeric as hourly_min",
  hourly_max: "null::numeric as hourly_max",
  daily_rate: "null::numeric as daily_rate",
  compensation_notes: "null::text as compensation_notes",
  clinical_focuses: "array[]::text[] as clinical_focuses",
  practice_types: "array[]::text[] as practice_types",
  benefit_flags: "array[]::text[] as benefit_flags",
  created_at: "null::timestamptz as created_at",
  updated_at: "null::timestamptz as updated_at",
  source: "null::text as source",
  seed_batch: "null::text as seed_batch",
  external_apply_url: "null::text as external_apply_url",
  application_email: "null::text as application_email",
  source_url: "null::text as source_url",
  listing_source:
    "case when source in ('discovery', 'import', 'imported') or external_apply_url is not null then 'imported' else 'employer_submitted' end as listing_source",
  listing_tier:
    "case when featured = true then 'featured' when source in ('discovery', 'import', 'imported') or external_apply_url is not null then 'imported' else 'standard_paid' end as listing_tier",
  listing_opportunity_type: "'job'::text as listing_opportunity_type",
  location_precision: "'unknown'::text as location_precision",
  location_mode: "'single'::text as location_mode",
  additional_locations: "array[]::text[] as additional_locations",
  claimed_by_user_id: "null::text as claimed_by_user_id",
  claimed_at: "null::timestamptz as claimed_at",
  claim_status: "'unclaimed'::text as claim_status",
  parent_company: "coalesce(employer_name, company)::text as parent_company",
  practice_name: "null::text as practice_name",
};

function isAdmin(user) {
  return String(user?.role || "").toLowerCase() === "admin";
}

function rejectedImportVisibilityFilterSql(jobAlias = "jobs") {
  return `
    not exists (
      select 1
      from public.job_imports ji
      where ji.published_job_id = ${jobAlias}.id
        and (
          ji.status = 'rejected'
          or ji.recommendation = 'reject'
          or ji.review_action = 'reject'
          or coalesce(ji.role_badge, '') = 'OTHER'
        )
    )
  `;
}

async function getPublicJobColumns() {
  const now = Date.now();
  if (cachedPublicJobColumns && now - cachedPublicJobColumnsAt < PUBLIC_JOB_COLUMNS_CACHE_MS) {
    return cachedPublicJobColumns;
  }

  const result = await query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'jobs'
    `
  );
  const available = new Set((result.rows || []).map((row) => row.column_name));

  cachedPublicJobColumns = PUBLIC_JOB_COLUMN_NAMES.map((column) =>
    available.has(column) ? column : PUBLIC_JOB_COLUMN_FALLBACKS[column]
  )
    .filter(Boolean)
    .join(",");
  cachedPublicJobColumnsAt = now;

  return cachedPublicJobColumns;
}

function canManageJob(user, job) {
  return (
    isAdmin(user) ||
    job?.recruiter_id === user?.id ||
    job?.posted_by === user?.id ||
    (job?.claim_status === "claimed" && job?.claimed_by_user_id === user?.id)
  );
}

function requestError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeChoiceKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[/-]+/g, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeEnum(value, allowed, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function normalizeListingOpportunityType(value, fallback = "job") {
  return normalizeEnum(value, LISTING_OPPORTUNITY_TYPES, fallback);
}

function normalizeListingSource(value, fallback = "employer_submitted") {
  return normalizeEnum(value, LISTING_SOURCES, fallback);
}

function normalizeListingTier(value, fallback = "standard_paid") {
  return normalizeEnum(value, LISTING_TIERS, fallback);
}

function normalizeLocationPrecision(value, fallback = "unknown") {
  return normalizeEnum(value, LOCATION_PRECISIONS, fallback);
}

function normalizeLocationMode(value, fallback = "single") {
  return normalizeEnum(value, LOCATION_MODES, fallback);
}

function normalizeSaturdaySchedule(value) {
  if (value === undefined) return undefined;
  return normalizeEnum(value, SATURDAY_SCHEDULES, "unknown");
}

const PUBLIC_SORT_MODES = new Set(["best_match", "newest", "distance", "salary"]);

function normalizePublicSortMode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized === "best" || normalized === "best_match") return "best_match";
  return PUBLIC_SORT_MODES.has(normalized) ? normalized : "best_match";
}

function publicRelevanceScoreSql(qParamIndex) {
  if (!qParamIndex) return "0::numeric";

  return `
    (
      case when public_jobs.title ilike $${qParamIndex} then 95 else 0 end +
      case when coalesce(public_jobs.role, '') ilike $${qParamIndex} then 70 else 0 end +
      case when coalesce(public_jobs.company, '') ilike $${qParamIndex} then 35 else 0 end +
      case when coalesce(public_jobs.employer_name, '') ilike $${qParamIndex} then 35 else 0 end +
      case when coalesce(public_jobs.employer_brand, '') ilike $${qParamIndex} then 35 else 0 end +
      case when coalesce(public_jobs.practice_name, '') ilike $${qParamIndex} then 30 else 0 end +
      case when coalesce(public_jobs.venue_brand, '') ilike $${qParamIndex} then 30 else 0 end +
      case when coalesce(public_jobs.venue_name, '') ilike $${qParamIndex} then 30 else 0 end +
      case when coalesce(public_jobs.parent_company, '') ilike $${qParamIndex} then 25 else 0 end +
      case when coalesce(public_jobs.location, '') ilike $${qParamIndex} then 20 else 0 end +
      case when coalesce(public_jobs.description, '') ilike $${qParamIndex} then 12 else 0 end
    )::numeric
  `;
}

function publicDistanceScoreSql() {
  return "0::numeric";
}

function publicFreshnessScoreSql() {
  return `
    greatest(
      0,
      18 * (
        1 - least(
          extract(epoch from (now() - coalesce(public_jobs.posted_at, public_jobs.created_at, now()))) / 86400,
          60
        ) / 60
      )
    )::numeric
  `;
}

function publicPromotionScoreSql() {
  return `
    (
      case
        when coalesce(nullif(public_jobs.listing_tier, ''), '') = 'sponsor' then 24
        when coalesce(nullif(public_jobs.listing_tier, ''), '') = 'featured' then 18
        when coalesce(nullif(public_jobs.listing_tier, ''), '') = 'standard_paid' then 8
        when coalesce(nullif(public_jobs.listing_tier, ''), '') = 'imported' then -4
        when coalesce(nullif(public_jobs.listing_source, ''), '') = 'imported' then -4
        else 0
      end +
      case
        when public_jobs.featured = true
          and coalesce(nullif(public_jobs.listing_tier, ''), '') not in ('featured', 'sponsor')
        then 10
        else 0
      end +
      case
        when public_jobs.source = 'seed' or public_jobs.seed_batch is not null then -3
        else 0
      end
    )::numeric
  `;
}

function publicJobOrderBy(sortMode) {
  switch (normalizePublicSortMode(sortMode)) {
    case "newest":
      return `
        freshness_score desc,
        ranking_score desc,
        posted_at desc nulls last,
        created_at desc nulls last
      `;
    case "distance":
      return `
        distance_score desc,
        relevance_score desc,
        ranking_score desc,
        promotion_score desc,
        posted_at desc nulls last
      `;
    case "salary":
      return `
        ranking_score desc,
        relevance_score desc,
        posted_at desc nulls last,
        created_at desc nulls last
      `;
    case "best_match":
    default:
      return `
        ranking_score desc,
        relevance_score desc,
        promotion_score desc,
        freshness_score desc,
        posted_at desc nulls last
      `;
  }
}

function isImportedListing(job = {}) {
  return (
    job.listing_source === "imported" ||
    job.source === "discovery" ||
    job.source === "imported" ||
    Boolean(job.external_apply_url)
  );
}

function normalizeApplyEventType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized === "view") return "listing_view";
  if (normalized === "apply" || normalized === "outbound_apply") return "apply_click";
  return JOB_APPLY_EVENT_TYPES.has(normalized) ? normalized : null;
}

function normalizeApplyDestinationType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized === "email" || normalized === "apply_email") return "recruiter_email";
  if (normalized === "url" || normalized === "apply_url") return "external_url";
  return JOB_APPLY_DESTINATION_TYPES.has(normalized) ? normalized : null;
}

function inferApplyDestinationType(job = {}) {
  if (job.external_apply_url) {
    return job.listing_source === "employer_submitted" ? "recruiter_website" : "external_url";
  }
  if (job.application_email) return "recruiter_email";
  return null;
}

function destinationDomainFor({ destinationType, destination, job = {} }) {
  if (destinationType === "recruiter_email") {
    const email = String(destination || job.application_email || "").trim();
    const domain = email.includes("@") ? email.split("@").pop() : "";
    return domain ? domain.toLowerCase().slice(0, 255) : null;
  }

  const url = destination || job.external_apply_url || "";
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.hostname.replace(/^www\./i, "").toLowerCase().slice(0, 255);
  } catch {
    return null;
  }
}

function shortNullableText(value, maxLength = 255) {
  const text = toNullableText(value);
  return text ? text.slice(0, maxLength) : null;
}

function normalizeOptionalChoice(value, aliases, message, code) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const canonical = aliases.get(normalizeChoiceKey(raw));
  if (canonical) return canonical;
  throw requestError(400, message, code);
}

function toInputArray(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function normalizeFilterTerms(value) {
  const input = toInputArray(value);
  if (!input) return [];
  return input
    .flatMap((item) => String(item || "").split(","))
    .map((item) => cleanText(item).toLowerCase())
    .filter(Boolean);
}

function normalizeChoiceList(value, aliases, message, code) {
  const input = toInputArray(value);
  if (input === undefined) return undefined;

  const seen = new Set();
  const normalized = [];
  for (const item of input) {
    const raw = String(item || "").trim();
    if (!raw) continue;
    const canonical = aliases.get(normalizeChoiceKey(raw));
    if (!canonical) throw requestError(400, message, code);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalized.push(canonical);
    }
  }
  return normalized;
}

function firstOrNull(values) {
  return Array.isArray(values) && values.length ? values[0] : null;
}

function normalizeOpportunityType(value) {
  return normalizeOptionalChoice(
    value,
    OPPORTUNITY_TYPE_ALIASES,
    "Please choose a valid opportunity type.",
    "invalid_opportunity_type"
  );
}

function normalizeOpportunityTypes(value) {
  return normalizeChoiceList(
    value,
    OPPORTUNITY_TYPE_ALIASES,
    "Please choose valid opportunity types.",
    "invalid_opportunity_type"
  );
}

function normalizeEmploymentType(value) {
  return normalizeOptionalChoice(
    value,
    EMPLOYMENT_TYPE_ALIASES,
    "Please choose a valid employment type.",
    "invalid_employment_type"
  );
}

function normalizeEmploymentTypes(value) {
  return normalizeChoiceList(
    value,
    EMPLOYMENT_TYPE_ALIASES,
    "Please choose valid employment types.",
    "invalid_employment_type"
  );
}

function normalizeWorkArrangement(value) {
  return normalizeOptionalChoice(
    value,
    WORK_ARRANGEMENT_ALIASES,
    "Please choose a valid work arrangement.",
    "invalid_work_arrangement"
  );
}

function normalizeWorkArrangements(value) {
  return normalizeChoiceList(
    value,
    WORK_ARRANGEMENT_ALIASES,
    "Please choose valid work arrangements.",
    "invalid_work_arrangement"
  );
}

function normalizeCompensationType(value) {
  return normalizeOptionalChoice(
    value,
    COMPENSATION_TYPE_ALIASES,
    "Please choose a valid compensation type.",
    "invalid_compensation_type"
  );
}

function normalizeClinicalFocuses(value) {
  const focuses = normalizeChoiceList(
    value,
    CLINICAL_FOCUS_ALIASES,
    "Please choose valid clinical focus areas.",
    "invalid_clinical_focus"
  ) || [];
  if (focuses.length > 5) {
    throw requestError(
      400,
      "Select up to 5 clinical focus areas.",
      "clinical_focus_limit_exceeded"
    );
  }
  return focuses;
}

function normalizePracticeTypes(value) {
  return (
    normalizeChoiceList(
      value,
      PRACTICE_TYPE_ALIASES,
      "Please choose valid practice types.",
      "invalid_practice_type"
    ) || []
  );
}

function normalizePracticeTypeFilterValues(value) {
  const canonicalValues = normalizePracticeTypes(value);
  const input = toInputArray(value) || [];
  const seen = new Set(canonicalValues);

  for (const item of input) {
    const raw = String(item || "").trim();
    if (!raw) continue;
    const choiceKey = normalizeChoiceKey(raw);
    const legacyValue = choiceKey.replace(/\s+/g, "_");
    if (PRACTICE_TYPE_ALIASES.has(choiceKey) && legacyValue && !seen.has(legacyValue)) {
      seen.add(legacyValue);
    }
  }

  return Array.from(seen);
}

function normalizeBenefitFlags(value) {
  return (
    normalizeChoiceList(
      value,
      BENEFIT_FLAG_ALIASES,
      "Please choose valid benefits and incentives.",
      "invalid_benefit_flag"
    ) || []
  );
}

function isLegacyRemoteEmployment(value) {
  return normalizeChoiceKey(value) === "remote";
}

function normalizeRole(value, { required = false } = {}) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) {
    if (required) {
      throw requestError(400, "Please choose a valid job role.", "invalid_job_role");
    }
    return null;
  }

  const key = raw.toLowerCase().replace(/[_-]+/g, " ");
  const canonical = ROLE_ALIASES.get(key);
  if (canonical && CANONICAL_ROLES.has(canonical)) return canonical;

  throw requestError(400, "Please choose a valid job role.", "invalid_job_role");
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sameText(a, b) {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function normalizeStateInput(value) {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = normalizeCityStateLocation(`Remote, ${text}`);
  return parsed.state || text.toUpperCase();
}

function normalizeAdditionalLocations(value) {
  const locations = [];
  const seen = new Set();
  for (const item of toInputArray(value) || []) {
    const text = cleanText(item);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    locations.push(text);
  }
  if (locations.length > 8) {
    throw requestError(
      400,
      "List up to 8 additional nearby areas.",
      "additional_locations_limit_exceeded"
    );
  }
  return locations;
}

function sameTextArray(a, b) {
  const left = normalizeAdditionalLocations(a).map((item) => item.toLowerCase()).join("|");
  const right = normalizeAdditionalLocations(b).map((item) => item.toLowerCase()).join("|");
  return left === right;
}

function normalizeJobLocationFields(fields = {}) {
  const locationMode = normalizeLocationMode(fields.location_mode ?? fields.locationMode, "single");
  const locationText = cleanText(fields.location);
  const parsed = normalizeCityStateLocation(locationText);
  const rawCity = cleanText(fields.city) || parsed.city || "";
  const rawState = fields.state ?? parsed.state;
  const state = normalizeStateInput(rawState);

  if (locationMode === "remote") {
    return {
      location: state ? `Remote, ${state}` : locationText,
      city: null,
      state,
      location_mode: "remote",
      location_precision: "remote",
      additional_locations: [],
    };
  }

  const city = rawCity || null;
  const normalizedLocation = [city, state].filter(Boolean).join(", ") || locationText;
  const additionalLocations =
    locationMode === "multiple"
      ? normalizeAdditionalLocations(fields.additional_locations ?? fields.additionalLocations)
      : [];

  return {
    location: normalizedLocation,
    city,
    state,
    location_mode: locationMode,
    location_precision:
      locationMode === "multiple"
        ? "multiple"
        : cleanText(fields.geocodeAddress || fields.geocode_address)
        ? "facility"
        : "city",
    additional_locations: additionalLocations,
  };
}

function locationNeedsCoordinates(fields = {}) {
  return normalizeLocationMode(fields.location_mode ?? fields.locationMode, "single") !== "remote";
}

async function resolveCoordinatesForJob(fields, { required = false } = {}) {
  if (!locationNeedsCoordinates(fields)) return null;
  return resolveJobCoordinates(fields, { required });
}

function didLocationChange(body, job) {
  const textChanged = ["location", "city", "state", "location_mode"].some(
    (field) => field in body && !sameText(body[field], job?.[field])
  );
  if (textChanged) return true;
  if ("additional_locations" in body || "additionalLocations" in body) {
    return !sameTextArray(
      body.additional_locations ?? body.additionalLocations,
      job?.additional_locations
    );
  }
  return false;
}

function assertPublishableJobFields(fields = {}, applyDestination = {}) {
  const missing = [];
  if (!cleanText(fields.title)) missing.push("job title");
  normalizeRole(fields.role, { required: true });

  const locationFields = normalizeJobLocationFields(fields);
  if (locationFields.location_mode === "remote") {
    if (!locationFields.state) missing.push("licensing state");
  } else if (!locationFields.city || !locationFields.state) {
    missing.push("city and state");
  }

  const employmentInput =
    Array.isArray(fields.employment_types) && fields.employment_types.length
      ? fields.employment_types
      : fields.employment_type || fields.type;
  const employmentTypes = normalizeEmploymentTypes(employmentInput) || [];
  if (!employmentTypes.length) missing.push("employment type");

  if (!applyDestination.external_apply_url && !applyDestination.application_email) {
    missing.push("apply method");
  }

  if (missing.length) {
    throw requestError(
      400,
      `Complete ${missing.join(", ")} before publishing.`,
      "posting_incomplete"
    );
  }
}

async function enforceRecruiterCanPost(req, res, excludeJobId = null, role = null) {
  if (isAdmin(req.user)) return false;

  const normalizedRole = normalizeRole(role);
  const requiredPlanKey = getRequiredRecruiterPlanKey(normalizedRole);
  const roleLabel = ROLE_LABELS[normalizedRole] || "This role";
  const requiredPlanLabel = RECRUITER_POSTING_PLAN_LABELS[requiredPlanKey] || "matching posting";

  if (!excludeJobId) {
    res.status(402).json({
      error: `${roleLabel} requires ${requiredPlanLabel} checkout before publishing. Save the posting first, then continue to checkout.`,
      code: "recruiter_posting_payment_required",
      role: normalizedRole,
      requiredPlanKey,
    });
    return true;
  }

  const payment = await getRecruiterPostingPaymentState(excludeJobId, {
    role: normalizedRole,
  });
  if (!payment.active) {
    res.status(402).json({
      error: `${roleLabel} requires ${requiredPlanLabel} checkout before publishing.`,
      code: "recruiter_posting_payment_required",
      jobId: excludeJobId,
      role: normalizedRole,
      requiredPlanKey,
      payment,
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

function toNullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function benefitFlagsFromJobFields(fields = {}) {
  const flags = new Set();
  if (toNullableText(fields.sign_on_bonus ?? fields.signOnBonus)) flags.add("sign_on_bonus");
  if (toNullableText(fields.ce_allowance ?? fields.ceAllowance)) flags.add("ce_allowance");
  if (normalizeBoolean(fields.relocation_assistance ?? fields.relocationAssistance, false)) {
    flags.add("relocation_assistance");
  }
  if (normalizeBoolean(fields.student_loan_assistance ?? fields.studentLoanAssistance, false)) {
    flags.add("student_loan_assistance");
  }
  return Array.from(flags);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normalizeApplyUrl(value, { required = false } = {}) {
  const text = toNullableText(value);
  if (!text) {
    if (required) {
      throw requestError(
        400,
        "Enter an apply URL beginning with http:// or https://.",
        "invalid_apply_url"
      );
    }
    return null;
  }

  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
    return url.toString();
  } catch {
    throw requestError(
      400,
      "Enter an apply URL beginning with http:// or https://.",
      "invalid_apply_url"
    );
  }
}

function normalizeApplyEmail(value, { required = false } = {}) {
  const text = toNullableText(value);
  if (!text) {
    if (required) {
      throw requestError(400, "Enter a valid apply email.", "invalid_apply_email");
    }
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw requestError(400, "Enter a valid apply email.", "invalid_apply_email");
  }
  return text.toLowerCase();
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

async function getRecruiterApplyProfile(profileId) {
  if (!profileId) return {};
  return (
    (await one(
      `
        select email, application_use_account_email, application_email, application_website
        from public.profiles
        where id = $1
      `,
      [profileId]
    )) || {}
  );
}

function resolveApplyDestination({ body = {}, existing = {}, profile = {}, forPublication = false } = {}) {
  const urlProvided =
    hasOwn(body, "external_apply_url") || hasOwn(body, "apply_url") || hasOwn(body, "applyUrl");
  const emailProvided =
    hasOwn(body, "application_email") ||
    hasOwn(body, "applicationEmail") ||
    hasOwn(body, "apply_email") ||
    hasOwn(body, "applyEmail");

  let externalApplyUrl = urlProvided
    ? normalizeApplyUrl(body.external_apply_url ?? body.apply_url ?? body.applyUrl)
    : existing.external_apply_url || null;
  let applicationEmail = emailProvided
    ? normalizeApplyEmail(
        body.application_email ?? body.applicationEmail ?? body.apply_email ?? body.applyEmail
      )
    : existing.application_email || null;

  const useDefault = normalizeBoolean(
    body.use_default_apply_destination ?? body.useDefaultApplyDestination,
    true
  );

  if (useDefault && !externalApplyUrl && !applicationEmail) {
    if (profile.application_website) {
      try {
        externalApplyUrl = normalizeApplyUrl(profile.application_website, {
          required: forPublication,
        });
      } catch (error) {
        if (forPublication) throw error;
        externalApplyUrl = null;
      }
    }

    const defaultEmail =
      profile.application_email ||
      (profile.application_use_account_email === false ? null : profile.email);
    if (!externalApplyUrl && defaultEmail) {
      try {
        applicationEmail = normalizeApplyEmail(defaultEmail, { required: forPublication });
      } catch (error) {
        if (forPublication) throw error;
        applicationEmail = null;
      }
    }
  }

  if (forPublication && !externalApplyUrl && !applicationEmail) {
    throw requestError(
      400,
      "Add an apply URL or apply email before publishing.",
      "apply_destination_required"
    );
  }

  return {
    external_apply_url: externalApplyUrl,
    application_email: applicationEmail,
  };
}

function numberOrNull(value, fieldLabel) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw requestError(400, `Please enter a valid ${fieldLabel}.`, "invalid_compensation");
  }
  return number;
}

function moneyText(value) {
  if (value === null || value === undefined) return "";
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function buildCompensationSummary(compensation, legacySalary = null) {
  if (compensation.compensation_type === "annual_salary") {
    const min = moneyText(compensation.salary_min);
    const max = moneyText(compensation.salary_max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `From ${min}`;
    if (max) return `Up to ${max}`;
  }
  if (compensation.compensation_type === "hourly_wage") {
    const min = moneyText(compensation.hourly_min);
    const max = moneyText(compensation.hourly_max);
    if (min && max) return `${min} - ${max}/hr`;
    if (min) return `From ${min}/hr`;
    if (max) return `Up to ${max}/hr`;
  }
  if (compensation.compensation_type === "per_diem") {
    const daily = moneyText(compensation.daily_rate);
    if (daily) return `${daily}/day`;
  }
  if (compensation.compensation_type === "production_based" || compensation.compensation_type === "other") {
    return compensation.compensation_notes || null;
  }
  return legacySalary ?? null;
}

function normalizeCompensation(body = {}, existing = {}) {
  const hasType = Object.prototype.hasOwnProperty.call(body, "compensation_type");
  const compensation_type = hasType
    ? normalizeCompensationType(body.compensation_type)
    : existing.compensation_type || null;

  const compensation = {
    compensation_type: compensation_type || null,
    salary_min: null,
    salary_max: null,
    hourly_min: null,
    hourly_max: null,
    daily_rate: null,
    compensation_notes: null,
  };

  if (compensation_type === "annual_salary") {
    compensation.salary_min = numberOrNull(body.salary_min ?? existing.salary_min, "salary minimum");
    compensation.salary_max = numberOrNull(body.salary_max ?? existing.salary_max, "salary maximum");
    if (
      compensation.salary_min !== null &&
      compensation.salary_max !== null &&
      compensation.salary_min > compensation.salary_max
    ) {
      throw requestError(400, "Salary max must be greater than salary min.", "invalid_compensation");
    }
  } else if (compensation_type === "hourly_wage") {
    compensation.hourly_min = numberOrNull(body.hourly_min ?? existing.hourly_min, "hourly minimum");
    compensation.hourly_max = numberOrNull(body.hourly_max ?? existing.hourly_max, "hourly maximum");
    if (
      compensation.hourly_min !== null &&
      compensation.hourly_max !== null &&
      compensation.hourly_min > compensation.hourly_max
    ) {
      throw requestError(400, "Hourly max must be greater than hourly min.", "invalid_compensation");
    }
  } else if (compensation_type === "per_diem") {
    compensation.daily_rate = numberOrNull(body.daily_rate ?? existing.daily_rate, "daily rate");
  } else if (compensation_type === "production_based" || compensation_type === "other") {
    compensation.compensation_notes = toNullableText(
      Object.prototype.hasOwnProperty.call(body, "compensation_notes")
        ? body.compensation_notes
        : existing.compensation_notes
    );
  }

  compensation.salary = buildCompensationSummary(compensation, body.salary ?? existing.salary ?? null);
  return compensation;
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
    const {
      q,
      city,
      state,
      tags,
      sort = "best_match",
      limit = "20",
      offset = "0",
      publishedSince: publishedSinceQuery,
    } = req.query;
    const tagIds = typeof tags === "string" && tags.length ? tags.split(",") : [];
    const clinicalFocuses = normalizeClinicalFocuses(
      req.query.clinicalFocuses ?? req.query.clinical_focuses ?? req.query.clinicalFocus ?? req.query.clinical_focus
    );
    const practiceTypeQuery =
      req.query.practiceTypes ?? req.query.practice_types ?? req.query.practiceType ?? req.query.practice_type;
    const practiceTypeFilterValues = normalizePracticeTypeFilterValues(practiceTypeQuery);
    const benefitFlags = normalizeBenefitFlags(
      req.query.benefitFlags ?? req.query.benefit_flags ?? req.query.benefit
    );
    const sortMode = normalizePublicSortMode(sort);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    const where = [
      "jobs.status = 'active'",
      "jobs.is_archived = false",
      rejectedImportVisibilityFilterSql("jobs"),
    ];
    const params = [];
    let qParamIndex = null;

    if (publishedSinceQuery !== undefined && publishedSinceQuery !== "") {
      if (Array.isArray(publishedSinceQuery)) {
        return res.status(400).json({ error: "publishedSince must be a single timestamp." });
      }
      const publishedSince = new Date(String(publishedSinceQuery));
      if (!Number.isFinite(publishedSince.getTime())) {
        return res.status(400).json({ error: "publishedSince must be a valid timestamp." });
      }
      params.push(publishedSince.toISOString());
      where.push(`coalesce(jobs.first_activated_at, jobs.posted_at) >= $${params.length}::timestamptz`);
    }

    if (q) {
      params.push(`%${q}%`);
      qParamIndex = params.length;
      where.push(`(
        title ilike $${qParamIndex}
        or coalesce(role, '') ilike $${qParamIndex}
        or coalesce(company, '') ilike $${qParamIndex}
        or coalesce(employer_name, '') ilike $${qParamIndex}
        or coalesce(employer_brand, '') ilike $${qParamIndex}
        or coalesce(practice_name, '') ilike $${qParamIndex}
        or coalesce(venue_brand, '') ilike $${qParamIndex}
        or coalesce(venue_name, '') ilike $${qParamIndex}
        or coalesce(parent_company, '') ilike $${qParamIndex}
        or coalesce(location, '') ilike $${qParamIndex}
        or coalesce(description, '') ilike $${qParamIndex}
      )`);
    }
    const includeBrands = normalizeFilterTerms(req.query.includeBrand ?? req.query.include_brand);
    const excludeBrands = normalizeFilterTerms(req.query.excludeBrand ?? req.query.exclude_brand);
    const includeParentCompanies = normalizeFilterTerms(
      req.query.includeParentCompany ?? req.query.include_parent_company
    );
    const excludeParentCompanies = normalizeFilterTerms(
      req.query.excludeParentCompany ?? req.query.exclude_parent_company
    );
    if (includeBrands.length) {
      params.push(includeBrands);
      where.push(`lower(coalesce(employer_brand, '')) = any($${params.length}::text[])`);
    }
    if (excludeBrands.length) {
      params.push(excludeBrands);
      where.push(`not (lower(coalesce(employer_brand, '')) = any($${params.length}::text[]))`);
    }
    if (includeParentCompanies.length) {
      params.push(includeParentCompanies);
      where.push(`lower(coalesce(parent_company, '')) = any($${params.length}::text[])`);
    }
    if (excludeParentCompanies.length) {
      params.push(excludeParentCompanies);
      where.push(`not (lower(coalesce(parent_company, '')) = any($${params.length}::text[]))`);
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
    if (clinicalFocuses.length) {
      params.push(clinicalFocuses);
      where.push(`clinical_focuses @> $${params.length}::text[]`);
    }
    if (practiceTypeFilterValues.length) {
      params.push(practiceTypeFilterValues);
      where.push(
        `(coalesce(practice_types, array[]::text[]) && $${params.length}::text[] or practice_type = any($${params.length}::text[]))`
      );
    }
    if (benefitFlags.length) {
      params.push(benefitFlags);
      where.push(`benefit_flags @> $${params.length}::text[]`);
    }

    const countParams = [...params];
    const totalResult = await query(
      `
        select count(*)::int as total
        from public.jobs jobs
        where ${where.join(" and ")}
      `,
      countParams
    );
    const total = Number(totalResult.rows?.[0]?.total || 0);

    params.push(safeLimit);
    const limitParam = params.length;
    params.push(safeOffset);
    const offsetParam = params.length;

    const publicJobColumns = await getPublicJobColumns();
    const result = await query(
      `
        select
          ranked.*,
          (
            ranked.relevance_score +
            ranked.distance_score +
            ranked.freshness_score +
            ranked.promotion_score
          ) as ranking_score
        from (
          select
            public_jobs.*,
            ${publicRelevanceScoreSql(qParamIndex)} as relevance_score,
            ${publicDistanceScoreSql()} as distance_score,
            ${publicFreshnessScoreSql()} as freshness_score,
            ${publicPromotionScoreSql()} as promotion_score
          from (
            select ${publicJobColumns}
            from public.jobs jobs
            where ${where.join(" and ")}
          ) public_jobs
        ) ranked
        order by ${publicJobOrderBy(sortMode)}
        limit $${limitParam}
        offset $${offsetParam}
      `,
      params
    );

    res.json({
      items: result.rows,
      total,
      limit: safeLimit,
      offset: safeOffset,
    });
  } catch (e) {
    if (e?.statusCode) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code });
    }
    console.error("List jobs error:", e);
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

router.get("/recruiter", requireAuth, requireJobManager, async (req, res) => {
  try {
    const selectWithPayment = `
      select
        j.*,
        coalesce(event_stats.view_count, 0)::int as analytics_views,
        coalesce(event_stats.apply_click_count, 0)::int as apply_clicks,
        coalesce(favorite_stats.save_count, 0)::int as saves_count,
        coalesce(favorite_stats.save_count, 0)::int as analytics_saves,
        case
          when coalesce(event_stats.view_count, 0) = 0 then 0::numeric
          else round((coalesce(event_stats.apply_click_count, 0)::numeric / event_stats.view_count::numeric) * 100, 1)
        end as apply_rate,
        event_stats.last_apply_click_at,
        case
          when rpp.id is null then null
          else json_build_object(
            'active', rpp.status in ('active', 'trialing'),
            'status', rpp.status,
            'role', rpp.role,
            'requiredPlanKey', rpp.required_plan_key,
            'dbPlan', rpp.db_plan,
            'stripeCustomerId', rpp.stripe_customer_id,
            'stripeCheckoutSessionId', rpp.stripe_checkout_session_id,
            'stripeSubscriptionId', rpp.stripe_subscription_id,
            'stripePriceId', rpp.stripe_price_id,
            'stripeLookupKey', rpp.stripe_lookup_key,
            'paidAt', rpp.paid_at,
            'updatedAt', rpp.updated_at
          )
        end as payment
      from public.jobs j
      left join lateral (
        select *
        from public.recruiter_posting_payments
        where job_id = j.id
        order by updated_at desc nulls last, created_at desc
        limit 1
      ) rpp on true
      left join lateral (
        select
          count(*) filter (where event_type = 'listing_view')::int as view_count,
          count(*) filter (where event_type = 'apply_click')::int as apply_click_count,
          max(created_at) filter (where event_type = 'apply_click') as last_apply_click_at
        from public.job_apply_events jae
        where jae.job_id = j.id
      ) event_stats on true
      left join lateral (
        select count(*)::int as save_count
        from public.job_favorites jf
        where jf.job_id = j.id
      ) favorite_stats on true
    `;
    const result = isAdmin(req.user)
      ? await query(`${selectWithPayment} order by j.posted_at desc`)
      : await query(
          `
            ${selectWithPayment}
            where j.recruiter_id = $1
              or j.posted_by = $1
              or (j.claim_status = 'claimed' and j.claimed_by_user_id = $1)
            order by j.posted_at desc
          `,
          [req.user.id]
        );

    return res.json({ data: result.rows || [] });
  } catch (e) {
    console.error("Recruiter jobs error:", e);
    return res.status(500).json({ error: "Failed to fetch recruiter jobs" });
  }
});

router.get("/public/:id", maybeAuth, async (req, res) => {
  try {
    const publicJobColumns = await getPublicJobColumns();
    const job = await one(
      `
        select *
        from (
          select ${publicJobColumns}
          from public.jobs jobs
          where jobs.id = $1
            and jobs.status = 'active'
            and jobs.is_archived = false
            and ${rejectedImportVisibilityFilterSql("jobs")}
        ) public_job
      `,
      [req.params.id]
    );

    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  } catch (e) {
    console.error("Fetch public job error:", e);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.post("/:id/report", maybeAuth, async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim().toLowerCase();
    if (!LISTING_REPORT_REASONS.has(reason)) {
      return res.status(400).json({ error: "Choose a valid report reason." });
    }

    const publicJobColumns = await getPublicJobColumns();
    const job = await one(
      `
        select *
        from (
          select ${publicJobColumns}
          from public.jobs jobs
          where jobs.id = $1
            and jobs.status = 'active'
            and jobs.is_archived = false
            and ${rejectedImportVisibilityFilterSql("jobs")}
        ) public_job
      `,
      [req.params.id]
    );

    if (!job) return res.status(404).json({ error: "Job not found" });

    const report = await one(
      `
        insert into public.job_listing_reports (
          job_id,
          reason,
          comment,
          reported_by_user_id
        )
        values ($1, $2, $3, $4)
        returning *
      `,
      [
        job.id,
        reason,
        toNullableText(req.body?.comment)?.slice(0, 1000) || null,
        req.user?.id || null,
      ]
    );

    return res.status(201).json({ ok: true, report });
  } catch (e) {
    console.error("Report listing issue error:", e);
    return res.status(500).json({ error: "Failed to submit listing report" });
  }
});

router.post("/:id/events", maybeAuth, async (req, res) => {
  try {
    const eventType = normalizeApplyEventType(req.body?.event_type || req.body?.eventType);
    if (!eventType) {
      return res.status(400).json({ error: "Choose a valid apply event type." });
    }

    const job = await one(
      `
        select
          jobs.id,
          jobs.external_apply_url,
          jobs.application_email,
          jobs.listing_source
        from public.jobs jobs
        where jobs.id = $1
          and jobs.status = 'active'
          and jobs.is_archived = false
          and ${rejectedImportVisibilityFilterSql("jobs")}
      `,
      [req.params.id]
    );

    if (!job) return res.status(404).json({ error: "Job not found" });

    const bodyDestinationType = normalizeApplyDestinationType(
      req.body?.destination_type || req.body?.destinationType
    );
    const destinationType =
      eventType === "apply_click"
        ? bodyDestinationType || inferApplyDestinationType(job)
        : bodyDestinationType;

    if (eventType === "apply_click" && !destinationType) {
      return res.status(400).json({ error: "Apply destination is required." });
    }

    const destinationDomain = destinationDomainFor({
      destinationType,
      destination: req.body?.destination,
      job,
    });
    const metadata =
      req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : {};

    const event = await one(
      `
        insert into public.job_apply_events (
          job_id,
          user_id,
          event_type,
          destination_type,
          destination_domain,
          event_source,
          session_id,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        returning id, created_at
      `,
      [
        job.id,
        req.user?.id || null,
        eventType,
        destinationType || null,
        destinationDomain,
        shortNullableText(req.body?.source || req.body?.eventSource, 80),
        shortNullableText(req.body?.session_id || req.body?.sessionId, 128),
        JSON.stringify(metadata),
      ]
    );

    return res.status(201).json({ ok: true, event });
  } catch (e) {
    console.error("Track job apply event error:", e);
    return res.status(500).json({ error: "Failed to track job event" });
  }
});

router.get("/:id", requireAuth, requireJobManager, async (req, res) => {
  try {
    const job = await one("select * from public.jobs where id = $1", [req.params.id]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const payment = await getRecruiterPostingPaymentState(job.id, { role: job.role });
    return res.json({ ...job, payment });
  } catch (e) {
    console.error("Fetch job error:", e);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.post("/:id/claim", requireAuth, requireListingClaimAccount, async (req, res) => {
  try {
    const job = await one("select * from public.jobs where id = $1", [req.params.id]);
    if (!job) return res.status(404).json({ error: "Job not found" });

    if (!isImportedListing(job)) {
      return res.status(400).json({ error: "Only imported listings can be claimed." });
    }

    if (job.claim_status === "claimed" && job.claimed_by_user_id !== req.user.id) {
      return res.status(409).json({ error: "This listing has already been claimed." });
    }

    if (job.claim_status === "claimed" && job.claimed_by_user_id === req.user.id) {
      return res.json({ ok: true, claimStatus: "claimed" });
    }

    const existing = await one(
      `
        select *
        from public.job_listing_claims
        where job_id = $1
          and requested_by_user_id = $2
          and status = 'pending'
        order by created_at desc
        limit 1
      `,
      [job.id, req.user.id]
    );

    if (existing) {
      return res.status(200).json({ ok: true, claimStatus: "pending", claim: existing });
    }

    const claim = await one(
      `
        insert into public.job_listing_claims (
          job_id,
          requested_by_user_id,
          requester_email,
          requester_name,
          company_name,
          company_website,
          message
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
      [
        job.id,
        req.user.id,
        req.user.email || null,
        toNullableText(req.body?.requester_name),
        toNullableText(req.body?.company_name),
        toNullableText(req.body?.company_website),
        toNullableText(req.body?.message),
      ]
    );

    await query(
      `
        update public.jobs
        set claim_status = 'pending',
            updated_at = now()
        where id = $1
          and claim_status <> 'claimed'
      `,
      [job.id]
    );

    res.status(201).json({ ok: true, claimStatus: "pending", claim });
  } catch (e) {
    console.error("Claim listing error:", e);
    res.status(500).json({ error: "Failed to submit listing claim" });
  }
});

router.post("/", requireAuth, requireJobManager, async (req, res) => {
  try {
    const user = req.user;
    const recruiter_id = user.id;
    const nowIso = new Date().toISOString();
    const requestedStatus = String(req.body?.status || "").toLowerCase();
    const publishRequested =
      req.body?.publish === true ||
      req.body?.action === "publish" ||
      (requestedStatus && requestedStatus !== "draft");
    const saveAsDraft =
      req.body?.save_as_draft === true ||
      req.body?.saveAsDraft === true ||
      req.body?.publish === false ||
      requestedStatus === "draft";
    const shouldPublish = publishRequested && !saveAsDraft;

    const role = normalizeRole(req.body.role, { required: true });
    if (shouldPublish && (await enforceRecruiterCanPost(req, res, null, role))) return;

    const locationFields = normalizeJobLocationFields(req.body);
    const coordinates = await resolveCoordinatesForJob(
      { ...req.body, ...locationFields },
      { required: shouldPublish }
    );
    const rawEmploymentType = req.body.employment_type ?? req.body.type;
    const legacyRemoteEmployment = isLegacyRemoteEmployment(rawEmploymentType);
    let employment_types = normalizeEmploymentTypes(
      req.body.employment_types ??
        (legacyRemoteEmployment ? ["full_time"] : rawEmploymentType)
    ) || [];
    let work_arrangements = normalizeWorkArrangements(
      req.body.work_arrangements ??
        req.body.work_arrangement ??
        req.body.onsite_type ??
        (legacyRemoteEmployment ? ["remote"] : undefined)
    ) || [];
    const opportunity_types =
      role === "optometrist"
        ? normalizeOpportunityTypes(req.body.opportunity_types ?? req.body.opportunity_type) || []
        : [];
    const employment_type = firstOrNull(employment_types);
    const work_arrangement = firstOrNull(work_arrangements);
    const opportunity_type = firstOrNull(opportunity_types);
    const compensation = normalizeCompensation(req.body);
    const listing_opportunity_type = normalizeListingOpportunityType(
      req.body.listing_opportunity_type ?? req.body.marketplace_opportunity_type,
      "job"
    );
    const location_precision = normalizeLocationPrecision(
      req.body.location_precision,
      locationFields.location_precision
    );
    const saturday_schedule = normalizeSaturdaySchedule(req.body.saturday_schedule);
    const clinical_focuses = normalizeClinicalFocuses(
      req.body.clinical_focuses ?? req.body.clinical_focus
    );
    const practice_types = normalizePracticeTypes(req.body.practice_types ?? req.body.practice_type);
    const benefit_flags = normalizeBenefitFlags([
      ...(toInputArray(req.body.benefit_flags) || []),
      ...benefitFlagsFromJobFields(req.body),
    ]);

    let employer_name = req.body.employer_name ?? req.body.company ?? null;
    let employer_brand = normalizeBrand(req.body.employer_brand ?? req.body.brand ?? null);
    let employer_domain = normalizeDomain(req.body.employer_domain ?? req.body.company_domain ?? "");
    let venue_brand = normalizeBrand(req.body.venue_brand ?? null);
    let venue_name = req.body.venue_name ?? null;
    const explicit_practice_name = toNullableText(req.body.practice_name ?? req.body.practiceName);

    const venue_store_id = req.body.venue_store_id ?? null;
    const venue_note = req.body.venue_note ?? null;

    let status = shouldPublish ? "active" : "draft";
    let employer_brand_verified = false;

    if (employer_brand && brandByKey(employer_brand)) {
      employer_brand_verified = await isBrandVerifiedForRecruiter(
        recruiter_id,
        employer_brand,
        employer_domain
      );

      if (!employer_brand_verified && shouldPublish) status = "pending_domain";
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
    const attribution = inferEmployerAttribution({
      parentCompany: employer_name,
      employerBrand: employer_brand,
      practiceName: explicit_practice_name || venue_name || null,
      employerName: employer_name,
      company: employer_name,
      title: req.body.title,
      description: req.body.description,
    });
    const applyProfile = await getRecruiterApplyProfile(recruiter_id);
    const applyDestination = resolveApplyDestination({
      body: req.body,
      profile: applyProfile,
      forPublication: shouldPublish,
    });
    if (shouldPublish) {
      assertPublishableJobFields({ ...req.body, ...locationFields, role }, applyDestination);
    }

    const payload = {
      title: req.body.title,
      description: req.body.description ?? null,
      company: employer_name ?? null,
      employer_name: employer_name ?? null,
      location: locationFields.location ?? null,
      city: locationFields.city ?? null,
      state: locationFields.state ?? null,
      location_mode: locationFields.location_mode,
      additional_locations: locationFields.additional_locations,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      role,
      hours: null,
      type: employment_type ?? null,
      opportunity_type,
      opportunity_types,
      practice_type: firstOrNull(practice_types),
      practice_types,
      employment_type,
      employment_types,
      work_arrangement,
      work_arrangements,
      saturday_schedule,
      clinical_focuses,
      sign_on_bonus: toNullableText(req.body.sign_on_bonus ?? req.body.signOnBonus),
      relocation_assistance: normalizeBoolean(
        req.body.relocation_assistance ?? req.body.relocationAssistance,
        false
      ),
      benefits: toNullableText(req.body.benefits),
      ce_allowance: toNullableText(req.body.ce_allowance ?? req.body.ceAllowance),
      student_loan_assistance: normalizeBoolean(
        req.body.student_loan_assistance ?? req.body.studentLoanAssistance,
        false
      ),
      benefit_flags,
      compensation_type: compensation.compensation_type,
      salary_min: compensation.salary_min,
      salary_max: compensation.salary_max,
      hourly_min: compensation.hourly_min,
      hourly_max: compensation.hourly_max,
      daily_rate: compensation.daily_rate,
      compensation_notes: compensation.compensation_notes,
      salary: compensation.salary,
      tag_ids: toTagIds(req.body.tag_ids),
      recruiter_id,
      parent_company: employer_name ?? null,
      practice_name:
        attribution.practiceName || explicit_practice_name || venue_name || (!employer_brand ? employer_name : null),
      listing_source: "employer_submitted",
      listing_tier: "standard_paid",
      listing_opportunity_type,
      location_precision,
      is_archived: false,
      posted_at: nowIso,
      first_activated_at: shouldPublish && status === "active" ? nowIso : null,
      last_activated_at: shouldPublish && status === "active" ? nowIso : null,
      external_apply_url: applyDestination.external_apply_url,
      application_email: applyDestination.application_email,
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
    const payment = await getRecruiterPostingPaymentState(data.id, { role: data.role });

    res.status(201).json({
      job: { ...data, payment },
      requiresVerification: status === "pending_domain",
      isDraft: status === "draft",
      message:
        status === "draft"
          ? "Posting saved. Continue to checkout when ready."
          : status === "pending_domain"
          ? "Brand postings require domain verification. We saved this as Pending Domain."
          : undefined,
    });
  } catch (e) {
    if (e?.statusCode) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code });
    }
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

    const marketplaceFields = [
      "listing_source",
      "listing_tier",
      "listing_opportunity_type",
      "marketplace_opportunity_type",
      "location_precision",
    ].filter((field) => field in req.body);

    if (marketplaceFields.length && !isAdmin(req.user)) {
      return res.status(403).json({
        error: "Only admins can change listing marketplace metadata.",
        fields: marketplaceFields,
      });
    }

    const allowed = [
      "title",
      "description",
      "location",
      "city",
      "state",
      "location_mode",
      "additional_locations",
      "latitude",
      "longitude",
      "role",
      "type",
      "opportunity_type",
      "opportunity_types",
      "practice_type",
      "practice_types",
      "employment_type",
      "employment_types",
      "work_arrangement",
      "work_arrangements",
      "saturday_schedule",
      "clinical_focuses",
      "sign_on_bonus",
      "relocation_assistance",
      "benefits",
      "ce_allowance",
      "student_loan_assistance",
      "benefit_flags",
      "compensation_type",
      "salary_min",
      "salary_max",
      "hourly_min",
      "hourly_max",
      "daily_rate",
      "compensation_notes",
      "salary",
      "tag_ids",
      "external_apply_url",
      "application_email",
      "employer_name",
      "practice_name",
      "employer_brand",
      "employer_domain",
      "venue_brand",
      "venue_name",
      "venue_store_id",
      "venue_note",
      "listing_source",
      "listing_tier",
      "listing_opportunity_type",
      "location_precision",
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    updates.hours = null;
    const hasBeenPublished = Boolean(job.first_activated_at) || !["draft"].includes(job.status);
    if ("role" in updates) {
      updates.role = normalizeRole(updates.role, { required: true });
      const roleChanged = updates.role !== normalizeRole(job.role);
      if (roleChanged && hasBeenPublished) {
        throw requestError(
          400,
          "Role category is locked after publication. Create a new posting for a different role category.",
          "role_category_locked"
        );
      }
    }
    if ("tag_ids" in updates) updates.tag_ids = toTagIds(updates.tag_ids);
    if ("clinical_focuses" in updates) {
      updates.clinical_focuses = normalizeClinicalFocuses(updates.clinical_focuses);
    }
    if ("external_apply_url" in updates) {
      updates.external_apply_url = normalizeApplyUrl(updates.external_apply_url);
    }
    if ("application_email" in updates) {
      updates.application_email = normalizeApplyEmail(updates.application_email);
    }
    if ("listing_source" in updates) {
      updates.listing_source = normalizeListingSource(updates.listing_source, job.listing_source || "employer_submitted");
    }
    if ("listing_tier" in updates) {
      updates.listing_tier = normalizeListingTier(updates.listing_tier, job.listing_tier || "standard_paid");
      updates.featured = updates.listing_tier === "featured" || updates.listing_tier === "sponsor";
    }
    if ("listing_opportunity_type" in updates) {
      updates.listing_opportunity_type = normalizeListingOpportunityType(
        updates.listing_opportunity_type,
        job.listing_opportunity_type || "job"
      );
    }
    if ("marketplace_opportunity_type" in req.body) {
      updates.listing_opportunity_type = normalizeListingOpportunityType(
        req.body.marketplace_opportunity_type,
        job.listing_opportunity_type || "job"
      );
    }
    if ("location_precision" in updates) {
      updates.location_precision = normalizeLocationPrecision(
        updates.location_precision,
        job.location_precision || "unknown"
      );
    }
    if ("saturday_schedule" in updates) {
      updates.saturday_schedule = normalizeSaturdaySchedule(updates.saturday_schedule);
    }
    if ("sign_on_bonus" in updates) {
      updates.sign_on_bonus = toNullableText(updates.sign_on_bonus);
    }
    if ("relocation_assistance" in updates) {
      updates.relocation_assistance = normalizeBoolean(updates.relocation_assistance, false);
    }
    if ("benefits" in updates) updates.benefits = toNullableText(updates.benefits);
    if ("ce_allowance" in updates) updates.ce_allowance = toNullableText(updates.ce_allowance);
    if ("student_loan_assistance" in updates) {
      updates.student_loan_assistance = normalizeBoolean(updates.student_loan_assistance, false);
    }
    const hasBenefitInput = [
      "benefit_flags",
      "sign_on_bonus",
      "signOnBonus",
      "relocation_assistance",
      "relocationAssistance",
      "ce_allowance",
      "ceAllowance",
      "student_loan_assistance",
      "studentLoanAssistance",
    ].some((field) => field in req.body);
    if (hasBenefitInput) {
      updates.benefit_flags = normalizeBenefitFlags([
        ...(toInputArray(req.body.benefit_flags) || []),
        ...benefitFlagsFromJobFields({ ...job, ...updates }),
      ]);
    }
    const nextRole = updates.role || job.role;

    const locationFieldsProvided = [
      "location",
      "city",
      "state",
      "location_mode",
      "locationMode",
      "additional_locations",
      "additionalLocations",
    ].some((field) => field in req.body);
    const nextLocationFields = locationFieldsProvided
      ? normalizeJobLocationFields({ ...job, ...req.body })
      : null;
    if (nextLocationFields) {
      updates.location = nextLocationFields.location;
      updates.city = nextLocationFields.city;
      updates.state = nextLocationFields.state;
      updates.location_mode = nextLocationFields.location_mode;
      updates.location_precision = nextLocationFields.location_precision;
      updates.additional_locations = nextLocationFields.additional_locations;
    }

    const locationChanged = nextLocationFields ? didLocationChange(nextLocationFields, job) : false;
    if (locationChanged && hasBeenPublished) {
      throw requestError(
        400,
        "Location is locked after publication. Create a new posting for a different location.",
        "location_locked"
      );
    }
    const coordinateFieldsProvided =
      Object.prototype.hasOwnProperty.call(req.body, "latitude") ||
      Object.prototype.hasOwnProperty.call(req.body, "longitude");
    if (locationChanged || coordinateFieldsProvided) {
      const coordinates = await resolveCoordinatesForJob(
        { ...job, ...req.body, ...(nextLocationFields || {}) },
        { required: true }
      );
      updates.latitude = coordinates?.latitude ?? null;
      updates.longitude = coordinates?.longitude ?? null;
    } else {
      delete updates.latitude;
      delete updates.longitude;
    }

    if ("opportunity_types" in req.body || "opportunity_type" in req.body || "role" in updates) {
      const opportunityTypes =
        nextRole === "optometrist"
          ? normalizeOpportunityTypes(req.body.opportunity_types ?? req.body.opportunity_type) || []
          : [];
      updates.opportunity_types = opportunityTypes;
      updates.opportunity_type = firstOrNull(opportunityTypes);
    } else if ("opportunity_type" in updates) {
      updates.opportunity_type = normalizeOpportunityType(updates.opportunity_type);
    }
    if ("practice_types" in req.body || "practice_type" in req.body) {
      const practiceTypes = normalizePracticeTypes(req.body.practice_types ?? req.body.practice_type);
      updates.practice_types = practiceTypes;
      updates.practice_type = firstOrNull(practiceTypes);
    }
    if ("practice_name" in updates) updates.practice_name = toNullableText(updates.practice_name);
    const hasEmploymentInput = "employment_types" in req.body || "employment_type" in req.body || "type" in req.body;
    const rawEmploymentType = req.body.employment_type ?? req.body.type;
    const legacyRemoteEmployment = hasEmploymentInput && isLegacyRemoteEmployment(rawEmploymentType);
    if (hasEmploymentInput) {
      const employmentTypes = normalizeEmploymentTypes(
        req.body.employment_types ??
          (legacyRemoteEmployment ? ["full_time"] : rawEmploymentType)
      ) || [];
      updates.employment_types = employmentTypes;
      updates.employment_type = firstOrNull(employmentTypes);
      updates.type = updates.employment_type;
    }
    const hasWorkArrangementInput =
      "work_arrangements" in req.body ||
      "work_arrangement" in req.body ||
      "onsite_type" in req.body ||
      legacyRemoteEmployment;
    if (hasWorkArrangementInput) {
      const workArrangements = normalizeWorkArrangements(
        req.body.work_arrangements ??
          req.body.work_arrangement ??
          req.body.onsite_type ??
          (legacyRemoteEmployment ? ["remote"] : undefined)
      ) || [];
      updates.work_arrangements = workArrangements;
      updates.work_arrangement = firstOrNull(workArrangements);
    } else if ("work_arrangement" in updates) {
      updates.work_arrangement = normalizeWorkArrangement(updates.work_arrangement);
    }

    const hasCompensationInput = [
      "compensation_type",
      "salary_min",
      "salary_max",
      "hourly_min",
      "hourly_max",
      "daily_rate",
      "compensation_notes",
      "salary",
    ].some((field) => field in req.body);
    if (hasCompensationInput) {
      Object.assign(updates, normalizeCompensation(req.body, job));
    }

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
    let practice_name = ("practice_name" in updates ? updates.practice_name : job.practice_name) ?? null;
    let status = job.status || "active";
    const preserveDraft = status === "draft";
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
          : preserveDraft
          ? "draft"
          : employer_brand_verified
          ? "active"
          : "pending_domain";
      } else {
        status = job.is_archived ? "archived" : preserveDraft ? "draft" : "active";
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
      updates.parent_company = employer_name;
      updates.employer_brand = employer_brand;
      const attribution = inferEmployerAttribution({
        parentCompany: employer_name,
        employerBrand: employer_brand,
        practiceName: practice_name || venue_name || null,
        employerName: employer_name,
        company: employer_name,
        title: updates.title || job.title,
        description: updates.description || job.description,
      });
      updates.practice_name =
        attribution.practiceName || practice_name || venue_name || (!employer_brand ? employer_name : null);
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
    const payment = await getRecruiterPostingPaymentState(data.id, { role: data.role });

    res.json({ ...data, payment });
  } catch (e) {
    if (e?.statusCode) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code });
    }
    console.error("Update job error:", e);
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.post("/:id/publish", requireAuth, requireJobManager, async (req, res) => {
  try {
    const jobId = req.params.id;
    const nowIso = new Date().toISOString();
    const job = await one("select * from public.jobs where id = $1", [jobId]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const role = normalizeRole(job.role, { required: true });
    if (await enforceRecruiterCanPost(req, res, jobId, role)) return;

    const ownerRecruiterId = job.recruiter_id || job.posted_by || req.user.id;
    const applyProfile = await getRecruiterApplyProfile(ownerRecruiterId);
    const applyDestination = resolveApplyDestination({
      body: req.body,
      existing: job,
      profile: applyProfile,
      forPublication: true,
    });
    const publishLocationFields = normalizeJobLocationFields({ ...job, ...req.body });
    const coordinates = await resolveCoordinatesForJob(
      { ...job, ...req.body, ...publishLocationFields },
      { required: true }
    );
    assertPublishableJobFields({ ...job, ...req.body }, applyDestination);
    const nextStatus =
      job.employer_brand && !job.employer_brand_verified ? "pending_domain" : "active";

    const update = buildUpdate(
      "public.jobs",
      {
        status: nextStatus,
        is_archived: false,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        external_apply_url: applyDestination.external_apply_url,
        application_email: applyDestination.application_email,
        last_activated_at: nextStatus === "active" ? nowIso : job.last_activated_at,
        first_activated_at:
          nextStatus === "active" ? job.first_activated_at ?? nowIso : job.first_activated_at,
        updated_at: nowIso,
      },
      "id = $10",
      [jobId]
    );
    const data = await one(update.text, update.params);
    const payment = await getRecruiterPostingPaymentState(data.id, { role: data.role });

    res.json({
      job: { ...data, payment },
      requiresVerification: nextStatus === "pending_domain",
      message:
        nextStatus === "pending_domain"
          ? "Brand postings require domain verification. We saved this as Pending Domain."
          : "Job published.",
    });
  } catch (e) {
    if (e?.statusCode) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code });
    }
    console.error("Publish job error:", e);
    res.status(500).json({ error: "Failed to publish job" });
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
    const role = normalizeRole(job.role, { required: true });
    if (await enforceRecruiterCanPost(req, res, jobId, role)) return;
    const ownerRecruiterId = job.recruiter_id || job.posted_by || req.user.id;
    const applyProfile = await getRecruiterApplyProfile(ownerRecruiterId);
    const applyDestination = resolveApplyDestination({
      existing: job,
      profile: applyProfile,
      forPublication: true,
    });
    const coordinates = await resolveCoordinatesForJob(job, { required: true });

    const update = buildUpdate(
      "public.jobs",
      {
        status: nextStatus,
        is_archived: false,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        external_apply_url: applyDestination.external_apply_url,
        application_email: applyDestination.application_email,
        archived_at: null,
        last_activated_at: now,
        first_activated_at: job.first_activated_at ?? now,
        updated_at: now,
      },
      "id = $11",
      [jobId]
    );
    const data = await one(update.text, update.params);

    res.json(data);
  } catch (e) {
    if (e?.statusCode) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code });
    }
    console.error("Unarchive job error:", e);
    res.status(500).json({ error: "Failed to unarchive job" });
  }
});

router.post("/:id/pause", requireAuth, requireJobManager, async (req, res) => {
  try {
    const jobId = req.params.id;
    const now = new Date();
    const job = await one("select * from public.jobs where id = $1", [jobId]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (job.is_archived || job.status === "archived") {
      return res.status(400).json({
        error: "Archived jobs cannot be paused. Unarchive the job first.",
        code: "archived_job_cannot_pause",
      });
    }

    if (job.status === "draft") {
      return res.status(400).json({
        error: "Draft jobs are not public yet and do not need to be paused.",
        code: "draft_job_cannot_pause",
      });
    }

    if (job.status === "paused") return res.json(job);

    const addSeconds =
      job.status === "active" && job.last_activated_at
        ? Math.max(0, Math.floor((now - new Date(job.last_activated_at)) / 1000))
        : 0;

    const update = buildUpdate(
      "public.jobs",
      {
        status: "paused",
        is_archived: false,
        total_active_seconds: (job.total_active_seconds ?? 0) + addSeconds,
        updated_at: now.toISOString(),
      },
      "id = $5",
      [jobId]
    );
    const data = await one(update.text, update.params);

    res.json(data);
  } catch (e) {
    console.error("Pause job error:", e);
    res.status(500).json({ error: "Failed to pause job" });
  }
});

router.post("/:id/resume", requireAuth, requireJobManager, async (req, res) => {
  try {
    const jobId = req.params.id;
    const nowIso = new Date().toISOString();
    const job = await one("select * from public.jobs where id = $1", [jobId]);

    if (!job || !canManageJob(req.user, job)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (job.is_archived || job.status === "archived") {
      return res.status(400).json({
        error: "Archived jobs must be unarchived before they can resume.",
        code: "archived_job_cannot_resume",
      });
    }

    const role = normalizeRole(job.role, { required: true });
    if (await enforceRecruiterCanPost(req, res, jobId, role)) return;

    const ownerRecruiterId = job.recruiter_id || job.posted_by || req.user.id;
    const applyProfile = await getRecruiterApplyProfile(ownerRecruiterId);
    const applyDestination = resolveApplyDestination({
      existing: job,
      profile: applyProfile,
      forPublication: true,
    });
    const coordinates = await resolveCoordinatesForJob(job, { required: true });
    const nextStatus =
      job.employer_brand && !job.employer_brand_verified ? "pending_domain" : "active";

    const update = buildUpdate(
      "public.jobs",
      {
        status: nextStatus,
        is_archived: false,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        external_apply_url: applyDestination.external_apply_url,
        application_email: applyDestination.application_email,
        last_activated_at: nextStatus === "active" ? nowIso : job.last_activated_at,
        first_activated_at:
          nextStatus === "active" ? job.first_activated_at ?? nowIso : job.first_activated_at,
        updated_at: nowIso,
      },
      "id = $10",
      [jobId]
    );
    const data = await one(update.text, update.params);

    res.json({
      job: data,
      requiresVerification: nextStatus === "pending_domain",
      message:
        nextStatus === "pending_domain"
          ? "Brand postings require domain verification. We saved this as Pending Domain."
          : "Job resumed.",
    });
  } catch (e) {
    if (e?.statusCode) {
      return res.status(e.statusCode).json({ error: e.message, code: e.code });
    }
    console.error("Resume job error:", e);
    res.status(500).json({ error: "Failed to resume job" });
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
      job.status === "active" && job.last_activated_at && !job.is_archived
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
