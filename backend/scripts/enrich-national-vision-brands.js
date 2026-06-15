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
const { inferNationalVisionAttribution } = require("../services/employerAttribution");

const SMARTRECRUITERS_COMPANY_KEY = "NationalVision1";
const DOCTOR_GROUP = "National Vision Doctor of Optometry";
const REPORT_ATTRIBUTIONS = [
  { label: "America's Best", field: "employer_brand" },
  { label: "Eyeglass World", field: "employer_brand" },
  { label: "Vista Optical - Military", field: "employer_brand" },
  { label: "Vista Optical - Fred Meyer", field: "employer_brand" },
  { label: DOCTOR_GROUP, field: "practice_name" },
];

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const entry = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const OPTIONS = {
  dryRun: process.argv.includes("--dry-run"),
  refreshDetails: process.argv.includes("--refresh-details"),
  skipFetch: process.argv.includes("--skip-fetch"),
  limit: Number(argValue("--limit", 0)) || null,
  concurrency: Math.min(12, Math.max(1, Number(argValue("--concurrency", process.env.NATIONAL_VISION_ENRICH_CONCURRENCY || 6)) || 6)),
};

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function changed(current, next) {
  return cleanText(current) !== cleanText(next);
}

function specificPracticeName(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (!text || /^national\s+vision$/i.test(text)) continue;
    return text;
  }
  return null;
}

function customFieldsFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.customField)) return value.customField;
  if (Array.isArray(value.customFields)) return value.customFields;
  if (value.smartRecruitersDetail) return customFieldsFrom(value.smartRecruitersDetail);
  if (value.smartRecruiters) return customFieldsFrom(value.smartRecruiters);
  return [];
}

function hasCustomFields(value) {
  return customFieldsFrom(value).length > 0;
}

function parseSmartRecruitersUrl(value) {
  const text = cleanText(value);
  if (!text) return null;

  try {
    const parsed = new URL(text);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host === "api.smartrecruiters.com") {
      const companyIndex = parts.findIndex((part) => part === "companies");
      const postingsIndex = parts.findIndex((part) => part === "postings");
      if (companyIndex >= 0 && postingsIndex > companyIndex && parts[companyIndex + 1] && parts[postingsIndex + 1]) {
        return {
          companyKey: parts[companyIndex + 1],
          postingId: parts[postingsIndex + 1],
        };
      }
    }

    if (host === "jobs.smartrecruiters.com" && parts[0] && parts[1]) {
      return {
        companyKey: parts[0],
        postingId: parts[1].split("-")[0],
      };
    }
  } catch {
    return null;
  }

  return null;
}

