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
const { inferEmployerAttribution } = require("../services/employerAttribution");

const REPORT_BRANDS = [
  "LensCrafters",
  "Target Optical",
  "Pearle Vision",
  "For Eyes",
  "America's Best",
  "Eyeglass World",
  "Costco Optical",
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function changed(current, next) {
  return cleanText(current) !== cleanText(next);
}

async function ensureSchema() {
  await query("alter table public.jobs add column if not exists parent_company text");
  await query("alter table public.jobs add column if not exists practice_name text");
  await query("alter table public.job_imports add column if not exists parent_company text");
  await query("alter table public.job_imports add column if not exists employer_brand text");
  await query("alter table public.job_imports add column if not exists practice_name text");
  await query("create index if not exists jobs_parent_company_idx on public.jobs (parent_company)");
  await query("create index if not exists jobs_employer_brand_idx on public.jobs (employer_brand)");
  await query("create index if not exists jobs_practice_name_idx on public.jobs (practice_name)");
  await query("create index if not exists job_imports_parent_company_idx on public.job_imports (parent_company)");
  await query("create index if not exists job_imports_employer_brand_idx on public.job_imports (employer_brand)");
  await query("create index if not exists job_imports_practice_name_idx on public.job_imports (practice_name)");
}

async function loadJobs() {
  const result = await query(`
    select
      id,
      title,
      description,
      company,
      employer_name,
      parent_company,
      employer_brand,
      practice_name,
      venue_name,
      external_apply_url,
      source_url
    from public.jobs
  `);
  return result.rows || [];
}

async function loadImports() {
  const result = await query(`
    select
      id,
      employer_name,
      parent_company,
      employer_brand,
      practice_name,
      raw_title,
      raw_description,
      source_url,
      apply_url,
      normalized_title,
      normalized_company,
      normalized_description,
      normalized_apply_url,
      normalized_source_url,
      normalized_job
    from public.job_imports
  `);
  return result.rows || [];
}

async function backfillJobs() {
  const jobs = await loadJobs();
  let updated = 0;
  let parentCompanyUpdated = 0;
  let brandUpdated = 0;
  let practiceUpdated = 0;

  for (const job of jobs) {
    const attribution = inferEmployerAttribution({
      parentCompany: job.parent_company,
      employerName: job.employer_name,
      employerBrand: job.employer_brand,
      practiceName: job.practice_name,
      venueName: job.venue_name,
      company: job.company,
      title: job.title,
      description: job.description,
      sourceUrl: job.source_url,
      applyUrl: job.external_apply_url,
    });

    const nextParentCompany =
      attribution.parentCompany || job.parent_company || job.employer_name || job.company || null;
    const nextEmployerBrand = attribution.employerBrand || job.employer_brand || null;
    const nextPracticeName = attribution.practiceName || job.practice_name || null;

    const shouldUpdateParent = nextParentCompany && changed(job.parent_company, nextParentCompany);
    const shouldUpdateBrand = nextEmployerBrand && changed(job.employer_brand, nextEmployerBrand);
    const shouldUpdatePractice = nextPracticeName && changed(job.practice_name, nextPracticeName);

    if (!shouldUpdateParent && !shouldUpdateBrand && !shouldUpdatePractice) continue;

    await query(
      `
        update public.jobs
        set parent_company = coalesce($2, parent_company),
            employer_brand = coalesce($3, employer_brand),
            practice_name = coalesce($4, practice_name),
            updated_at = now()
        where id = $1
      `,
      [job.id, nextParentCompany, nextEmployerBrand, nextPracticeName]
    );

    updated += 1;
    if (shouldUpdateParent) parentCompanyUpdated += 1;
    if (shouldUpdateBrand) brandUpdated += 1;
    if (shouldUpdatePractice) practiceUpdated += 1;
  }

  return {
    scanned: jobs.length,
    updated,
    parentCompanyUpdated,
    brandUpdated,
    practiceUpdated,
  };
}

async function backfillImports() {
  const imports = await loadImports();
  let updated = 0;
  let parentCompanyUpdated = 0;
  let brandUpdated = 0;
  let practiceUpdated = 0;

  for (const item of imports) {
    const normalized =
      item.normalized_job && typeof item.normalized_job === "object"
        ? { ...item.normalized_job }
        : {};
    const attribution = inferEmployerAttribution({
      parentCompany: normalized.parentCompany || item.parent_company,
      employerName: item.employer_name,
      employerBrand: normalized.employerBrand || item.employer_brand,
      practiceName: normalized.practiceName || item.practice_name,
      company: normalized.company || item.normalized_company,
      title: normalized.title || item.normalized_title || item.raw_title,
      description:
        normalized.description || item.normalized_description || item.raw_description,
      sourceUrl: normalized.sourceUrl || item.normalized_source_url || item.source_url,
      applyUrl: normalized.applyUrl || item.normalized_apply_url || item.apply_url,
    });

    const nextParentCompany =
      attribution.parentCompany || normalized.parentCompany || item.parent_company || item.employer_name || null;
    const nextEmployerBrand =
      attribution.employerBrand || normalized.employerBrand || item.employer_brand || null;
    const nextPracticeName =
      attribution.practiceName || normalized.practiceName || item.practice_name || null;

    const shouldUpdateParent = nextParentCompany && changed(item.parent_company, nextParentCompany);
    const shouldUpdateBrand = nextEmployerBrand && changed(item.employer_brand, nextEmployerBrand);
    const shouldUpdatePractice = nextPracticeName && changed(item.practice_name, nextPracticeName);

    if (!shouldUpdateParent && !shouldUpdateBrand && !shouldUpdatePractice) continue;

    normalized.parentCompany = nextParentCompany;
    normalized.employerBrand = nextEmployerBrand;
    normalized.practiceName = nextPracticeName;

    await query(
      `
        update public.job_imports
        set parent_company = coalesce($2, parent_company),
            employer_brand = coalesce($3, employer_brand),
            practice_name = coalesce($4, practice_name),
            normalized_job = $5::jsonb,
            updated_at = now()
        where id = $1
      `,
      [
        item.id,
        nextParentCompany,
        nextEmployerBrand,
        nextPracticeName,
        JSON.stringify(normalized),
      ]
    );

    updated += 1;
    if (shouldUpdateParent) parentCompanyUpdated += 1;
    if (shouldUpdateBrand) brandUpdated += 1;
    if (shouldUpdatePractice) practiceUpdated += 1;
  }

  return {
    scanned: imports.length,
    updated,
    parentCompanyUpdated,
    brandUpdated,
    practiceUpdated,
  };
}

async function brandCounts(table, whereClause = "") {
  const result = await query(
    `
      select
        brand,
        count(source.id)::int as count
      from unnest($1::text[]) as requested(brand)
      left join ${table} source
        on lower(coalesce(source.employer_brand, '')) = lower(requested.brand)
        ${whereClause}
      group by requested.brand
      order by requested.brand
    `,
    [REPORT_BRANDS]
  );
  return result.rows || [];
}

async function main() {
  await ensureSchema();
  const jobs = await backfillJobs();
  const imports = await backfillImports();
  const activeJobBrandCounts = await brandCounts(
    "public.jobs",
    "and source.status = 'active' and source.is_archived = false"
  );
  const importBrandCounts = await brandCounts("public.job_imports");

  console.log(
    JSON.stringify(
      {
        jobs,
        imports,
        activeJobBrandCounts,
        importBrandCounts,
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
