const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { normalizeDiscoveryResult } = require("../../src/lib/job-discovery");
const eyecareConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const { isAllowedByRobots } = require("../../src/lib/job-discovery/fetcher");
const { cleanText, normalizeUrl, truncate, uniqueStrings } = require("../../src/lib/job-discovery/utils");

const USER_AGENT = "jobs-vision-discovery/0.1 (+https://jobs.vision)";
const CAREERS_ORIGIN = "https://careers.walmart.com";
const SITEMAP_URL = `${CAREERS_ORIGIN}/sitemap.xml`;
const EVERGREEN_AGE_DAYS = 180;
const HARD_BLOCKED_PATHS = [/^\/api(?:\/|$)/i, /^\/results(?:\/|$)/i, /^\/us\/en\/results(?:\/|$)/i, /^\/us\/es\/results(?:\/|$)/i];

const SOURCES = {
  walmart: {
    key: "walmart-vision-center",
    employerName: "Walmart Vision Center",
    parentCompany: "Walmart Inc.",
    employerBrand: "Walmart Vision Center",
    employerWebsiteUrl: "https://www.walmart.com/cp/vision-centers/1078944",
    careersUrl: "https://careers.walmart.com/us/en/home/careers-areas/healthcare/optical-care",
    sourceType: "workday",
    industryKey: "eyecare",
    atsProvider: "workday",
  },
  sams: {
    key: "sams-club-optical",
    employerName: "Sam's Club Optical",
    parentCompany: "Walmart Inc.",
    employerBrand: "Sam's Club Optical",
    employerWebsiteUrl: "https://www.samsclub.com/c/optical/1087",
    careersUrl: "https://careers.walmart.com/us/en/sams-home/careers-areas/healthcare/optical-care",
    sourceType: "workday",
    industryKey: "eyecare",
    atsProvider: "workday",
  },
};

let dbModules = null;

function getDbModules() {
  if (!dbModules) {
    dbModules = {
      ...require("../services/jobImportRepository"),
      ...require("../services/db"),
    };
  }
  return dbModules;
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const valueFor = (name, fallback) => {
    const prefix = `${name}=`;
    const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
  };

  return {
    dryRun: !args.has("--import") || args.has("--dry-run"),
    jobId: valueFor("--job-id", ""),
    limit: numberOption(valueFor("--limit", ""), null),
    offset: numberOption(valueFor("--offset", "0"), 0),
    concurrency: numberOption(valueFor("--concurrency", "10"), 10),
    maxSitemaps: numberOption(valueFor("--max-sitemaps", "50"), 50),
    timeoutMs: numberOption(valueFor("--timeout-ms", "20000"), 20000),
  };
}

function numberOption(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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
  return Math.max(0, Math.floor((asOf.getTime() - date.getTime()) / 86400000));
}

function guardAllowedUrl(url, robotsText) {
  const parsed = new URL(url);
  if (parsed.origin !== CAREERS_ORIGIN) {
    throw new Error(`Unexpected host for Walmart import: ${url}`);
  }
  if (HARD_BLOCKED_PATHS.some((pattern) => pattern.test(parsed.pathname))) {
    throw new Error(`Blocked endpoint is not allowed for this import: ${url}`);
  }
  if (!isAllowedByRobots(url, robotsText, USER_AGENT)) {
    throw new Error(`robots.txt disallows ${url}`);
  }
}

async function fetchText(url, { robotsText = "", timeoutMs = 20000, accept = "text/html,application/xml,text/plain;q=0.8,*/*;q=0.5" } = {}) {
  guardAllowedUrl(url, robotsText);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: accept,
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, {
    ...options,
    accept: "application/json,text/plain;q=0.8,*/*;q=0.5",
  });
  return JSON.parse(text);
}

