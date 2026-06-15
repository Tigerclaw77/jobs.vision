const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { normalizeDiscoveryResult } = require("../../src/lib/job-discovery");
const { classifyJobForReview } = require("../../src/lib/job-discovery/classifier");
const eyecareConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const { cleanText, createDuplicateKey, stableLower, uniqueStrings } = require("../../src/lib/job-discovery/utils");
const { isAllowedByRobots } = require("../../src/lib/job-discovery/fetcher");
const { saveDiscoveryRun } = require("../services/jobImportRepository");
const { pool } = require("../services/db");

const ORIGIN = "https://jobs.dayforcehcm.com";
const CLIENT_NAMESPACE = "visionworks";
const CULTURE = "en-US";
const USER_AGENT = "jobs-vision-discovery/0.1 (+https://jobs.vision)";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;
const PAGE_SIZE = 25;
const EVERGREEN_AGE_DAYS = 180;
const FULL_IMPORT_CATEGORIES = new Set([
  "optometrist",
  "optician",
  "optical_manager",
  "optical_technician",
  "front_desk",
  "optical_sales",
  "other_relevant",
]);

const SOURCE = {
  key: "visionworks-dayforce-validation",
  employerName: "Visionworks",
  parentCompany: "VSP Vision",
  employerBrand: "Visionworks",
  employerWebsiteUrl: "https://www.visionworks.com/",
  careersUrl: `${ORIGIN}/visionworks/CANDIDATEPORTAL`,
  sourceType: "career_page",
  industryKey: "eyecare",
  atsProvider: "dayforce",
};

const BOARDS = [
  {
    key: "candidateportal",
    code: "CANDIDATEPORTAL",
    label: "CandidatePortal",
    url: `${ORIGIN}/visionworks/CANDIDATEPORTAL`,
  },
  {
    key: "sublease_od",
    code: "Sublease-OD",
    label: "Sublease OD",
    url: `${ORIGIN}/visionworks/Sublease-OD`,
  },
];

const TARGET_SAMPLE_CATEGORIES = [
  "optometrist",
  "optician",
  "optical_manager",
  "optical_technician",
  "front_desk",
  "optical_sales",
];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const valueFor = (name, fallback) => {
    const prefix = `${name}=`;
    const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
  };

  return {
    dryRun: !args.has("--import") || args.has("--dry-run"),
    full: args.has("--full"),
    limit: args.has("--full")
      ? Math.max(1, Number(valueFor("--limit", 10000)) || 10000)
      : Math.min(MAX_LIMIT, Math.max(1, Number(valueFor("--limit", DEFAULT_LIMIT)) || DEFAULT_LIMIT)),
    maxPages: Math.max(1, Number(valueFor("--max-pages", 100)) || 100),
    pageDelayMs: Math.max(0, Number(valueFor("--page-delay-ms", 150)) || 0),
    concurrency: Math.min(12, Math.max(1, Number(valueFor("--concurrency", 8)) || 8)),
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

function ageDays(value, asOf = new Date()) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((asOf.getTime() - date.getTime()) / 86400000));
}

function freshnessBucket(days) {
  if (!Number.isInteger(days)) return "unknown";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 180) return "91-180";
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

function setCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return combined.split(/,(?=\s*[^=;,\s]+=)/g);
}

function updateCookies(cookieJar, headers) {
  for (const header of setCookieHeaders(headers)) {
    const [pair] = String(header).split(";");
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    cookieJar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader(cookieJar) {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function fetchText(url, { method = "GET", body = null, headers = {}, cookieJar = null } = {}) {
  const requestHeaders = {
    "User-Agent": USER_AGENT,
    Accept: "application/json,text/plain,*/*",
    ...headers,
  };
  if (cookieJar && cookieJar.size) requestHeaders.Cookie = cookieHeader(cookieJar);

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body,
    redirect: "follow",
  });
  if (cookieJar) updateCookies(cookieJar, response.headers);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, options));
}

async function createDayforceSession() {
  const cookieJar = new Map();
  const csrf = await fetchJson(`${ORIGIN}/api/auth/csrf`, { cookieJar });
  return {
    cookieJar,
    csrfToken: csrf.csrfToken,
  };
}