function smartRecruitersDetailUrl(row, normalized, discovery) {
  const smartRecruiters = asObject(normalized.smartRecruiters || discovery.smartRecruiters);
  const candidates = [
    smartRecruiters.detailUrl,
    discovery.smartRecruitersDetailUrl,
    normalized.smartRecruitersDetailUrl,
    row.source_url,
    row.apply_url,
    row.normalized_source_url,
    row.normalized_apply_url,
    normalized.sourceUrl,
    normalized.applyUrl,
    discovery.sourceUrl,
    discovery.applyUrl,
  ];

  for (const candidate of candidates) {
    const parsed = parseSmartRecruitersUrl(candidate);
    if (parsed?.postingId) {
      return {
        companyKey: parsed.companyKey || SMARTRECRUITERS_COMPANY_KEY,
        postingId: parsed.postingId,
        url: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(parsed.companyKey || SMARTRECRUITERS_COMPANY_KEY)}/postings/${encodeURIComponent(parsed.postingId)}`,
      };
    }
  }

  const postingId = cleanText(
    normalized.requisitionId ||
      discovery.requisitionId ||
      row.requisition_id
  );
  if (!postingId) return null;

  return {
    companyKey: SMARTRECRUITERS_COMPANY_KEY,
    postingId,
    url: `https://api.smartrecruiters.com/v1/companies/${SMARTRECRUITERS_COMPANY_KEY}/postings/${encodeURIComponent(postingId)}`,
  };
}

function existingDetail(normalized, discovery) {
  const candidates = [
    discovery.smartRecruitersDetail,
    normalized.smartRecruitersDetail,
    discovery.smartRecruiters,
    normalized.smartRecruiters,
    discovery,
    normalized,
  ];
  return candidates.find(hasCustomFields) || null;
}

async function fetchSmartRecruitersDetail(detail) {
  const response = await fetch(detail.url, {
    headers: {
      "User-Agent": "jobs-vision-discovery/0.1 (+https://jobs.vision)",
      Accept: "application/json,text/plain;q=0.8,*/*;q=0.5",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function mergeDiscoveryResult(discovery, detailPayload, detail, fetchedAt) {
  if (!detailPayload) return discovery;
  return {
    ...discovery,
    smartRecruitersDetail: detailPayload,
    smartRecruitersDetailFetchedAt: fetchedAt,
    smartRecruitersDetailUrl: detail.url,
    customFields: Array.isArray(detailPayload.customField)
      ? detailPayload.customField
      : discovery.customFields,
  };
}

function mergeNormalizedJob(normalized, attribution, detailPayload, detail, fetchedAt) {
  const customFields = customFieldsFrom(detailPayload);
  const smartRecruiters = {
    ...asObject(normalized.smartRecruiters),
    companyKey: detail?.companyKey || asObject(normalized.smartRecruiters).companyKey || SMARTRECRUITERS_COMPANY_KEY,
    postingId: detail?.postingId || asObject(normalized.smartRecruiters).postingId || cleanText(normalized.requisitionId) || null,
    detailUrl: detail?.url || asObject(normalized.smartRecruiters).detailUrl || null,
    postingUrl: detailPayload?.postingUrl || asObject(normalized.smartRecruiters).postingUrl || null,
    applyUrl: detailPayload?.applyUrl || asObject(normalized.smartRecruiters).applyUrl || null,
    customFields: customFields.length ? customFields : asObject(normalized.smartRecruiters).customFields,
    detailFetchedAt: fetchedAt || asObject(normalized.smartRecruiters).detailFetchedAt || null,
  };

  return {
    ...normalized,
    parentCompany: attribution.parentCompany || null,
    employerBrand: attribution.employerBrand || null,
    practiceName: attribution.practiceName || null,
    customFields: customFields.length ? customFields : normalized.customFields || [],
    smartRecruiters,
  };
}

function attributionFields(row, normalized, discovery, detailPayload) {
  return {
    parentCompany: normalized.parentCompany || row.parent_company,
    employerName: row.employer_name,
    employerBrand: normalized.employerBrand || row.employer_brand,
    practiceName: normalized.practiceName || row.practice_name,
    company: normalized.company || row.normalized_company,
    title: normalized.title || row.normalized_title || row.raw_title,
    rawTitle: row.raw_title,
    description: normalized.description || row.normalized_description || row.raw_description,
    sourceUrl: normalized.sourceUrl || row.normalized_source_url || row.source_url,
    applyUrl: normalized.applyUrl || row.normalized_apply_url || row.apply_url,
    primaryRole: normalized.primaryRole || row.primary_role,
    roleBadge: normalized.roleBadge || row.role_badge,
    customFields:
      customFieldsFrom(detailPayload).length
        ? customFieldsFrom(detailPayload)
        : customFieldsFrom(normalized).length
          ? customFieldsFrom(normalized)
          : customFieldsFrom(discovery),
    smartRecruiters: normalized.smartRecruiters || discovery.smartRecruiters,
    smartRecruitersDetail: detailPayload,
  };
}

async function loadNationalVisionImports() {
  const params = [];
  let limitSql = "";
  if (OPTIONS.limit) {
    params.push(OPTIONS.limit);
    limitSql = `limit $${params.length}`;
  }

  const result = await query(
    `
      select
        ji.*,
        ji.normalized_job->>'requisitionId' as requisition_id,
        j.id as linked_job_id,
        j.parent_company as linked_parent_company,
        j.employer_brand as linked_employer_brand,
        j.practice_name as linked_practice_name,
        j.status as linked_job_status,
        j.is_archived as linked_job_is_archived
      from public.job_imports ji
      left join public.jobs j on j.id = ji.published_job_id
      where ji.employer_name ilike '%national vision%'
         or ji.normalized_company ilike '%national vision%'
         or ji.parent_company ilike '%national vision%'
         or ji.source_url ilike '%NationalVision1%'
         or ji.normalized_job->'smartRecruiters'->>'companyKey' = 'NationalVision1'
      order by ji.discovered_at asc, ji.created_at asc
      ${limitSql}
    `,
    params
  );
  return result.rows || [];
}

async function updateImport(row, nextValues) {
  if (OPTIONS.dryRun) return false;
  await query(
    `
      update public.job_imports
      set
        parent_company = $2,
        employer_brand = $3,
        practice_name = $4,
        discovery_result = $5::jsonb,
        normalized_job = $6::jsonb,
        updated_at = now()
      where id = $1
    `,
    [
      row.id,
      nextValues.parentCompany,
      nextValues.employerBrand,
      nextValues.practiceName,
      JSON.stringify(nextValues.discoveryResult),
      JSON.stringify(nextValues.normalizedJob),
    ]
  );
  return true;
}

async function updateLinkedJob(row, attribution) {
  if (row.status !== "published" || !row.linked_job_id) {
    return { updated: false, skipped: true };
  }

  const shouldUpdate =
    changed(row.linked_parent_company, attribution.parentCompany) ||
    changed(row.linked_employer_brand, attribution.employerBrand) ||
    changed(row.linked_practice_name, attribution.practiceName);

  if (!shouldUpdate) return { updated: false, skipped: false };

  if (!OPTIONS.dryRun) {
    await query(
      `
        update public.jobs
        set
          parent_company = $2,
          employer_brand = $3,
          practice_name = $4,
          updated_at = now()
        where id = $1
      `,
      [
        row.linked_job_id,
        attribution.parentCompany,
        attribution.employerBrand,
        attribution.practiceName,
      ]
    );
  }

  return { updated: true, skipped: false };
}

async function processRow(row) {
  const normalized = asObject(row.normalized_job);
  const discovery = asObject(row.discovery_result);
  const detail = smartRecruitersDetailUrl(row, normalized, discovery);
  let detailPayload = existingDetail(normalized, discovery);
  let fetchedAt = null;
  let detailFetched = false;
  let detailFetchError = null;

  if (!OPTIONS.skipFetch && detail?.url && (OPTIONS.refreshDetails || !detailPayload)) {
    try {
      detailPayload = await fetchSmartRecruitersDetail(detail);
      fetchedAt = new Date().toISOString();
      detailFetched = true;
    } catch (error) {
      detailFetchError = `${detail.url}: ${error.message}`;
    }
  }

  const attribution =
    inferNationalVisionAttribution(attributionFields(row, normalized, discovery, detailPayload)) || {};
  const nextAttribution = {
    parentCompany: attribution.parentCompany || row.parent_company || normalized.parentCompany || "National Vision",
    employerBrand: attribution.employerBrand || row.employer_brand || normalized.employerBrand || null,
    practiceName: attribution.practiceName || specificPracticeName(row.practice_name, normalized.practiceName),
  };

  const nextDiscovery = mergeDiscoveryResult(discovery, detailFetched ? detailPayload : null, detail, fetchedAt);
  const nextNormalized = mergeNormalizedJob(normalized, nextAttribution, detailPayload, detail, fetchedAt);

  const importShouldUpdate =
    changed(row.parent_company, nextAttribution.parentCompany) ||
    changed(row.employer_brand, nextAttribution.employerBrand) ||
    changed(row.practice_name, nextAttribution.practiceName) ||
    detailFetched ||
    changed(JSON.stringify(normalized.smartRecruiters || null), JSON.stringify(nextNormalized.smartRecruiters || null)) ||
    changed(JSON.stringify(normalized.customFields || []), JSON.stringify(nextNormalized.customFields || []));

  let importUpdated = false;
  if (importShouldUpdate) {
    importUpdated = await updateImport(row, {
      ...nextAttribution,
      discoveryResult: nextDiscovery,
      normalizedJob: nextNormalized,
    });
  }

  const linkedJob = await updateLinkedJob(row, nextAttribution);

  return {
    importShouldUpdate,
    importUpdated: importUpdated || (OPTIONS.dryRun && importShouldUpdate),
    publishedJobUpdated: linkedJob.updated,
    publishedJobSkipped: linkedJob.skipped,
    detailAttempted: Boolean(!OPTIONS.skipFetch && detail?.url && (OPTIONS.refreshDetails || !existingDetail(normalized, discovery))),
    detailFetched,
    detailFetchError,
    hasAttribution: Boolean(nextAttribution.employerBrand || nextAttribution.practiceName),
  };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  let completed = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      completed += 1;
      if (completed % 50 === 0 || completed === items.length) {
        console.log(`Processed ${completed}/${items.length} National Vision import(s).`);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function countAttributions(tableSql, whereSql, qualifier = "") {
  const column = (name) => (qualifier ? `${qualifier}.${name}` : name);
  const selectSql = REPORT_ATTRIBUTIONS.map((item, index) => {
    const alias = `count_${index}`;
    return `count(*) filter (where ${column(item.field)} = $${index + 1})::int as ${alias}`;
  }).join(",\n        ");

  const result = await query(
    `
      select
        count(*)::int as total,
        ${selectSql},
        count(*) filter (
          where coalesce(${column("employer_brand")}, '') = ''
            and coalesce(${column("practice_name")}, '') = ''
        )::int as missing_any_attribution,
        count(*) filter (where coalesce(${column("employer_brand")}, '') = '')::int as missing_employer_brand
      from ${tableSql}
      ${whereSql}
    `,
    REPORT_ATTRIBUTIONS.map((item) => item.label)
  );

  const row = result.rows[0] || {};
  return {
    total: Number(row.total || 0),
    counts: REPORT_ATTRIBUTIONS.map((item, index) => ({
      label: item.label,
      field: item.field,
      count: Number(row[`count_${index}`] || 0),
    })),
    missingAnyAttribution: Number(row.missing_any_attribution || 0),
    missingEmployerBrand: Number(row.missing_employer_brand || 0),
  };
}

async function buildReport(results) {
  const importCounts = await countAttributions(
    "public.job_imports",
    `
      where employer_name ilike '%national vision%'
         or normalized_company ilike '%national vision%'
         or parent_company ilike '%national vision%'
         or source_url ilike '%NationalVision1%'
         or normalized_job->'smartRecruiters'->>'companyKey' = 'NationalVision1'
    `
  );
  const activePublishedJobCounts = await countAttributions(
    `
      public.jobs j
      join public.job_imports ji on ji.published_job_id = j.id
    `,
    `
      where ji.status = 'published'
        and j.status = 'active'
        and coalesce(j.is_archived, false) = false
        and (
          ji.employer_name ilike '%national vision%'
          or ji.normalized_company ilike '%national vision%'
          or ji.parent_company ilike '%national vision%'
          or ji.source_url ilike '%NationalVision1%'
          or ji.normalized_job->'smartRecruiters'->>'companyKey' = 'NationalVision1'
        )
    `,
    "j"
  );

  const failures = results
    .map((result) => result.detailFetchError)
    .filter(Boolean)
    .slice(0, 20);

  return {
    dryRun: OPTIONS.dryRun,
    importsScanned: results.length,
    importsUpdated: results.filter((result) => result.importUpdated).length,
    publishedJobsUpdated: results.filter((result) => result.publishedJobUpdated).length,
    detailFetch: {
      attempted: results.filter((result) => result.detailAttempted).length,
      fetched: results.filter((result) => result.detailFetched).length,
      failed: results.filter((result) => result.detailFetchError).length,
      sampleFailures: failures,
    },
    importAttributionCounts: importCounts,
    activePublishedJobAttributionCounts: activePublishedJobCounts,
  };
}

async function main() {
  const rows = await loadNationalVisionImports();
  console.log(
    `National Vision enrichment: ${rows.length} import(s), concurrency ${OPTIONS.concurrency}${OPTIONS.dryRun ? ", dry run" : ""}.`
  );
  const results = await mapLimit(rows, OPTIONS.concurrency, processRow);
  const report = await buildReport(results);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
