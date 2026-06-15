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
  coordinateFrom,
  isCountryToken,
  normalizeImportedLocationFields,
  resolveImportedJobCoordinates,
} = require("../services/jobLocationService");
const { inferEmployerAttribution } = require("../services/employerAttribution");

const EVERGREEN_AGE_DAYS = 180;

const SOURCES = [
  {
    key: "visionworks",
    label: "VisionWorks",
    discoveredBy: "script:visionworks-dayforce-full-acquisition",
    brandedOnly: false,
  },
  {
    key: "eyecare_partners",
    label: "EyeCare Partners",
    discoveredBy: "script:eyecare-partners-full-acquisition",
    brandedOnly: true,
  },
];

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

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function increment(object, key, amount = 1) {
  const safeKey = key || "unknown";
  object[safeKey] = (object[safeKey] || 0) + amount;
}

function selectedSources() {
  const only = toText(argValue("only") || argValue("source"));
  if (!only) return SOURCES;

  const selectedKeys = new Set(
    only
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

  const selected = SOURCES.filter(
    (source) =>
      selectedKeys.has(source.key.toLowerCase()) ||
      selectedKeys.has(source.label.toLowerCase())
  );

  if (!selected.length) throw new Error(`No matching source configured for --only=${only}`);
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
    locationPrecision: toText(parsed.locationPrecision || row.location_precision) || "city",
    recommendation: toText(parsed.recommendation || row.recommendation).toLowerCase() || null,
    roleBadge: toText(parsed.roleBadge || row.role_badge).toUpperCase() || "UNKNOWN",
    latitude: parsed.latitude ?? null,
    longitude: parsed.longitude ?? null,
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
  return "other";
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

function coordinatePairFromJob(job = {}) {
  const hasLatitude = job.latitude !== null && job.latitude !== undefined && job.latitude !== "";
  const hasLongitude = job.longitude !== null && job.longitude !== undefined && job.longitude !== "";
  if (!hasLatitude || !hasLongitude) return null;

  try {
    return {
      latitude: coordinateFrom(job.latitude, "latitude", -90, 90),
      longitude: coordinateFrom(job.longitude, "longitude", -180, 180),
    };
  } catch {
    return null;
  }
}

function isGenericEyeCarePartners(value) {
  return /^eye\s*care\s*partners\.?$/i.test(toText(value));
}

function localEyeCareBrand(row, normalizedJob) {
  const candidates = [
    normalizedJob.employerBrand,
    row.employer_brand,
    normalizedJob.practiceName,
    row.practice_name,
    normalizedJob.company,
    row.normalized_company,
    row.employer_name,
  ];

  for (const candidate of candidates) {
    const text = toText(candidate);
    if (text && !isGenericEyeCarePartners(text)) return text;
  }
  return null;
}

function prepareNormalizedJob(source, row, normalizedJob) {
  if (!source.brandedOnly) return { normalizedJob, localBrand: null };

  const localBrand = localEyeCareBrand(row, normalizedJob);
  if (!localBrand) return { normalizedJob, localBrand: null };

  return {
    localBrand,
    normalizedJob: {
      ...normalizedJob,
      parentCompany: "EyeCare Partners",
      employerBrand: localBrand,
      practiceName: isGenericEyeCarePartners(normalizedJob.practiceName)
        ? localBrand
        : normalizedJob.practiceName || localBrand,
    },
  };
}

async function loadCandidates(source) {
  const result = await query(
    `
      select *
      from public.job_imports
      where discovered_by = $1
        and status in ('discovered', 'needs_review')
        and published_job_id is null
        and coalesce(evergreen, false) = false
        and (source_posting_age_days is null or source_posting_age_days <= $2)
        and recommendation = 'approve'
      order by discovered_at asc, created_at asc
    `,
    [source.discoveredBy, EVERGREEN_AGE_DAYS]
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
    parent_company: attribution.parentCompany || normalizedJob.parentCompany || normalizedJob.company,
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

async function activeCounts() {
  const result = await query(`
    select
      count(*) filter (where status = 'active' and is_archived = false) as active_jobs,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and latitude is not null
          and longitude is not null
      ) as map_visible_jobs,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and (
            employer_brand ilike '%visionworks%'
            or company ilike '%visionworks%'
            or employer_name ilike '%visionworks%'
          )
      ) as active_visionworks,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and (
            employer_brand ilike '%visionworks%'
            or company ilike '%visionworks%'
            or employer_name ilike '%visionworks%'
          )
          and latitude is not null
          and longitude is not null
      ) as map_visionworks,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and parent_company = 'EyeCare Partners'
      ) as active_eyecare_partners,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and parent_company = 'EyeCare Partners'
          and latitude is not null
          and longitude is not null
      ) as map_eyecare_partners
    from public.jobs
  `);

  const row = result.rows?.[0] || {};
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value || 0)])
  );
}