async function dayforcePostJson(session, pathName, payload, referer) {
  const url = `${ORIGIN}${pathName}`;
  const body = JSON.stringify(payload);
  return fetchJson(url, {
    method: "POST",
    body,
    cookieJar: session.cookieJar,
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      Referer: referer,
      "X-CSRF-TOKEN": session.csrfToken,
    },
  });
}

async function fetchRobots() {
  return fetchText(`${ORIGIN}/robots.txt`, {
    headers: { Accept: "text/plain,*/*;q=0.5" },
  });
}

function assertAllowed(url, robotsText) {
  if (!isAllowedByRobots(url, robotsText, USER_AGENT)) {
    throw new Error(`robots.txt disallows ${url}`);
  }
}

async function fetchSiteContext(board, robotsText) {
  const url = `${ORIGIN}/api/geo/${CLIENT_NAMESPACE}/sitecontext/${CLIENT_NAMESPACE}/${board.code}/${CULTURE}`;
  assertAllowed(url, robotsText);
  return fetchJson(url, {
    headers: {
      Referer: board.url,
    },
  });
}

async function searchBoardPage(session, board, paginationStart, robotsText) {
  const pathName = `/api/geo/${CLIENT_NAMESPACE}/jobposting/search`;
  assertAllowed(`${ORIGIN}${pathName}`, robotsText);
  return dayforcePostJson(
    session,
    pathName,
    {
      clientNamespace: CLIENT_NAMESPACE,
      jobBoardCode: board.code,
      cultureCode: CULTURE,
      searchText: "",
      paginationStart,
      distanceUnit: 0,
    },
    board.url
  );
}

async function fetchBoardInventory(board, robotsText, { maxPages, pageDelayMs }) {
  const session = await createDayforceSession();
  const postings = [];
  let maxCount = null;
  let offset = 0;
  let page = 0;

  while (page < maxPages) {
    const payload = await searchBoardPage(session, board, offset, robotsText);
    maxCount = Number(payload.maxCount || maxCount || 0);
    const pagePostings = Array.isArray(payload.jobPostings) ? payload.jobPostings : [];
    postings.push(
      ...pagePostings.map((posting) => ({
        ...posting,
        sourceBoardCode: board.code,
        sourceBoardKey: board.key,
        sourceBoardLabel: board.label,
      }))
    );
    if (!pagePostings.length || postings.length >= maxCount) break;
    offset += PAGE_SIZE;
    page += 1;
    if (pageDelayMs) await sleep(pageDelayMs);
  }

  return {
    board,
    maxCount,
    fetched: postings.length,
    postings,
  };
}

