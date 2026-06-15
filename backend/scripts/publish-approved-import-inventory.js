const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, "../.env"));
loadEnvFile(path.resolve(__dirname, "../../.env"));
loadEnvFile(path.resolve(__dirname, "../../frontend/.env"));

const { pool, query, buildInsert } = require("../services/db");
const {
  isCountryToken,
  normalizeImportedLocationFields,
  resolveImportedJobCoordinates,
} = require("../services/jobLocationService");
const { inferEmployerAttribution } = require("../services/employerAttribution");

const EMPLOYER_ORDER = [
  {
    key: "walmart_vision_center",
    label: "Walmart Vision Center",
    pattern: "%walmart vision center%",
  },
  {
    key: "sams_club_optical",
    label: "Sam's Club Optical",
    pattern: "%sam's club optical%",
  },
  { key: "myeyedr", label: "MyEyeDr.", pattern: "%myeyedr%" },
  { key: "essilorluxottica", label: "EssilorLuxottica", pattern: "%essilorluxottica%" },
  { key: "national_vision", label: "National Vision", pattern: "%national vision%" },
  { key: "eyesouth", label: "EyeSouth", pattern: "%eyesouth%" },
  {
    key: "american_vision_partners",
    label: "American Vision Partners",
    pattern: "%american vision partners%",
  },
];
const EVERGREEN_AGE_DAYS = 180;

const ROLE_TAG_TO_JOB_ROLE = {
  optometrist: "optometrist",
  optician: "optician",
  ophthalmic_technician: "ophthalmic_technician",
  optical_sales: "optician",
  contact_lens_technician: "ophthalmic_technician",
  practice_manager: "practice_manager",
  front_desk: "front_desk",
};

const ROLE_BADGE_TO_JOB_ROLE = {
  OD: "optometrist",
  OPTICIAN: "optician",
  OPTICAL: "optician",
  TECH: "ophthalmic_technician",
  MANAGER: "practice_manager",
  FRONT_DESK: "front_desk",
};

const EMPLOYMENT_TYPE_MAP = {
  "full time": "full_time",
  "full-time": "full_time",
  full_time: "full_time",
  "part time": "part_time",
  "part-time": "part_time",
  part_time: "part_time",
  "per diem": "per_diem_fill_in",
  "per-diem": "per_diem_fill_in",
  per_diem: "per_diem_fill_in",
  per_diem_fill_in: "per_diem_fill_in",
  locum: "per_diem_fill_in",
};