async function eyeCareBrandCounts() {
  const result = await query(`
    select
      coalesce(nullif(employer_brand, ''), nullif(practice_name, ''), nullif(company, ''), 'Unknown') as display_brand,
      count(*)::int as count
    from public.jobs
    where status = 'active'
      and is_archived = false
      and parent_company = 'EyeCare Partners'
    group by 1
    order by count desc, display_brand asc
    limit 50
  `);
  return result.rows || [];
}

async function runSource(source, { apply, geocodeCache }) {
  const rows = await loadCandidates(source);
  const sourceSummary = {
    source: source.label,
    candidates: rows.length,
    validApplyUrls: 0,
    validCityState: 0,
    geocoded: 0,
    publishable: 0,
    published: 0,
    held: 0,
    skipped: 0,
    failed: 0,
    skipReasons: {},
    failures: [],
  };

  for (const row of rows) {
    const baseNormalizedJob = normalizedJobFromRow(row);
    const prepared = prepareNormalizedJob(source, row, baseNormalizedJob);
    const normalizedJob = prepared.normalizedJob;

    if (source.brandedOnly && !prepared.localBrand) {
      sourceSummary.held += 1;
      increment(sourceSummary.skipReasons, "generic_brand_held");
      continue;
    }

    if (!normalizedJob.title || !normalizedJob.company) {
      sourceSummary.skipped += 1;
      increment(sourceSummary.skipReasons, "missing_title_or_company");
      continue;
    }

    if (!isHttpUrl(normalizedJob.applyUrl)) {
      sourceSummary.skipped += 1;
      increment(sourceSummary.skipReasons, "missing_apply_url");
      continue;
    }
    sourceSummary.validApplyUrls += 1;

    if (["UNKNOWN", "OTHER", "OMD"].includes(normalizedJob.roleBadge)) {
      sourceSummary.skipped += 1;
      increment(sourceSummary.skipReasons, "rejected_role_badge");
      continue;
    }

    const location = normalizeImportedLocationFields({
      location: normalizedJob.location,
      city: row.normalized_job?.city,
      state: row.normalized_job?.state,
    });

    if (!validCityState(location)) {
      sourceSummary.skipped += 1;
      increment(sourceSummary.skipReasons, "invalid_city_state");
      continue;
    }
    sourceSummary.validCityState += 1;

    const duplicateJobId = await duplicateActiveImportedJob(normalizedJob);
    if (duplicateJobId) {
      sourceSummary.skipped += 1;
      increment(sourceSummary.skipReasons, "duplicate_active_job");
      continue;
    }

    let coordinates =
      coordinatePairFromJob(normalizedJob) ||
      coordinatePairFromJob(row.normalized_job) ||
      geocodeCache.get(geocodeCacheKey(location));

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
        sourceSummary.skipped += 1;
        increment(sourceSummary.skipReasons, "geocode_failed");
        sourceSummary.failures.push({
          id: row.id,
          title: normalizedJob.title,
          location: location.location,
          error: error?.message || "Geocode failed.",
        });
        continue;
      }
    }
    sourceSummary.geocoded += 1;
    sourceSummary.publishable += 1;

    if (!apply) continue;

    try {
      await publishImport(row, normalizedJob, location, coordinates);
      sourceSummary.published += 1;
    } catch (error) {
      sourceSummary.failed += 1;
      sourceSummary.failures.push({
        id: row.id,
        title: normalizedJob.title,
        location: location.location,
        error: error?.message || "Publish failed.",
      });
    }
  }

  sourceSummary.failures = sourceSummary.failures.slice(0, 10);
  return sourceSummary;
}

async function run() {
  const apply = hasFlag("apply");
  const geocodeCache = new Map();
  const before = await activeCounts();
  const sources = [];

  for (const source of selectedSources()) {
    sources.push(await runSource(source, { apply, geocodeCache }));
  }

  const after = await activeCounts();
  const summary = {
    mode: apply ? "apply" : "dry-run",
    before,
    after,
    added: {
      activeJobs: after.active_jobs - before.active_jobs,
      mapVisibleJobs: after.map_visible_jobs - before.map_visible_jobs,
      activeVisionWorks: after.active_visionworks - before.active_visionworks,
      mapVisionWorks: after.map_visionworks - before.map_visionworks,
      activeEyeCarePartners: after.active_eyecare_partners - before.active_eyecare_partners,
      mapEyeCarePartners: after.map_eyecare_partners - before.map_eyecare_partners,
    },
    sources,
    eyeCareBrandCounts: await eyeCareBrandCounts(),
  };

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