function dedupePostings(postings) {
  const seen = new Set();
  const output = [];
  for (const posting of postings) {
    const key = String(posting.jobPostingId || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(posting);
  }
  return output;
}

function postingText(posting) {
  const attributes = Array.isArray(posting.jobPostingAttributes)
    ? posting.jobPostingAttributes.map((item) => `${item.name || ""} ${item.value || ""}`).join(" ")
    : "";
  return stableLower([posting.jobTitle, posting.jobDescription, attributes].filter(Boolean).join(" "));
}

function roleCategoryForPosting(posting) {
  const title = stableLower(posting.jobTitle);
  const text = postingText(posting);

  if (
    /\b(finance|accounting|payroll|human resources|hr|recruiter|recruiting|marketing|legal|counsel|analyst|engineer|developer|security|warehouse|distribution center)\b/.test(
      title
    )
  ) {
    return "excluded";
  }

  if (/\bod coordinator\b/.test(title)) return "front_desk";
  if (/\b(optometrist|doctor of optometry|sublease)\b/.test(title)) return "optometrist";
  if (/\b(optical manager|general manager|assistant manager|store manager|retail manager)\b/.test(title)) {
    return "optical_manager";
  }
  if (/\b(licensed optician|optician)\b/.test(title)) return "optician";
  if (/\b(optometric assistant|optometric technician|ophthalmic technician|ophthalmic assistant|clinical specialist|technician)\b/.test(title)) {
    return "optical_technician";
  }
  if (/\b(front desk|front office|receptionist|patient coordinator|patient service|office associate)\b/.test(title)) {
    return "front_desk";
  }
  if (/\b(sales associate|sales lead|retail sales|third key|eyewear consultant)\b/.test(title)) return "optical_sales";

  if (/\boptometrist|doctor of optometry|optician|optical|optometric|visionworks|vision care|eyewear\b/.test(text)) {
    return "other_relevant";
  }

  return "other";
}

function roleTagsForCategory(category) {
  if (category === "optometrist") return ["optometrist"];
  if (category === "optician") return ["optician"];
  if (category === "optical_manager") return ["practice_manager"];
  if (category === "optical_technician") return ["ophthalmic_technician"];
  if (category === "front_desk") return ["front_desk"];
  if (category === "optical_sales") return ["optical_sales"];
  return [];
}

function firstLocation(posting) {
  if (!Array.isArray(posting.postingLocations) || !posting.postingLocations.length) return null;
  return (
    posting.postingLocations.find((location) => cleanText(location.cityName) && cleanText(location.stateCode)) ||
    posting.postingLocations[0]
  );
}

function locationDisplay(posting) {
  const location = firstLocation(posting);
  if (!location) return null;
  const cityState = [cleanText(location.cityName), cleanText(location.stateCode)].filter(Boolean).join(", ");
  return cityState || cleanText(location.formattedAddress) || null;
}

function coordinatesFromLocation(location) {
  if (!location?.coordinates) return { latitude: null, longitude: null };
  if (typeof location.coordinates === "object") {
    return {
      latitude: Number(location.coordinates.lat) || null,
      longitude: Number(location.coordinates.lng) || null,
    };
  }
  const match = String(location.coordinates).match(/lat:([-0-9.]+);lng:([-0-9.]+)/i);
  return {
    latitude: match ? Number(match[1]) : null,
    longitude: match ? Number(match[2]) : null,
  };
}

function sourceUrlForPosting(posting) {
  return `${ORIGIN}/visionworks/${posting.sourceBoardCode}/jobs/${posting.jobPostingId}`;
}

function applyUrlForPosting(posting) {
  return `${sourceUrlForPosting(posting)}/apply`;
}

async function fetchPostingDetail(posting, robotsText) {
  const url = `${ORIGIN}/api/geo/${CLIENT_NAMESPACE}/jobposting/${CLIENT_NAMESPACE}/${CULTURE}/${posting.jobBoardId}/${posting.jobPostingId}`;
  assertAllowed(url, robotsText);
  return fetchJson(url, {
    headers: {
      Referer: sourceUrlForPosting(posting),
    },
  });
}

function normalizeDetail(posting, detail) {
  const content = detail?.jobPostingContent || {};
  const location = firstLocation(detail) || firstLocation(posting);
  const coordinates = coordinatesFromLocation(location);
  const sourcePostedAt = detail?.postingStartTimestampUTC || posting.postingStartTimestampUTC || null;
  const sourceUpdatedAt = detail?.lastModifiedTimestampUTC || detail?.createdTimestampUTC || null;
  const sourcePostingAgeDays = ageDays(sourcePostedAt);
  const category = roleCategoryForPosting({
    ...posting,
    jobTitle: detail?.jobTitle || posting.jobTitle,
    jobDescription: content.jobDescription || posting.jobDescription,
    jobPostingAttributes: detail?.jobPostingAttributes || posting.jobPostingAttributes,
  });
  const sourceUrl = sourceUrlForPosting(posting);
  const applyUrl = applyUrlForPosting(posting);
  const allLocations = Array.isArray(detail?.postingLocations) && detail.postingLocations.length
    ? detail.postingLocations
    : posting.postingLocations || [];
  const rawDescription = [content.jobDescription, content.jobDescriptionFooter].filter(Boolean).join("\n");

  const discoveryResult = {
    sourceUrl,
    discoveredAt: new Date().toISOString(),
    rawTitle: detail?.jobTitle || posting.jobTitle,
    rawLocation: locationDisplay(detail) || locationDisplay(posting),
    rawDescription,
    applyUrl,
    requisitionId: cleanText(detail?.jobReqId || posting.jobReqId || posting.jobPostingId) || null,
    sourcePostedAt,
    sourceUpdatedAt,
    sourcePostingAgeDays,
    employerName: SOURCE.employerBrand,
    sourceType: SOURCE.sourceType,
    atsProvider: SOURCE.atsProvider,
    confidenceScore: 96,
    extractionNotes: [
      "Extracted from VisionWorks public Dayforce search and job detail endpoints.",
      "Validation sample only; this script does not publish jobs.",
      `Dayforce board: ${posting.sourceBoardCode}.`,
      `Source role category: ${category}.`,
    ],
    classification: "job_posting",
    customFields: [
      { fieldLabel: "Parent Company", valueLabel: SOURCE.parentCompany },
      { fieldLabel: "Employer Brand", valueLabel: SOURCE.employerBrand },
      { fieldLabel: "ATS Provider", valueLabel: "Dayforce" },
      { fieldLabel: "Dayforce Board", valueLabel: posting.sourceBoardCode },
      { fieldLabel: "Dayforce Job Posting ID", valueLabel: String(posting.jobPostingId || "") },
      { fieldLabel: "Dayforce Job Req ID", valueLabel: String(posting.jobReqId || "") },
      { fieldLabel: "Source Role Category", valueLabel: category },
      { fieldLabel: "All Locations", valueLabel: allLocations.map((item) => cleanText(item.formattedAddress)).filter(Boolean).join(" | ") },
    ],
  };

  const normalized = normalizeDiscoveryResult(discoveryResult, SOURCE, {
    industryConfig: eyecareConfig,
  });
  const roleTags = uniqueStrings([...(normalized.roleTags || []), ...roleTagsForCategory(category)]);

  Object.assign(normalized, {
    company: SOURCE.employerBrand,
    parentCompany: SOURCE.parentCompany,
    employerBrand: SOURCE.employerBrand,
    practiceName: null,
    sourcePostedAt,
    sourceUpdatedAt,
    sourcePostingAgeDays,
    freshnessCheckedAt: new Date().toISOString(),
    evergreen: Number.isInteger(sourcePostingAgeDays) && sourcePostingAgeDays > EVERGREEN_AGE_DAYS,
    evergreenReason:
      Number.isInteger(sourcePostingAgeDays) && sourcePostingAgeDays > EVERGREEN_AGE_DAYS
        ? `Source posting age is ${sourcePostingAgeDays} days, exceeding the ${EVERGREEN_AGE_DAYS}-day evergreen threshold.`
        : null,
    atsProvider: SOURCE.atsProvider,
    listingSource: "imported",
    listingTier: "imported",
    listingOpportunityType: "job",
    locationPrecision: location?.locationType === 1 ? "facility" : normalized.location ? "city" : "unknown",
    roleTags,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    dayforceJobPostingId: posting.jobPostingId,
    dayforceJobReqId: posting.jobReqId,
    dayforceJobBoardId: posting.jobBoardId,
    dayforceBoardCode: posting.sourceBoardCode,
    sourceRoleCategory: category,
  });

  const classificationSummary = classifyJobForReview({
    ...normalized,
    rawTitle: discoveryResult.rawTitle,
    rawDescription: discoveryResult.rawDescription,
    rawLocation: discoveryResult.rawLocation,
  });
  normalized.classificationSummary = classificationSummary;
  normalized.primaryRole = classificationSummary.primaryRole;
  normalized.secondaryRole = classificationSummary.secondaryRole;
  normalized.specialty = classificationSummary.specialty;
  normalized.practiceType = classificationSummary.practiceType;
  normalized.compensationSummary = classificationSummary.compensationSummary;
  normalized.jobsVisionRelevant = classificationSummary.jobsVisionRelevant;
  normalized.recommendation = classificationSummary.recommendation;
  normalized.recommendationReason = classificationSummary.recommendationReason;
  normalized.classificationConfidenceScore = classificationSummary.confidenceScore;
  normalized.roleBadge = classificationSummary.roleBadge;
  normalized.duplicateKey = createDuplicateKey(normalized);

  return {
    discoveryResult,
    normalizedJob: normalized,
    category,
    detail,
  };
}

function summarizeInventory(postings) {
  const summary = {
    total: postings.length,
    relevantTotal: 0,
    optometrist: 0,
    optician: 0,
    optical_manager: 0,
    optical_technician: 0,
    front_desk: 0,
    optical_sales: 0,
    other_relevant: 0,
    excluded_or_other: 0,
    freshness: emptyFreshness(),
    topTitles: {},
  };

  for (const posting of postings) {
    const category = roleCategoryForPosting(posting);
    const days = ageDays(posting.postingStartTimestampUTC);
    const bucket = freshnessBucket(days);
    increment(summary.freshness, bucket);
    increment(summary.topTitles, cleanText(posting.jobTitle));

    if (Object.prototype.hasOwnProperty.call(summary, category)) {
      summary[category] += 1;
      summary.relevantTotal += 1;
    } else {
      summary.excluded_or_other += 1;
    }
  }

  summary.topTitles = Object.entries(summary.topTitles)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 25)
    .map(([title, count]) => ({ title, count }));

  return summary;
}

