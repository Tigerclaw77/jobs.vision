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

const { pool, query } = require("../services/db");
const {
  coordinateFrom,
  isCountryToken,
  normalizeImportedLocationFields,
  resolveImportedJobCoordinates,
} = require("../services/jobLocationService");

const EVERGREEN_AGE_DAYS = 180;

const SOURCES = [
  {
    key: "visionworks",
    label: "VisionWorks",
    discoveredBy: "script:visionworks-dayforce-full-acquisition",
  },
  {
    key: "eyecare_partners",
    label: "EyeCare Partners",
    discoveredBy: "script:eyecare-partners-full-acquisition",
  },
];

function toText(value) {
  return String(value ?? "").trim();
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
  const normalized = row.normalized_job && typeof row.normalized_job === "object" ? row.normalized_job : {};
  return {
    ...normalized,
    title: toText(normalized.title || row.normalized_title || row.raw_title),
    company: toText(normalized.company || row.normalized_company || row.employer_name),
    location: toText(normalized.location || row.normalized_location || row.raw_location),
    applyUrl: toText(normalized.applyUrl || row.normalized_apply_url || row.apply_url),
    sourceUrl: toText(normalized.sourceUrl || row.normalized_source_url || row.source_url),
    recommendation: toText(normalized.recommendation || row.recommendation).toLowerCase(),
    roleBadge: toText(normalized.roleBadge || row.role_badge).toUpperCase(),
    sourcePostingAgeDays:
      Number.isInteger(normalized.sourcePostingAgeDays)
        ? normalized.sourcePostingAgeDays
        : Number.isInteger(row.source_posting_age_days)
          ? row.source_posting_age_days
          : null,
  };
}

function freshnessBucket(ageDays) {
  if (!Number.isInteger(ageDays)) return "unknown";
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  if (ageDays <= 180) return "91-180";
  return "180+";
}

function increment(object, key, amount = 1) {
  const safeKey = key || "unknown";
  object[safeKey] = (object[safeKey] || 0) + amount;
}