function toText(value) {
  return String(value ?? "").trim();
}

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function selectedEmployers() {
  const only = toText(argValue("only") || argValue("employer"));
  if (!only) return EMPLOYER_ORDER;

  const selectedKeys = new Set(
    only
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  const selected = EMPLOYER_ORDER.filter(
    (employer) =>
      selectedKeys.has(employer.key.toLowerCase()) ||
      selectedKeys.has(employer.label.toLowerCase())
  );

  if (!selected.length) {
    throw new Error(`No matching employer configured for --only=${only}`);
  }
  return selected;
}

function isHttpUrl(value) {
  const text = toText(value);
  if (!text) return false;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizedJobFromRow(row = {}) {
  const parsed = row.normalized_job && typeof row.normalized_job === "object" ? row.normalized_job : {};
  return {
    ...parsed,
    title: toText(parsed.title || row.normalized_title || row.raw_title),
    company: toText(parsed.company || row.normalized_company || row.employer_name),
    parentCompany: toText(parsed.parentCompany || row.parent_company) || null,
    employerBrand: toText(parsed.employerBrand || row.employer_brand) || null,
    practiceName: toText(parsed.practiceName || row.practice_name) || null,
    location: toText(parsed.location || row.normalized_location || row.raw_location) || null,
    employmentType: toText(parsed.employmentType || row.normalized_employment_type) || null,
    compensation: toText(parsed.compensation || row.normalized_compensation) || null,
    description: toText(parsed.description || row.normalized_description || row.raw_description) || null,
    applyUrl: toText(parsed.applyUrl || row.normalized_apply_url || row.apply_url) || null,
    sourceUrl: toText(parsed.sourceUrl || row.normalized_source_url || row.source_url) || null,
    sourceType: toText(parsed.sourceType || row.normalized_source_type || row.source_type) || "unknown",
    industryTags: Array.isArray(parsed.industryTags) ? parsed.industryTags : row.industry_tags || [],
    roleTags: Array.isArray(parsed.roleTags) ? parsed.roleTags : row.role_tags || [],
    listingTier: toText(parsed.listingTier || row.listing_tier) || "imported",
    listingOpportunityType:
      toText(parsed.listingOpportunityType || row.listing_opportunity_type) || "job",
    locationPrecision: "city",
    recommendation: toText(parsed.recommendation || row.recommendation).toLowerCase() || null,
    roleBadge: toText(parsed.roleBadge || row.role_badge).toUpperCase() || "UNKNOWN",
  };
}

function normalizeEmploymentType(value) {
  const key = toText(value).toLowerCase().replace(/\s+/g, " ");
  return EMPLOYMENT_TYPE_MAP[key] || EMPLOYMENT_TYPE_MAP[key.replace(/-/g, " ")] || null;
}

function roleFromImport(normalizedJob) {
  const badgeRole = ROLE_BADGE_TO_JOB_ROLE[toText(normalizedJob.roleBadge).toUpperCase()];
  if (badgeRole) return badgeRole;

  for (const tag of normalizedJob.roleTags || []) {
    const role = ROLE_TAG_TO_JOB_ROLE[toText(tag)];
    if (role) return role;
  }
  return ROLE_BADGE_TO_JOB_ROLE[normalizedJob.roleBadge] || "other";
}

function tagIdsFromImport(normalizedJob) {
  return Array.from(
    new Set([...(normalizedJob.industryTags || []), ...(normalizedJob.roleTags || [])])
  ).filter(Boolean);
}

function validCityState(location) {
  return Boolean(location.city && location.state && !isCountryToken(location.state));
}

function geocodeCacheKey(location) {
  return `${toText(location.city).toLowerCase()}|${toText(location.state).toLowerCase()}`;
}

async function loadCandidates(pattern) {
  const result = await query(
    `
      select *
      from public.job_imports
      where status in ('discovered', 'needs_review')
        and published_job_id is null
        and coalesce(evergreen, false) = false
        and (source_posting_age_days is null or source_posting_age_days <= ${EVERGREEN_AGE_DAYS})
        and recommendation = 'approve'
        and lower(employer_name) like lower($1)
      order by discovered_at asc, created_at asc
    `,
    [pattern]
  );
  return result.rows || [];
}

async function duplicateActiveImportedJob(normalizedJob) {
  const result = await query(
    `
      select id
      from public.jobs
      where listing_source = 'imported'
        and is_archived = false
        and (
          ($1::text is not null and external_apply_url = $1)
          or ($2::text is not null and source_url = $2)
        )
      limit 1
    `,
    [normalizedJob.applyUrl || null, normalizedJob.sourceUrl || null]
  );
  return result.rows?.[0]?.id || null;
}

async function publishImport(row, normalizedJob, location, coordinates) {
  const now = new Date().toISOString();
  const employmentType = normalizeEmploymentType(normalizedJob.employmentType);
  const attribution = inferEmployerAttribution({
    parentCompany: normalizedJob.parentCompany || row.parent_company,
    employerName: row.employer_name,
    employerBrand: normalizedJob.employerBrand || row.employer_brand,
    practiceName: normalizedJob.practiceName || row.practice_name,
    company: normalizedJob.company,
    title: normalizedJob.title,
    description: normalizedJob.description,
    sourceUrl: normalizedJob.sourceUrl,
    applyUrl: normalizedJob.applyUrl,
  });
  const jobPayload = {
    title: normalizedJob.title,
    description: normalizedJob.description,
    company: attribution.parentCompany || normalizedJob.company,
    employer_name: attribution.parentCompany || normalizedJob.company,
    parent_company: attribution.parentCompany || normalizedJob.company,
    employer_brand: attribution.employerBrand,
    practice_name: attribution.practiceName,
    location: location.location,
    city: location.city,
    state: location.state,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    role: roleFromImport(normalizedJob),
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
    posted_by: null,
    listing_source: "imported",
    listing_tier: "imported",
    listing_opportunity_type: normalizedJob.listingOpportunityType || "job",
    location_precision: "city",
    featured: false,
    is_archived: false,
    status: "active",
    source: "discovery",
    seed_batch: null,
    external_apply_url: normalizedJob.applyUrl,
    source_url: normalizedJob.sourceUrl,
    posted_at: now,
    updated_at: now,
  };

  const updatedNormalizedJob = {
    ...normalizedJob,
    location: location.location,
    city: location.city,
    state: location.state,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    locationPrecision: "city",
    parentCompany: attribution.parentCompany,
    employerBrand: attribution.employerBrand,
    practiceName: attribution.practiceName,
  };

  const client = await pool.connect();
  try {
    await client.query("begin");
    const insert = buildInsert("public.jobs", jobPayload);
    const inserted = await client.query(insert.text, insert.params);
    const job = inserted.rows[0];

    await client.query(
      `
        update public.job_imports
        set
          status = 'published',
          normalized_location = $1,
          normalized_job = $2::jsonb,
          parent_company = $3,
          employer_brand = $4,
          practice_name = $5,
          location_precision = 'city',
          published_job_id = $6,
          reviewed_at = now(),
          review_action = 'publish',
          review_source = 'batch',
          updated_at = now()
        where id = $7
      `,
      [
        location.location,
        JSON.stringify(updatedNormalizedJob),
        updatedNormalizedJob.parentCompany || null,
        updatedNormalizedJob.employerBrand || null,
        updatedNormalizedJob.practiceName || null,
        job.id,
        row.id,
      ]
    );

    await client.query("commit");
    return job;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const geocodeCache = new Map();
  const summary = {
    employers: [],
    published: 0,
    skipped: 0,
    failed: 0,
  };

  for (const employer of selectedEmployers()) {
    const rows = await loadCandidates(employer.pattern);
    const employerSummary = {
      employer: employer.label,
      candidates: rows.length,
      validApplyUrls: 0,
      validCityState: 0,
      geocoded: 0,
      published: 0,
      skipped: 0,
      failed: 0,
      skipReasons: {},
      failures: [],
    };

    for (const row of rows) {
      const normalizedJob = normalizedJobFromRow(row);

      if (!normalizedJob.title || !normalizedJob.company) {
        employerSummary.skipped += 1;
        employerSummary.skipReasons.missing_title_or_company =
          (employerSummary.skipReasons.missing_title_or_company || 0) + 1;
        continue;
      }

      if (!isHttpUrl(normalizedJob.applyUrl)) {
        employerSummary.skipped += 1;
        employerSummary.skipReasons.missing_apply_url =
          (employerSummary.skipReasons.missing_apply_url || 0) + 1;
        continue;
      }
      employerSummary.validApplyUrls += 1;

      if (["UNKNOWN", "OTHER", "OMD"].includes(normalizedJob.roleBadge)) {
        employerSummary.skipped += 1;
        employerSummary.skipReasons.rejected_role_badge =
          (employerSummary.skipReasons.rejected_role_badge || 0) + 1;
        continue;
      }

      const location = normalizeImportedLocationFields({
        location: normalizedJob.location,
        city: row.normalized_job?.city,
        state: row.normalized_job?.state,
      });

      if (!validCityState(location)) {
        employerSummary.skipped += 1;
        employerSummary.skipReasons.invalid_city_state =
          (employerSummary.skipReasons.invalid_city_state || 0) + 1;
        continue;
      }
      employerSummary.validCityState += 1;

      const duplicateJobId = await duplicateActiveImportedJob(normalizedJob);
      if (duplicateJobId) {
        employerSummary.skipped += 1;
        employerSummary.skipReasons.duplicate_active_job =
          (employerSummary.skipReasons.duplicate_active_job || 0) + 1;
        continue;
      }

      let coordinates = geocodeCache.get(geocodeCacheKey(location));
      if (!coordinates) {
        try {
          coordinates = await resolveImportedJobCoordinates(
            {
              location: location.geocodeAddress || location.location,
              geocodeAddress: location.geocodeAddress || null,
              city: location.city,
              state: location.state,
            },
            { required: true }
          );
          geocodeCache.set(geocodeCacheKey(location), coordinates);
        } catch (error) {
          employerSummary.skipped += 1;
          employerSummary.skipReasons.geocode_failed =
            (employerSummary.skipReasons.geocode_failed || 0) + 1;
          employerSummary.failures.push({
            id: row.id,
            title: normalizedJob.title,
            location: location.location,
            error: error?.message || "Geocode failed.",
          });
          continue;
        }
      }
      employerSummary.geocoded += 1;

      try {
        await publishImport(row, normalizedJob, location, coordinates);
        employerSummary.published += 1;
      } catch (error) {
        employerSummary.failed += 1;
        employerSummary.failures.push({
          id: row.id,
          title: normalizedJob.title,
          location: location.location,
          error: error?.message || "Publish failed.",
        });
      }
    }

    summary.published += employerSummary.published;
    summary.skipped += employerSummary.skipped;
    summary.failed += employerSummary.failed;
    employerSummary.failures = employerSummary.failures.slice(0, 10);
    summary.employers.push(employerSummary);
  }

  console.log(JSON.stringify(summary, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