function selectBalancedSample(postings, limit) {
  const byCategory = new Map(TARGET_SAMPLE_CATEGORIES.map((category) => [category, []]));
  for (const posting of postings) {
    const category = roleCategoryForPosting(posting);
    if (byCategory.has(category)) byCategory.get(category).push(posting);
  }

  const selected = [];
  const add = (posting) => {
    const key = String(posting.jobPostingId);
    if (!selected.some((item) => String(item.jobPostingId) === key)) selected.push(posting);
  };
  const targetPerCategory = Math.max(1, Math.ceil(limit / TARGET_SAMPLE_CATEGORIES.length));

  for (const category of TARGET_SAMPLE_CATEGORIES) {
    for (const posting of byCategory.get(category).slice(0, targetPerCategory)) {
      if (selected.length < limit) add(posting);
    }
  }

  for (const category of TARGET_SAMPLE_CATEGORIES) {
    for (const posting of byCategory.get(category)) {
      if (selected.length >= limit) break;
      add(posting);
    }
  }

  return selected.slice(0, limit);
}

function selectFullImportPostings(postings, limit) {
  return postings
    .filter((posting) => FULL_IMPORT_CATEGORIES.has(roleCategoryForPosting(posting)))
    .slice(0, limit);
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

function summarizeValidationJobs(jobs) {
  const summary = {
    total: jobs.length,
    classifier: { approve: 0, reject: 0, review: 0 },
    roles: {
      optometrist: 0,
      optician: 0,
      optical_manager: 0,
      optical_technician: 0,
      front_desk: 0,
      optical_sales: 0,
      other_relevant: 0,
      excluded: 0,
      other: 0,
    },
    roleBadges: {},
    freshness: emptyFreshness(),
  };

  for (const item of jobs) {
    const recommendation = String(item.normalizedJob.recommendation || "review").toLowerCase();
    increment(summary.classifier, recommendation);
    increment(summary.roles, item.category);
    increment(summary.roleBadges, item.normalizedJob.roleBadge || "UNKNOWN");
    increment(summary.freshness, freshnessBucket(item.normalizedJob.sourcePostingAgeDays));
  }

  return summary;
}

async function countExistingDuplicateKeys(keys) {
  if (!keys.length) return 0;
  const result = await pool.query(
    "select count(*)::int as count from public.job_imports where duplicate_key = any($1::text[])",
    [keys]
  );
  return Number(result.rows?.[0]?.count || 0);
}

async function main() {
  const options = parseArgs();
  const robotsText = await fetchRobots();
  for (const board of BOARDS) {
    assertAllowed(board.url, robotsText);
    await fetchSiteContext(board, robotsText);
  }

  const boardResults = [];
  for (const board of BOARDS) {
    boardResults.push(await fetchBoardInventory(board, robotsText, options));
  }

  const allPostings = dedupePostings(boardResults.flatMap((result) => result.postings));
  const inventory = summarizeInventory(allPostings);
  const selectedPostings = options.full
    ? selectFullImportPostings(allPostings, options.limit)
    : selectBalancedSample(allPostings, options.limit);

  const validationJobs = (
    await mapConcurrent(selectedPostings, options.concurrency, async (posting) => {
      const detail = await fetchPostingDetail(posting, robotsText);
      if (options.pageDelayMs) await sleep(options.pageDelayMs);
      return normalizeDetail(posting, detail);
    })
  ).filter(Boolean);

  const duplicateKeys = validationJobs.map((item) => item.normalizedJob.duplicateKey).filter(Boolean);
  const existingDuplicates = options.dryRun ? 0 : await countExistingDuplicateKeys(duplicateKeys);
  const savedRows = options.dryRun
    ? []
    : await saveDiscoveryRun(
        {
          source: SOURCE,
          discoveredAt: new Date().toISOString(),
          notes: [
            options.full ? "VisionWorks Dayforce full acquisition import." : "VisionWorks Dayforce validation sample only.",
            "Public Dayforce search endpoint was used with the CSRF token flow from the Dayforce app.",
            "This script does not publish jobs.",
          ],
          jobs: validationJobs.map(({ discoveryResult, normalizedJob }) => ({
            discoveryResult,
            normalizedJob,
          })),
        },
        { discoveredBy: options.full ? "script:visionworks-dayforce-full-acquisition" : "script:visionworks-dayforce-validation" }
      );

  const validation = summarizeValidationJobs(validationJobs);

  console.log(
    JSON.stringify(
      {
        mode: options.dryRun ? "dry-run" : "import",
        full: options.full,
        sourceInfrastructure: {
          atsProvider: "Dayforce",
          careersUrl: `${ORIGIN}/visionworks/CANDIDATEPORTAL`,
          subleaseUrl: `${ORIGIN}/visionworks/Sublease-OD`,
          siteContextEndpoint: `${ORIGIN}/api/geo/visionworks/sitecontext/visionworks/{careerSiteXRefCode}/en-US`,
          searchEndpoint: `${ORIGIN}/api/geo/visionworks/jobposting/search`,
          searchMethod: "POST with NextAuth CSRF token header X-CSRF-TOKEN",
          searchPagination: "paginationStart increments by 25; response includes maxCount, count, offset, jobPostings",
          detailEndpoint: `${ORIGIN}/api/geo/visionworks/jobposting/visionworks/en-US/{jobBoardId}/{jobPostingId}`,
          detailUrlPattern: `${ORIGIN}/visionworks/{careerSiteXRefCode}/jobs/{jobPostingId}`,
          applyUrlPattern: `${ORIGIN}/visionworks/{careerSiteXRefCode}/jobs/{jobPostingId}/apply`,
          robotsUrl: `${ORIGIN}/robots.txt`,
        },
        boards: boardResults.map((result) => ({
          code: result.board.code,
          maxCount: result.maxCount,
          fetched: result.fetched,
        })),
        inventoryEstimate: inventory,
        validationSample: {
          requestedLimit: options.limit,
          selectedForImport: selectedPostings.length,
          fetchedDetails: validationJobs.length,
          importedOrUpdated: savedRows.length,
          existingDuplicates,
          duplicateRate:
            validationJobs.length > 0 ? Number(((existingDuplicates / validationJobs.length) * 100).toFixed(1)) : 0,
          classifier: validation.classifier,
          roles: validation.roles,
          roleBadges: validation.roleBadges,
          freshness: validation.freshness,
        },
        sampleExamples: validationJobs.slice(0, 12).map((item) => ({
          title: item.normalizedJob.title,
          employerBrand: item.normalizedJob.employerBrand,
          parentCompany: item.normalizedJob.parentCompany,
          location: item.normalizedJob.location,
          category: item.category,
          recommendation: item.normalizedJob.recommendation,
          roleBadge: item.normalizedJob.roleBadge,
          ageDays: item.normalizedJob.sourcePostingAgeDays,
          sourceUrl: item.normalizedJob.sourceUrl,
          applyUrl: item.normalizedJob.applyUrl,
        })),
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