function emptyFreshness() {
  return {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "91-180": 0,
    "180+": 0,
    unknown: 0,
  };
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

function validCityState(location) {
  return Boolean(location.city && location.state && !isCountryToken(location.state));
}

function cacheKey(location) {
  return `${toText(location.city).toLowerCase()}|${toText(location.state).toLowerCase()}`;
}

async function loadRows(discoveredBy) {
  const result = await query(
    `
      select *
      from public.job_imports
      where discovered_by = $1
      order by created_at asc
    `,
    [discoveredBy]
  );
  return result.rows || [];
}

async function activePublicDuplicate(row, normalizedJob) {
  const result = await query(
    `
      select id
      from public.jobs
      where is_archived = false
        and (
          ($1::text is not null and external_apply_url = $1)
          or ($2::text is not null and source_url = $2)
        )
      limit 1
    `,
    [normalizedJob.applyUrl || row.apply_url || null, normalizedJob.sourceUrl || row.source_url || null]
  );
  return result.rows?.[0]?.id || null;
}

async function updateImportLocation(row, normalizedJob, location, coordinates) {
  const next = {
    ...normalizedJob,
    location: location.location,
    city: location.city,
    state: location.state,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    locationPrecision: "city",
  };

  await query(
    `
      update public.job_imports
      set
        normalized_location = $1,
        normalized_job = $2::jsonb,
        location_precision = 'city',
        updated_at = now()
      where id = $3
    `,
    [location.location, JSON.stringify(next), row.id]
  );
}

async function auditSource(source, geocodeCache) {
  const rows = await loadRows(source.discoveredBy);
  const summary = {
    label: source.label,
    discoveredBy: source.discoveredBy,
    imported: rows.length,
    status: {},
    classifier: { approve: 0, reject: 0, review: 0, unknown: 0 },
    freshness: emptyFreshness(),
    duplicates: {
      activePublic: 0,
      duplicateKeysInImportSet: 0,
    },
    geocode: {
      validCityState: 0,
      successful: 0,
      failed: 0,
      existingCoordinates: 0,
      resolvedCoordinates: 0,
      updatedRows: 0,
    },
    readiness: {
      publishableNow: 0,
      evergreen: 0,
      reviewRequired: 0,
      blocked: 0,
      blockedReasons: {},
    },
  };

  const duplicateKeyCounts = new Map();
  for (const row of rows) {
    if (!row.duplicate_key) continue;
    duplicateKeyCounts.set(row.duplicate_key, (duplicateKeyCounts.get(row.duplicate_key) || 0) + 1);
  }
  summary.duplicates.duplicateKeysInImportSet = Array.from(duplicateKeyCounts.values()).filter((count) => count > 1).length;

  for (const row of rows) {
    const normalizedJob = normalizedJobFromRow(row);
    increment(summary.status, row.status || "unknown");
    increment(summary.classifier, normalizedJob.recommendation || "unknown");
    increment(summary.freshness, freshnessBucket(normalizedJob.sourcePostingAgeDays));

    const isEvergreen =
      row.status === "evergreen" ||
      row.evergreen === true ||
      (Number.isInteger(normalizedJob.sourcePostingAgeDays) && normalizedJob.sourcePostingAgeDays > EVERGREEN_AGE_DAYS);

    const location = normalizeImportedLocationFields({
      location: normalizedJob.location || row.normalized_location || row.raw_location,
      city: normalizedJob.city,
      state: normalizedJob.state,
    });

    if (validCityState(location)) {
      summary.geocode.validCityState += 1;
    }

    const duplicateJobId = await activePublicDuplicate(row, normalizedJob);
    if (duplicateJobId) {
      summary.duplicates.activePublic += 1;
    }

    let coordinates = null;
    if (validCityState(location)) {
      coordinates = coordinatePairFromJob(normalizedJob);
      if (coordinates) {
        summary.geocode.existingCoordinates += 1;
      } else if (geocodeCache.has(cacheKey(location))) {
        coordinates = geocodeCache.get(cacheKey(location));
        if (coordinates) summary.geocode.resolvedCoordinates += 1;
      } else {
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
          geocodeCache.set(cacheKey(location), coordinates);
          summary.geocode.resolvedCoordinates += 1;
        } catch {
          geocodeCache.set(cacheKey(location), null);
          coordinates = null;
        }
      }
    }

    if (coordinates) {
      summary.geocode.successful += 1;
      const needsUpdate =
        !coordinatePairFromJob(normalizedJob) ||
        normalizedJob.location !== location.location ||
        normalizedJob.city !== location.city ||
        normalizedJob.state !== location.state;
      if (needsUpdate) {
        await updateImportLocation(row, normalizedJob, location, coordinates);
        summary.geocode.updatedRows += 1;
      }
    } else {
      summary.geocode.failed += 1;
    }

    if (isEvergreen) {
      summary.readiness.evergreen += 1;
      continue;
    }

    if (normalizedJob.recommendation === "review") {
      summary.readiness.reviewRequired += 1;
      continue;
    }

    const blockedReasons = [];
    if (normalizedJob.recommendation === "reject") blockedReasons.push("rejected");
    if (!isHttpUrl(normalizedJob.applyUrl)) blockedReasons.push("invalid_apply_url");
    if (!validCityState(location)) blockedReasons.push("invalid_city_state");
    if (duplicateJobId) blockedReasons.push("duplicate_active_public_job");
    if (!coordinates && validCityState(location)) blockedReasons.push("geocode_failed");

    if (blockedReasons.length) {
      summary.readiness.blocked += 1;
      for (const reason of blockedReasons) increment(summary.readiness.blockedReasons, reason);
    } else if (normalizedJob.recommendation === "approve") {
      summary.readiness.publishableNow += 1;
    } else {
      summary.readiness.reviewRequired += 1;
    }
  }

  return summary;
}

async function main() {
  const geocodeCache = new Map();
  const reports = [];
  for (const source of SOURCES) {
    reports.push(await auditSource(source, geocodeCache));
  }

  console.log(JSON.stringify({ sources: reports }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
