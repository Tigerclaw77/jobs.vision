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

async function main() {
  const result = await query(`
    select
      count(*) filter (where status = 'active' and is_archived = false)::int as active_jobs,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and latitude is not null
          and longitude is not null
      )::int as map_visible_jobs,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and listing_source = 'imported'
      )::int as active_imported_jobs,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and listing_source = 'imported'
          and latitude is not null
          and longitude is not null
      )::int as map_visible_imported_jobs,
      count(*) filter (
        where status = 'active'
          and is_archived = false
          and listing_source = 'imported'
          and (latitude is null or longitude is null)
      )::int as active_imported_missing_coordinates
    from public.jobs
  `);

  const imports = await query(`
    select
      count(*) filter (
        where coalesce(evergreen, false) = true
           or status = 'evergreen'
      )::int as evergreen_imports,
      count(*) filter (
        where recommendation = 'approve'
          and status in ('discovered', 'needs_review')
          and coalesce(evergreen, false) = false
          and published_job_id is null
      )::int as approved_unpublished_imports,
      count(*) filter (
        where status = 'published'
          or published_job_id is not null
      )::int as published_imports
    from public.job_imports
  `);

  console.log(
    JSON.stringify(
      {
        ...result.rows[0],
        ...imports.rows[0],
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