async function fetchWithRetry(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

function parseLocs(xml) {
  const locs = [];
  const pattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match = pattern.exec(xml);
  while (match) {
    locs.push(match[1].trim());
    match = pattern.exec(xml);
  }
  return locs;
}

function extractJobId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/jobs\/([^/?#]+)$/i);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function collectJobUrlsFromSitemaps({ robotsText, maxSitemaps, timeoutMs }) {
  const queue = [SITEMAP_URL];
  const seenSitemaps = new Set();
  const jobUrls = new Map();

  while (queue.length && seenSitemaps.size < maxSitemaps) {
    const sitemapUrl = queue.shift();
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    const xml = await fetchWithRetry(() => fetchText(sitemapUrl, { robotsText, timeoutMs }));
    for (const loc of parseLocs(xml)) {
      if (/\/us\/en\/jobs\/R-[^/?#]+$/i.test(loc)) {
        const jobId = extractJobId(loc);
        if (jobId && !jobUrls.has(jobId)) jobUrls.set(jobId, loc);
      } else if (/\.xml(?:$|\?)/i.test(loc) && loc.startsWith(CAREERS_ORIGIN) && !seenSitemaps.has(loc)) {
        queue.push(loc);
      }
    }
  }

  return {
    sitemapCount: seenSitemaps.size,
    jobUrls: Array.from(jobUrls.entries()).map(([jobId, url]) => ({ jobId, url })),
  };
}

function extractBuildId(html) {
  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData[1]);
      if (parsed?.buildId) return parsed.buildId;
    } catch {
      // Fall through to static asset patterns.
    }
  }

  const jsonMatch = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (jsonMatch) return jsonMatch[1];

  const staticMatch = html.match(/\/_next\/static\/([^/]+)\//);
  if (staticMatch) return staticMatch[1];

  return null;
}

function detailJsonUrl(buildId, jobId) {
  const url = new URL(`/_next/data/${encodeURIComponent(buildId)}/us/en/jobs/${encodeURIComponent(jobId)}.json`, CAREERS_ORIGIN);
  url.searchParams.set("country", "us");
  url.searchParams.set("lang", "en");
  url.searchParams.set("jobId", jobId);
  return url.toString();
}

function jobDetailFromPayload(payload) {
  return (
    payload?.pageProps?.jobDetails ||
    payload?.props?.pageProps?.jobDetails ||
    payload?.jobDetails ||
    null
  );
}

function pageBrandFromPayload(payload) {
  return cleanText(payload?.pageProps?.brand || payload?.props?.pageProps?.brand || "");
}

function nestedValue(value, paths = []) {
  for (const pathParts of paths) {
    let current = value;
    for (const part of pathParts) {
      current = current?.[part];
    }
    if (current !== null && current !== undefined && cleanText(current)) return current;
  }
  return null;
}

function sourceKeyForDetail(detail, payload) {
  const pageBrand = pageBrandFromPayload(payload);
  const banner = cleanText(nestedValue(detail, [["primaryLocation", "banner", "description"], ["banner", "description"]]));
  const title = cleanText(detail?.jobPostingTitle || detail?.title);
  const haystack = `${pageBrand} ${banner} ${title}`.toLowerCase();
  return /\bsam'?s club\b|\bsamsclub\b/.test(haystack) ? "sams" : "walmart";
}

function sourcePostedDate(detail) {
  return (
    detail?.jobPostingStartDate ||
    detail?.recruitingStartDate ||
    detail?.effectiveDate ||
    detail?.createdAt ||
    detail?.updatedAt ||
    null
  );
}

function sourceUpdatedDate(detail) {
  return detail?.effectiveDate || detail?.updatedAt || detail?.lastModifiedDate || null;
}

function extractLocation(detail) {
  const primary = detail?.primaryLocation || detail?.locations?.[0] || {};
  const city = cleanText(
    primary.city ||
      primary.cityName ||
      primary.address?.city ||
      primary.address?.locality ||
      detail?.city
  );
  const state = cleanText(
    primary.stateCode ||
      primary.state ||
      primary.stateProvince ||
      primary.region ||
      primary.address?.state ||
      primary.address?.administrativeArea ||
      detail?.state
  );
  const country = cleanText(
    primary.countryCode ||
      primary.country ||
      primary.address?.country ||
      primary.address?.regionCode ||
      detail?.country
  );
  const display = cleanText([city, state].filter(Boolean).join(", ")) || cleanText(primary.displayName || detail?.location);

  return {
    city: city || null,
    state: state || null,
    country: country || null,
    display: display || null,
    storeNumber: cleanText(primary.storeNumber || primary.facilityNumber || primary.locationId || "") || null,
    banner: cleanText(primary.banner?.description || primary.banner || "") || null,
  };
}

function roleCategoryForDetail(detail) {
  const title = cleanText(detail?.jobPostingTitle || detail?.title);
  const profile = cleanText(detail?.jobProfile?.value || detail?.jobProfile || "");
  const family = cleanText(detail?.jobFamily?.value || detail?.jobFamily || detail?.jobCategory?.value || "");
  const text = `${title} ${profile} ${family}`.toLowerCase();

  if (!text) return null;
  if (/\b(intern|internship|student)\b/.test(text) && !/\bapprentice\b/.test(text)) return null;
  if (/\bpharmac(y|ist)|\bnurs(e|ing)\b|\bhearing aid\b|\bdental\b|\bveterinar/.test(text)) return null;

  if (/\bindependent optometrist\b|\bassociate optometrist\b|\bmedical optometrist\b|\boptometrist\b|\bdoctor of optometry\b/.test(text)) {
    return { key: "od", label: "OD" };
  }

  if (/\bcertified optical manager\b|\bvision center manager\b|\boptical manager\b|\bmanager\b.*\b(vision center|optical)\b/.test(text)) {
    return { key: "manager", label: "Manager" };
  }

  if (/\blicensed optician\b|\bdispensing optician\b|\boptician\b|\boptical apprentice\b|\bapprentice optician\b/.test(text)) {
    return { key: "optician", label: "Optician" };
  }

  return null;
}

function isOpenRequisition(detail) {
  const status = cleanText(detail?.requisitionStatus?.id || detail?.requisitionStatus?.value || detail?.requisitionStatus || "");
  return status ? status.toUpperCase() === "OPEN" : false;
}

function discoveryResultFromDetail({ jobId, sourceUrl, detail, payload }) {
  const sourceKey = sourceKeyForDetail(detail, payload);
  const source = SOURCES[sourceKey];
  const roleCategory = roleCategoryForDetail(detail);
  const location = extractLocation(detail);
  const postedAt = sourcePostedDate(detail);
  const updatedAt = sourceUpdatedDate(detail);
  const title = cleanText(detail?.jobPostingTitle || detail?.title);
  const description = truncate(cleanText(detail?.description || detail?.jobPostingDescription || detail?.externalDescription), 30000) || null;
  const applyUrl = normalizeUrl(sourceUrl);

  if (!source || !roleCategory || !title || !applyUrl || !isOpenRequisition(detail)) {
    return null;
  }

  return {
    source,
    sourceRoleCategory: roleCategory.key,
    discoveryResult: {
      sourceUrl,
      discoveredAt: new Date().toISOString(),
      rawTitle: title,
      rawLocation: location.display,
      rawDescription: description,
      applyUrl,
      requisitionId: cleanText(detail?.jobId || detail?.requisitionId || jobId) || jobId,
      sourcePostedAt: postedAt,
      sourceUpdatedAt: updatedAt,
      employerName: source.employerName,
      sourceType: source.sourceType,
      atsProvider: source.atsProvider,
      confidenceScore: 96,
      extractionNotes: [
        "Extracted from careers.walmart.com sitemap and public Next.js job detail JSON.",
        "No careers search API, results endpoint, or disallowed endpoint was used.",
        `Source role category: ${roleCategory.label}.`,
      ],
      classification: "job_posting",
      customFields: [
        { name: "walmart_brand", value: source.employerBrand },
        { name: "parent_company", value: source.parentCompany },
        { name: "source_role_category", value: roleCategory.key },
        { name: "page_brand", value: pageBrandFromPayload(payload) || null },
        { name: "primary_location_banner", value: location.banner },
        { name: "store_number", value: location.storeNumber },
        { name: "job_profile", value: cleanText(detail?.jobProfile?.value || detail?.jobProfile || "") || null },
        { name: "requisition_status", value: cleanText(detail?.requisitionStatus?.id || detail?.requisitionStatus || "") || null },
      ],
    },
    metadata: {
      jobId,
      sourceKey,
      roleCategory: roleCategory.key,
      sourcePostedAt: postedAt,
      sourceUpdatedAt: updatedAt,
      sourcePostingAgeDays: ageDays(parseDate(postedAt)),
      location,
    },
  };
}

function roleTagsForCategory(category) {
  if (category === "od") return ["optometrist"];
  if (category === "optician") return ["optician"];
  if (category === "manager") return ["practice_manager"];
  return [];
}

function normalizeImportJob(item) {
  const normalized = normalizeDiscoveryResult(item.discoveryResult, item.source, {
    industryConfig: eyecareConfig,
  });
  const sourceAgeDays = item.metadata.sourcePostingAgeDays;
  const sourceRoleTags = roleTagsForCategory(item.metadata.roleCategory);

  return {
    ...item,
    normalizedJob: {
      ...normalized,
      company: item.source.employerName,
      parentCompany: item.source.parentCompany,
      employerBrand: item.source.employerBrand,
      practiceName: null,
      sourcePostedAt: item.metadata.sourcePostedAt || null,
      sourceUpdatedAt: item.metadata.sourceUpdatedAt || null,
      sourcePostingAgeDays: sourceAgeDays,
      freshnessCheckedAt: new Date().toISOString(),
      evergreen: Number.isInteger(sourceAgeDays) && sourceAgeDays > EVERGREEN_AGE_DAYS,
      evergreenReason:
        Number.isInteger(sourceAgeDays) && sourceAgeDays > EVERGREEN_AGE_DAYS
          ? `Source posting age is ${sourceAgeDays} days, exceeding the ${EVERGREEN_AGE_DAYS}-day evergreen threshold.`
          : null,
      atsProvider: item.source.atsProvider,
      listingSource: "imported",
      listingTier: "imported",
      listingOpportunityType: "job",
      locationPrecision: normalized.location ? "city" : "unknown",
      roleTags: uniqueStrings([...(normalized.roleTags || []), ...sourceRoleTags]),
      status: "needs_review",
      sourceRoleCategory: item.metadata.roleCategory,
      walmartJobId: item.metadata.jobId,
    },
  };
}

function increment(object, key, amount = 1) {
  const safeKey = key || "unknown";
  object[safeKey] = (object[safeKey] || 0) + amount;
}

function freshnessBucket(age) {
  if (!Number.isInteger(age)) return "unknown";
  if (age <= 30) return "0-30";
  if (age <= 60) return "31-60";
  if (age <= 90) return "61-90";
  if (age <= 180) return "91-180";
  return "180+";
}

function summarizeImportJobs(jobs) {
  const summary = {
    total: jobs.length,
    bySource: {},
    byRole: { od: 0, optician: 0, manager: 0 },
    recommendations: { approve: 0, reject: 0, review: 0 },
    roleBadges: {},
    freshness: { "0-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0, unknown: 0 },
  };

  for (const item of jobs) {
    const sourceName = item.source.employerName;
    if (!summary.bySource[sourceName]) {
      summary.bySource[sourceName] = {
        total: 0,
        roles: { od: 0, optician: 0, manager: 0 },
        recommendations: { approve: 0, reject: 0, review: 0 },
        freshness: { "0-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0, unknown: 0 },
      };
    }

    const sourceSummary = summary.bySource[sourceName];
    const role = item.metadata.roleCategory;
    const recommendation = String(item.normalizedJob.recommendation || "review").toLowerCase();
    const bucket = freshnessBucket(item.metadata.sourcePostingAgeDays);

    sourceSummary.total += 1;
    increment(sourceSummary.roles, role);
    increment(sourceSummary.recommendations, recommendation);
    increment(sourceSummary.freshness, bucket);
    increment(summary.byRole, role);
    increment(summary.recommendations, recommendation);
    increment(summary.roleBadges, item.normalizedJob.roleBadge || "UNKNOWN");
    increment(summary.freshness, bucket);
  }

  return summary;
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function countExistingDuplicateKeys(keys, { allowUnavailable = false } = {}) {
  if (!keys.length) return { count: 0, keys: new Set(), unavailable: null };

  try {
    const { pool } = getDbModules();
    const result = await pool.query(
      "select duplicate_key from public.job_imports where duplicate_key = any($1::text[])",
      [keys]
    );
    const existing = new Set((result.rows || []).map((row) => row.duplicate_key));
    return { count: existing.size, keys: existing, unavailable: null };
  } catch (error) {
    if (!allowUnavailable) throw error;
    return { count: 0, keys: new Set(), unavailable: error.message };
  }
}

async function summarizeSavedRows(keys) {
  if (!keys.length) return { rows: [], statusCounts: {}, sourceStatusCounts: {} };
  const { pool } = getDbModules();
  const result = await pool.query(
    `
      select employer_brand, status, recommendation, role_badge, count(*)::int as count
      from public.job_imports
      where duplicate_key = any($1::text[])
      group by employer_brand, status, recommendation, role_badge
      order by employer_brand, status, recommendation, role_badge
    `,
    [keys]
  );
  const statusCounts = {};
  const sourceStatusCounts = {};

  for (const row of result.rows || []) {
    increment(statusCounts, row.status, row.count);
    const brand = row.employer_brand || "unknown";
    if (!sourceStatusCounts[brand]) sourceStatusCounts[brand] = {};
    increment(sourceStatusCounts[brand], row.status, row.count);
  }

  return { rows: result.rows || [], statusCounts, sourceStatusCounts };
}

async function saveGroupedDiscoveryRuns(jobs) {
  const { saveDiscoveryRun } = getDbModules();
  const saved = [];

  for (const source of Object.values(SOURCES)) {
    const sourceJobs = jobs
      .filter((item) => item.source.key === source.key)
      .map((item) => ({
        discoveryResult: item.discoveryResult,
        normalizedJob: item.normalizedJob,
      }));

    if (!sourceJobs.length) continue;
    const rows = await saveDiscoveryRun(
      {
        source,
        discoveredAt: new Date().toISOString(),
        notes: [
          "Controlled Walmart/Sam's optical import from careers.walmart.com sitemap and public job detail JSON only.",
          "No disallowed search API, results endpoint, or blocked endpoint was used.",
          "Imports are saved to the review workflow only; this script does not publish jobs.",
        ],
        rejectedClassifications: {},
        jobs: sourceJobs,
      },
      { discoveredBy: "script:walmart-sams-controlled-import" }
    );
    saved.push(...rows);
  }

  return saved;
}

async function main() {
  const options = parseArgs();
  const startedAt = new Date();
  const robotsText = await fetchText(`${CAREERS_ORIGIN}/robots.txt`, {
    robotsText: "",
    timeoutMs: options.timeoutMs,
    accept: "text/plain,*/*;q=0.5",
  });

  const { sitemapCount, jobUrls: allJobUrls } = await collectJobUrlsFromSitemaps({
    robotsText,
    maxSitemaps: options.maxSitemaps,
    timeoutMs: options.timeoutMs,
  });
  const selectedJobUrls = options.jobId
    ? allJobUrls.filter((entry) => entry.jobId === options.jobId)
    : allJobUrls.slice(options.offset, options.limit ? options.offset + options.limit : undefined);
  if (!selectedJobUrls.length) {
    throw new Error(options.jobId ? `Job id ${options.jobId} was not found in the Walmart sitemap.` : "No Walmart career job URLs were found in the sitemap.");
  }

  const firstPageHtml = await fetchWithRetry(() =>
    fetchText(selectedJobUrls[0].url, { robotsText, timeoutMs: options.timeoutMs })
  );
  const buildId = extractBuildId(firstPageHtml);
  if (!buildId) {
    throw new Error("Could not extract Walmart Careers Next.js build id from a public job detail page.");
  }

  guardAllowedUrl(detailJsonUrl(buildId, selectedJobUrls[0].jobId), robotsText);

  const fetchStats = {
    fetched: 0,
    failed: 0,
    skippedNotOpen: 0,
    skippedIrrelevant: 0,
    skippedIncomplete: 0,
  };
  const failures = [];

  const fetched = await mapConcurrent(selectedJobUrls, options.concurrency, async (entry, index) => {
    const jsonUrl = detailJsonUrl(buildId, entry.jobId);
    try {
      const payload = await fetchWithRetry(() => fetchJson(jsonUrl, { robotsText, timeoutMs: options.timeoutMs }));
      fetchStats.fetched += 1;
      if (fetchStats.fetched % 500 === 0) {
        console.error(`Fetched ${fetchStats.fetched}/${selectedJobUrls.length} detail payloads...`);
      }

      const detail = jobDetailFromPayload(payload);
      const roleCategory = detail ? roleCategoryForDetail(detail) : null;
      const open = detail ? isOpenRequisition(detail) : false;
      if (!detail) {
        fetchStats.skippedIncomplete += 1;
        return null;
      }
      if (!open) {
        fetchStats.skippedNotOpen += 1;
        return null;
      }
      if (!roleCategory) {
        fetchStats.skippedIrrelevant += 1;
        return null;
      }

      return discoveryResultFromDetail({
        jobId: entry.jobId,
        sourceUrl: entry.url,
        detail,
        payload,
      });
    } catch (error) {
      fetchStats.failed += 1;
      if (failures.length < 20) failures.push({ jobId: entry.jobId, url: jsonUrl, error: error.message });
      return null;
    }
  });

  const jobs = fetched.filter(Boolean).map(normalizeImportJob);
  const duplicateKeys = jobs.map((item) => item.normalizedJob.duplicateKey).filter(Boolean);
  const existingDuplicates = await countExistingDuplicateKeys(duplicateKeys, { allowUnavailable: options.dryRun });
  const summary = summarizeImportJobs(jobs);
  const savedRows = options.dryRun ? [] : await saveGroupedDiscoveryRuns(jobs);
  const savedSummary = options.dryRun ? null : await summarizeSavedRows(duplicateKeys);
  const finishedAt = new Date();

  const report = {
    dryRun: options.dryRun,
    sourcePolicy: {
      sitemapUrl: SITEMAP_URL,
      detailJsonPattern: `${CAREERS_ORIGIN}/_next/data/{buildId}/us/en/jobs/{jobId}.json?country=us&lang=en&jobId={jobId}`,
      blockedEndpointsUsed: 0,
      searchApisUsed: 0,
      buildId,
      sitemapCount,
      totalJobUrlsInSitemap: allJobUrls.length,
      scannedJobUrls: selectedJobUrls.length,
      jobIdFilter: options.jobId || null,
    },
    fetchStats,
    duplicateSummary: {
      existingDuplicateKeys: existingDuplicates.count,
      duplicateRate:
        duplicateKeys.length > 0
          ? Number(((existingDuplicates.count / duplicateKeys.length) * 100).toFixed(1))
          : 0,
      databaseUnavailable: existingDuplicates.unavailable,
    },
    imported: {
      discoveredRelevant: jobs.length,
      importedOrUpdated: options.dryRun ? 0 : savedRows.length,
      newDuplicateKeys: Math.max(0, duplicateKeys.length - existingDuplicates.count),
      existingDuplicateKeys: existingDuplicates.count,
      publishedByScript: 0,
    },
    classification: {
      approved: summary.recommendations.approve || 0,
      rejected: summary.recommendations.reject || 0,
      review: summary.recommendations.review || 0,
      roleBadges: summary.roleBadges,
    },
    freshness: summary.freshness,
    counts: {
      walmart: summary.bySource[SOURCES.walmart.employerName] || null,
      sams: summary.bySource[SOURCES.sams.employerName] || null,
      od: summary.byRole.od || 0,
      optician: summary.byRole.optician || 0,
      manager: summary.byRole.manager || 0,
    },
    savedStatus: savedSummary
      ? {
          statusCounts: savedSummary.statusCounts,
          sourceStatusCounts: savedSummary.sourceStatusCounts,
          rows: savedSummary.rows,
        }
      : null,
    sample: jobs.slice(0, 20).map((item) => ({
      title: item.normalizedJob.title,
      employerBrand: item.normalizedJob.employerBrand,
      location: item.normalizedJob.location,
      sourceRoleCategory: item.metadata.roleCategory,
      roleBadge: item.normalizedJob.roleBadge,
      recommendation: item.normalizedJob.recommendation,
      ageDays: item.metadata.sourcePostingAgeDays,
      applyUrl: item.normalizedJob.applyUrl,
    })),
    failures,
    runtimeSeconds: Number(((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dbModules?.pool) await dbModules.pool.end();
  });
