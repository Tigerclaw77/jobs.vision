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
  isCountryToken,
  normalizeImportedLocationFields,
  resolveImportedJobCoordinates,
} = require("../services/jobLocationService");

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const dryRun = process.argv.includes("--dry-run");
const limit = Math.min(1000, Math.max(1, Number(argValue("limit", 1000)) || 1000));

function hasCoordinatePair(job) {
  if (job.latitude == null || job.latitude === "" || job.longitude == null || job.longitude === "") {
    return false;
  }
  return Number.isFinite(Number(job.latitude)) && Number.isFinite(Number(job.longitude));
}

function isMalformedLocation(job) {
  return String(job.city || "").includes(",") || isCountryToken(job.state);
}

async function loadJobs() {
  const result = await query(
    `
      select id, title, company, location, city, state, latitude, longitude, location_precision
      from public.jobs
      where status = 'active'
        and is_archived = false
        and listing_source = 'imported'
        and (
          latitude is null
          or longitude is null
          or city like '%,%'
          or lower(coalesce(state, '')) in ('us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america')
        )
      order by created_at desc
      limit $1
    `,
    [limit]
  );

  return result.rows || [];
}

async function updateJob(job, normalized, coordinates = null) {
  if (dryRun) return;

  await query(
    `
      update public.jobs
      set
        location = $1,
        city = $2,
        state = $3,
        latitude = coalesce($4, latitude),
        longitude = coalesce($5, longitude),
        location_precision = case
          when $4 is not null and $5 is not null then 'city'
          else location_precision
        end,
        updated_at = now()
      where id = $6
    `,
    [
      normalized.location,
      normalized.city,
      normalized.state,
      coordinates?.latitude ?? null,
      coordinates?.longitude ?? null,
      job.id,
    ]
  );
}

async function main() {
  const jobs = await loadJobs();
  const geocodeCache = new Map();
  const failures = [];
  const repairedLocations = [];
  const geocodedJobs = [];
  let updated = 0;
  let skipped = 0;

  for (const job of jobs) {
    const normalized = normalizeImportedLocationFields(job);
    const needsLocationRepair =
      isMalformedLocation(job) ||
      job.location !== normalized.location ||
      job.city !== normalized.city ||
      job.state !== normalized.state;
    const needsGeocoding = !hasCoordinatePair(job);

    if (!normalized.location) {
      skipped += 1;
      failures.push({
        id: job.id,
        title: job.title,
        location: job.location,
        error: "Missing location.",
      });
      continue;
    }

    let coordinates = null;
    try {
      if (needsGeocoding) {
        const cacheKey = `${String(normalized.city || "").toLowerCase()}|${String(
          normalized.state || ""
        ).toLowerCase()}`;
        if (geocodeCache.has(cacheKey)) {
          coordinates = geocodeCache.get(cacheKey);
        } else {
          coordinates = await resolveImportedJobCoordinates({
            location: normalized.location,
            city: normalized.city,
            state: normalized.state,
          });
          geocodeCache.set(cacheKey, coordinates);
        }

        if (!coordinates) {
          throw new Error("No geocode result.");
        }
      }

      await updateJob(job, normalized, coordinates);
      updated += 1;
      if (needsLocationRepair) {
        repairedLocations.push({
          id: job.id,
          title: job.title,
          before: { location: job.location, city: job.city, state: job.state },
          after: { location: normalized.location, city: normalized.city, state: normalized.state },
        });
      }
      if (coordinates) {
        geocodedJobs.push({
          id: job.id,
          title: job.title,
          location: normalized.location,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        });
      }
    } catch (error) {
      if (needsLocationRepair) {
        await updateJob(job, normalized, null);
        updated += 1;
        repairedLocations.push({
          id: job.id,
          title: job.title,
          before: { location: job.location, city: job.city, state: job.state },
          after: { location: normalized.location, city: normalized.city, state: normalized.state },
        });
      }

      failures.push({
        id: job.id,
        title: job.title,
        location: job.location,
        normalizedLocation: normalized.location,
        error: error?.message || "Geocoding failed.",
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: jobs.length,
        updated,
        locationsRepaired: repairedLocations.length,
        geocodingSuccesses: geocodedJobs.length,
        skipped,
        failed: failures.length,
        repairedLocations: repairedLocations.slice(0, 25),
        geocodedJobs: geocodedJobs.slice(0, 25),
        failures: failures.slice(0, 25),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
