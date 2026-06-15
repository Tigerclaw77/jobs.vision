const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { normalizeDiscoveryResult } = require("../../src/lib/job-discovery");
const eyecareConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const { isAllowedByRobots } = require("../../src/lib/job-discovery/fetcher");
const { cleanText, normalizeUrl, truncate } = require("../../src/lib/job-discovery/utils");
const { saveDiscoveryRun } = require("../services/jobImportRepository");
const { pool } = require("../services/db");

const USER_AGENT = "jobs-vision-discovery/0.1 (+https://jobs.vision)";

const SOURCES = [
  {
    key: "costco-optical",
    employerName: "Costco Optical",
    parentCompany: "Costco Wholesale",
    employerBrand: "Costco Optical",
    employerWebsiteUrl: "https://www.costco.com/",
    careersUrl: "https://careers.costco.com/",
    endpoint: "https://careers.costco.com/api/jobs",
    sourceType: "career_page",
    industryKey: "eyecare",
    atsProvider: "jibe",
    keywords: ["optical", "optician"],
    crawlDelayMs: 5200,
    evergreen: true,
    evergreenReason:
      "Costco career pages explicitly describe these as typical positions that may be hired for when openings exist; treat as evergreen future-hiring requisitions.",
  },
];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const valueFor = (name, fallback) => {
    const prefix = `${name}=`;
    const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
  };

  return {
    dryRun: args.has("--dry-run"),
    maxPages: Number(valueFor("--max-pages", process.env.RETAIL_OPTICAL_MAX_PAGES || 25)),
    limit: Number(valueFor("--limit", process.env.RETAIL_OPTICAL_PAGE_LIMIT || 100)),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(date, asOf = new Date()) {
  if (!date) return null;
  return Math.floor((asOf.getTime() - date.getTime()) / 86400000);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/plain,text/html;q=0.8,*/*;q=0.5",
    },
  });
  return response.ok ? response.text() : "";
}

async function assertRobotsAllowed(url) {
  const parsed = new URL(url);
  const robotsText = await fetchText(`${parsed.origin}/robots.txt`);
  if (!isAllowedByRobots(url, robotsText, USER_AGENT)) {
    throw new Error(`robots.txt disallows ${url}`);
  }
  return robotsText;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json,text/plain;q=0.8,*/*;q=0.5",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.json();
}

function jibeJobUrl(origin, job) {
  const data = job?.data || job || {};
  const canonical = data.meta_data?.canonical_url;
  if (canonical) return normalizeUrl(canonical);
  const slug = data.slug || data.req_id || data.id;
  if (!slug) return null;
  const lang = data.language || "en-us";
  return normalizeUrl(`${origin.replace(/\/$/, "")}/jobs/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`);
}

function jibeLocation(job) {
  const data = job?.data || job || {};
  const postalAddress = data.meta_data?.googlejobs?.derivedInfo?.locations?.[0]?.postalAddress || {};
  return (
    cleanText(
      [
        data.city || postalAddress.locality,
        postalAddress.administrativeArea || data.state,
        data.country_code || postalAddress.regionCode || data.country,
      ]
        .filter(Boolean)
        .join(", ")
    ) || null
  );
}

function isRelevantRetailOpticalTitle(title) {
  const text = cleanText(title).toLowerCase();
  if (!text) return false;
  if (
    /\b(pharmacist|pharmacy|meat|bakery|cashier|forklift|stocker|warehouse|tire|hearing aid|food court|membership)\b/.test(
      text
    )
  ) {
    return false;
  }
  return /\b(optical|optician|optometrist|vision center|eyewear)\b/.test(text);
}

function discoveryResultFromJibe(source, origin, entry) {
  const data = entry?.data || entry || {};
  const sourceUrl = jibeJobUrl(origin, entry) || source.endpoint;
  const sourcePostedAt =
    data.posted_date ||
    data.meta_data?.icims?.primary_posted_site_object?.datePosted ||
    null;
  const sourceUpdatedAt =
    data.update_date ||
    data.meta_data?.last_mod ||
    data.meta_data?.icims?.date_updated ||
    null;
  return {
    sourceUrl,
    discoveredAt: new Date().toISOString(),
    rawTitle: cleanText(data.title),
    rawLocation: jibeLocation(entry),
    rawDescription: truncate(cleanText(data.description), 30000) || null,
    applyUrl: normalizeUrl(data.apply_url) || sourceUrl,
    requisitionId: cleanText(data.req_id || data.slug || data.id) || null,
    sourcePostedAt,
    sourceUpdatedAt,
    employerName: source.employerName,
    sourceType: source.sourceType,
    atsProvider: source.atsProvider,
    confidenceScore: 0,
    extractionNotes: [
      `Extracted from Jibe/Radancy jobs API (${origin}) with optical keyword filter.`,
      "Filtered to retail optical title patterns before import.",
      "Classified as job_posting.",
    ],
    classification: "job_posting",
  };
}

async function fetchSourceResults(source, options) {
  await assertRobotsAllowed(source.endpoint);
  const origin = new URL(source.careersUrl).origin;
  const byKey = new Map();
  const rawFetchedByKeyword = {};

  for (const keyword of source.keywords) {
    rawFetchedByKeyword[keyword] = 0;
    for (let page = 1; page <= options.maxPages; page += 1) {
      const url = `${source.endpoint}?limit=${options.limit}&page=${page}&keywords=${encodeURIComponent(keyword)}`;
      const json = await fetchJson(url);
      const jobs = Array.isArray(json.jobs) ? json.jobs : [];
      rawFetchedByKeyword[keyword] += jobs.length;

      for (const entry of jobs) {
        const title = cleanText(entry?.data?.title || entry?.title);
        if (!isRelevantRetailOpticalTitle(title)) continue;
        const result = discoveryResultFromJibe(source, origin, entry);
        const key = result.applyUrl || result.sourceUrl || `${keyword}:${title}:${result.rawLocation}`;
        if (!byKey.has(key)) byKey.set(key, result);
      }

      if (!jobs.length || jobs.length < options.limit) break;
      if (page < options.maxPages) await sleep(source.crawlDelayMs);
    }
  }

  return {
    rawFetchedByKeyword,
    results: Array.from(byKey.values()),
  };
}

async function countExistingDuplicateKeys(keys) {
  if (!keys.length) return 0;
  const result = await pool.query(
    "select count(*)::int as count from public.job_imports where duplicate_key = any($1::text[])",
    [keys]
  );
  return result.rows[0]?.count || 0;
}

function summarizeJobs(jobs) {
  return jobs.reduce(
    (summary, item) => {
      const recommendation = String(item.normalizedJob.recommendation || "none").toLowerCase();
      const roleBadge = String(item.normalizedJob.roleBadge || "UNKNOWN").toUpperCase();
      summary.recommendations[recommendation] = (summary.recommendations[recommendation] || 0) + 1;
      summary.roles[roleBadge] = (summary.roles[roleBadge] || 0) + 1;
      return summary;
    },
    { recommendations: {}, roles: {} }
  );
}

async function importSource(source, options) {
  const { rawFetchedByKeyword, results } = await fetchSourceResults(source, options);
  const jobs = results
    .map((result) => {
      const normalizedJob = normalizeDiscoveryResult(result, source, {
        industryConfig: eyecareConfig,
      });
      return {
        discoveryResult: result,
        normalizedJob: {
          ...normalizedJob,
          parentCompany: source.parentCompany,
          employerBrand: source.employerBrand,
          practiceName: null,
          evergreen: source.evergreen === true,
          evergreenReason: source.evergreenReason || null,
          sourcePostedAt: result.sourcePostedAt || null,
          sourceUpdatedAt: result.sourceUpdatedAt || null,
          sourcePostingAgeDays: ageDays(parseDate(result.sourcePostedAt)),
          freshnessCheckedAt: new Date().toISOString(),
          atsProvider: source.atsProvider,
          listingSource: "imported",
          listingTier: "imported",
          listingOpportunityType: "job",
          locationPrecision: normalizedJob.location ? "city" : "unknown",
          status: source.evergreen === true ? "evergreen" : "needs_review",
        },
      };
    })
    .filter((item) => item.normalizedJob.applyUrl);

  const duplicateKeys = jobs.map((item) => item.normalizedJob.duplicateKey).filter(Boolean);
  const existingDuplicates = await countExistingDuplicateKeys(duplicateKeys);
  const summary = summarizeJobs(jobs);
  const run = {
    source,
    discoveredAt: new Date().toISOString(),
    notes: [
      "Costco Jibe/Radancy endpoint filtered with keywords=optical and keywords=optician.",
      "Imports are saved to review queue only; no public jobs are published by this script.",
    ],
    rejectedClassifications: {},
    jobs,
  };

  const saved = options.dryRun ? [] : await saveDiscoveryRun(run, { discoveredBy: "retail-optical-import" });

  return {
    source: source.employerName,
    ats: source.atsProvider,
    endpoint: source.endpoint,
    rawFetchedByKeyword,
    discovered: results.length,
    normalized: jobs.length,
    importedOrUpdated: saved.length,
    existingDuplicates,
    duplicateRate:
      jobs.length > 0 ? Number(((existingDuplicates / jobs.length) * 100).toFixed(1)) : 0,
    recommendations: summary.recommendations,
    roles: summary.roles,
    sampleTitles: jobs.slice(0, 10).map((item) => ({
      title: item.normalizedJob.title,
      location: item.normalizedJob.location,
      recommendation: item.normalizedJob.recommendation,
      roleBadge: item.normalizedJob.roleBadge,
      applyUrlPresent: Boolean(item.normalizedJob.applyUrl),
    })),
  };
}

async function main() {
  const options = parseArgs();
  const summaries = [];

  for (const source of SOURCES) {
    summaries.push(await importSource(source, options));
  }

  console.log(JSON.stringify({ dryRun: options.dryRun, options, summaries }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
