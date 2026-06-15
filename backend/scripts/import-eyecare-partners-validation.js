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
const ORIGIN = "https://careers.eyecare-partners.com";
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const ROBOTS_URL = `${ORIGIN}/robots.txt`;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

const SOURCE = {
  key: "eyecare-partners-validation",
  employerName: "EyeCare Partners",
  parentCompany: "EyeCare Partners",
  employerBrand: "EyeCare Partners",
  employerWebsiteUrl: "https://www.eyecare-partners.com/",
  careersUrl: "https://www.eyecare-partners.com/careers/",
  sourceType: "career_page",
  industryKey: "eyecare",
  atsProvider: "largely",
};

const TARGET_CATEGORIES = [
  "od",
  "optician",
  "ophthalmic_technician",
  "front_desk",
  "practice_manager",
];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const valueFor = (name, fallback) => {
    const prefix = `${name}=`;
    const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
  };

  return {
    dryRun: !args.has("--import"),
    full: args.has("--full"),
    limit: args.has("--full")
      ? Math.max(1, Number(valueFor("--limit", 10000)) || 10000)
      : Math.min(MAX_LIMIT, Math.max(1, Number(valueFor("--limit", DEFAULT_LIMIT)) || DEFAULT_LIMIT)),
    concurrency: Math.min(12, Math.max(1, Number(valueFor("--concurrency", 6)) || 6)),
    pageDelayMs: Math.max(0, Number(valueFor("--page-delay-ms", 100)) || 0),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, accept = "text/html,text/plain;q=0.8,*/*;q=0.5") {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: accept,
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.text();
}

async function assertAllowed(url, robotsText) {
  if (!isAllowedByRobots(url, robotsText, USER_AGENT)) {
    throw new Error(`robots.txt disallows ${url}`);
  }
}

function extractSitemapUrls(xml) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
    .map((match) => cleanText(match[1]))
    .filter((url) => /^https:\/\/careers\.eyecare-partners\.com\/job\//i.test(url));
}

function slugFromJobUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] !== "job") return "";
    return decodeURIComponent(segments.length >= 3 ? segments.slice(2).join("-") : segments[1] || "");
  } catch {
    return "";
  }
}

function titleFromUrl(url) {
  return cleanText(
    slugFromJobUrl(url)
      .replace(/---[A-Za-z0-9_]+$/g, "")
      .replace(/---/g, " - ")
      .replace(/--/g, " ")
      .replace(/[-_]+/g, " ")
      .replace(/\s+\b\d{4,}\b$/g, "")
  );
}

function sourceBrandFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 3) {
      const sourceSegment = decodeURIComponent(segments[1] || "");
      if (!sourceSegment || /^EyeCarePartners$/i.test(sourceSegment)) return null;
      return cleanText(sourceSegment.replace(/[-_]+/g, " "));
    }

    const title = titleFromUrl(url);
    const knownPractice = title.match(
      /\b(Clarkson Eyecare(?: Virginia)?|Commonwealth Eye Care Associates|Virginia Eye Consultants|Cincinnati Eye Institute|Bennett Bloom Eye Centers|EyeCare Associates|Retina Associates of Kentucky|Crown Vision Center|Nationwide Vision(?: Center)?|Quantum Vision Centers)\b/i
    );
    return cleanText(knownPractice?.[1]) || null;
  } catch {
    return null;
  }
}

function isExcludedTitle(title) {
  const text = cleanText(title).toLowerCase();
  return (
    !text ||
    /\b(ophthalmologist|surgeon|surgery|surgical|cornea|retina|vitreoretinal|glaucoma|oculoplastic|physician assistant)\b/.test(text) ||
    /\b(registered nurse|rn\b|lpn\b|nurse|anesthesia|scrub tech|sterile processing)\b/.test(text) ||
    /\b(accountant|accounting|finance|financial|analyst|hr\b|human resources|recruiter|recruiting|marketing|legal|counsel|procurement|payroll|revenue cycle|credentialing|billing|claims|customer service representative|call center)\b/.test(text)
  );
}

function categoryForTitle(title) {
  const text = cleanText(title).toLowerCase();
  if (isExcludedTitle(text)) return null;
  if (/\b(optometrist|optometry|od\b|doctor of optometry)\b/.test(text)) return "od";
  if (/\b(licensed optician|optician|optical technician|optical sales|contact lens tech)\b/.test(text)) return "optician";
  if (/\b(ophthalmic technician|optometric technician|medical assistant|doctor'?s assistant|doctors assistant|pre[-\s]?tester|scribe|technician)\b/.test(text)) {
    return "ophthalmic_technician";
  }
  if (/\b(front office|front desk|medical receptionist|patient coordinator|patient educator|patient service|receptionist)\b/.test(text)) {
    return "front_desk";
  }
  if (/\b(practice manager|office manager|assistant office manager|optical manager|manager)\b/.test(text)) {
    return "practice_manager";
  }
  return null;
}

function estimateInventory(urls) {
  const counts = {
    totalJobs: urls.length,
    relevantJobs: 0,
    od: 0,
    optician: 0,
    ophthalmic_technician: 0,
    front_desk: 0,
    practice_manager: 0,
    excludedOrOther: 0,
  };

  for (const url of urls) {
    const category = categoryForTitle(titleFromUrl(url));
    if (category) {
      counts.relevantJobs += 1;
      counts[category] += 1;
    } else {
      counts.excludedOrOther += 1;
    }
  }

  return counts;
}

function selectBalancedSample(urls, limit) {
  const byCategory = new Map(TARGET_CATEGORIES.map((category) => [category, []]));
  for (const url of urls) {
    const category = categoryForTitle(titleFromUrl(url));
    if (category && byCategory.has(category)) {
      byCategory.get(category).push(url);
    }
  }

  const selected = [];
  const targetPerCategory = Math.max(1, Math.ceil(limit / TARGET_CATEGORIES.length));
  for (const category of TARGET_CATEGORIES) {
    for (const url of byCategory.get(category).slice(0, targetPerCategory)) {
      if (selected.length < limit && !selected.includes(url)) selected.push(url);
    }
  }

  for (const category of TARGET_CATEGORIES) {
    for (const url of byCategory.get(category)) {
      if (selected.length >= limit) break;
      if (!selected.includes(url)) selected.push(url);
    }
  }

  return selected;
}

function selectFullImportUrls(urls, limit) {
  return urls.filter((url) => categoryForTitle(titleFromUrl(url))).slice(0, limit);
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

function decodeEntities(value = "") {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, "-");
}

function extractTitle(html, fallback) {
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  return cleanText(decodeEntities(title)) || fallback;
}

function extractApplyUrl(html, sourceUrl) {
  const matches = Array.from(
    html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(?:\s|<[^>]+>)*Apply(?:\s|&nbsp;)+Now(?:\s|<[^>]+>)*<\/a>/gi)
  ).map((match) => normalizeUrl(decodeEntities(match[1]), sourceUrl));
  return matches.find((url) => /eyecare-partners\.com\/careers/i.test(url || "")) || matches[0] || sourceUrl;
}

function extractChipValues(html) {
  return Array.from(html.matchAll(/<span class="[^"]*MuiChip-label[^"]*">([^<]+)<\/span>/gi))
    .map((match) => cleanText(decodeEntities(match[1])))
    .filter(Boolean);
}

function parseRelativeAgeDays(value) {
  const text = cleanText(value).toLowerCase();
  if (!text || !/\bago\b/.test(text)) return null;
  if (/\d+\s*(s|sec|second|m|min|minute|h|hr|hour)\b/.test(text)) return 0;
  const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = numberMatch ? Number(numberMatch[1]) : 1;
  if (!Number.isFinite(amount)) return null;
  if (/\d+\s*d\b|\bday\b/.test(text)) return Math.floor(amount);
  if (/\d+\s*w\b|\bweek\b/.test(text)) return Math.floor(amount * 7);
  if (/\bmonth\b/.test(text)) return Math.floor(amount * 30);
  if (/\byear\b/.test(text)) return Math.floor(amount * 365);
  return null;
}

function dateFromAgeDays(ageDays, asOf = new Date()) {
  if (!Number.isInteger(ageDays)) return null;
  return new Date(asOf.getTime() - ageDays * 86400000).toISOString();
}

function extractDescription(html) {
  const match = html.match(/<div class="TangramJobDescription[\s\S]*?<\/div><div class="TangramRichText/i);
  if (match) return truncate(cleanText(decodeEntities(match[0])), 30000) || null;

  const body = html.match(/<body[\s\S]*?<\/body>/i)?.[0] || html;
  return truncate(cleanText(decodeEntities(body)), 30000) || null;
}

function inferPracticeName({ url, html, description }) {
  const fromUrl = sourceBrandFromUrl(url);
  if (fromUrl) return fromUrl;

  const homeLink = Array.from(html.matchAll(/<a[^>]+href="https?:\/\/(?:www\.)?([^\/"]+)"[^>]*>\s*Home\s*<\/a>/gi))
    .map((match) => match[1])
    .find((host) => !/eyecare-partners\.com|largely\.com/i.test(host || ""));
  if (homeLink) {
    return cleanText(
      homeLink
        .replace(/\.(com|org|net)$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  const linkedPractice = description.match(/At\s+([A-Z][A-Za-z0-9'&.\s-]{2,60}?)(?:,|\s+our|\s+is\s+a\s+proud|\s+we\s+)/);
  return cleanText(linkedPractice?.[1]) || null;
}

function roleBreakdownKey(job) {
  const title = job.title || job.rawTitle || "";
  const roleBadge = String(job.roleBadge || "").toUpperCase();
  const primaryRole = String(job.primaryRole || "").toLowerCase();
  const category = categoryForTitle(title);
  if (category) return category;
  if (roleBadge === "OD" || primaryRole.includes("optometrist")) return "od";
  if (roleBadge === "OPTICIAN" || primaryRole.includes("optician")) return "optician";
  if (roleBadge === "TECH" || primaryRole.includes("technician")) return "ophthalmic_technician";
  if (roleBadge === "FRONT_DESK" || primaryRole.includes("front")) return "front_desk";
  if (roleBadge === "MANAGER" || primaryRole.includes("manager")) return "practice_manager";
  return "other";
}

function freshnessBucket(ageDays) {
  if (!Number.isInteger(ageDays)) return "unknown";
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  if (ageDays <= 180) return "91-180";
  return "180+";
}

async function detailResultFromUrl(url) {
  const html = await fetchText(url);
  const title = extractTitle(html, titleFromUrl(url));
  const applyUrl = extractApplyUrl(html, url);
  const chipValues = extractChipValues(html);
  const location = chipValues.find((value) => /,\s*[A-Z]{2,3}$/i.test(value) && !/\bago\b/i.test(value)) || null;
  const relativeAgeLabel = chipValues.find((value) => /\bago\b/i.test(value)) || null;
  const sourcePostingAgeDays = parseRelativeAgeDays(relativeAgeLabel);
  const sourcePostedAt = dateFromAgeDays(sourcePostingAgeDays);
  const description = extractDescription(html);
  const practiceName = inferPracticeName({ url, html, description: description || "" });
  const employerBrand = practiceName || SOURCE.employerBrand;

  return {
    sourceUrl: url,
    discoveredAt: new Date().toISOString(),
    rawTitle: title,
    rawLocation: location,
    rawDescription: description,
    applyUrl,
    requisitionId: applyUrl.match(/[?&]gh_jid=([^&]+)/i)?.[1] || url.match(/-([A-Za-z0-9_]+)$/)?.[1] || null,
    sourcePostedAt,
    sourceUpdatedAt: null,
    sourcePostingAgeDays,
    employerName: employerBrand,
    sourceType: SOURCE.sourceType,
    atsProvider: SOURCE.atsProvider,
    confidenceScore: 0,
    extractionNotes: [
      "Extracted from EyeCare Partners Largely sitemap and public job detail page.",
      "Validation sample only; not a full acquisition run.",
      relativeAgeLabel
        ? `Freshness inferred from detail page relative label: ${relativeAgeLabel}.`
        : "No freshness label found on detail page.",
      "Candidate apply URL uses employer-owned eyecare-partners.com careers route when present.",
    ],
    classification: "job_posting",
    customFields: [
      { fieldLabel: "Parent Company", valueLabel: SOURCE.parentCompany },
      { fieldLabel: "Practice", valueLabel: practiceName || "" },
      { fieldLabel: "Freshness Label", valueLabel: relativeAgeLabel || "" },
    ],
    practiceName,
    employerBrand,
  };
}

function normalizeForImport(result) {
  const source = {
    ...SOURCE,
    employerName: result.employerBrand || SOURCE.employerName,
    employerBrand: result.employerBrand || SOURCE.employerBrand,
  };
  const normalizedJob = normalizeDiscoveryResult(result, source, {
    industryConfig: eyecareConfig,
  });

  return {
    discoveryResult: result,
    normalizedJob: {
      ...normalizedJob,
      parentCompany: SOURCE.parentCompany,
      employerBrand: result.employerBrand || SOURCE.employerBrand,
      practiceName: result.practiceName || null,
      sourcePostedAt: result.sourcePostedAt || null,
      sourceUpdatedAt: result.sourceUpdatedAt || null,
      sourcePostingAgeDays: result.sourcePostingAgeDays,
      freshnessCheckedAt: new Date().toISOString(),
      atsProvider: SOURCE.atsProvider,
      listingSource: "imported",
      listingTier: "imported",
      listingOpportunityType: "job",
      locationPrecision: normalizedJob.location ? "city" : "unknown",
      status: "needs_review",
    },
  };
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function summarizeJobs(jobs) {
  const summary = {
    recommendations: {},
    roles: {
      od: 0,
      optician: 0,
      ophthalmic_technician: 0,
      front_desk: 0,
      practice_manager: 0,
      other: 0,
    },
    freshness: {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "91-180": 0,
      "180+": 0,
      unknown: 0,
    },
  };

  for (const item of jobs) {
    const job = item.normalizedJob;
    increment(summary.recommendations, String(job.recommendation || "review").toLowerCase());
    increment(summary.roles, roleBreakdownKey(job));
    increment(summary.freshness, freshnessBucket(job.sourcePostingAgeDays));
  }

  return summary;
}

async function countExistingDuplicateKeys(keys) {
  if (!keys.length) return 0;
  const result = await pool.query(
    "select count(*)::int as count from public.job_imports where duplicate_key = any($1::text[])",
    [keys]
  );
  return result.rows[0]?.count || 0;
}

async function main() {
  const options = parseArgs();
  const robotsText = await fetchText(ROBOTS_URL, "text/plain,*/*;q=0.5");
  await assertAllowed(SITEMAP_URL, robotsText);

  const sitemap = await fetchText(SITEMAP_URL, "application/xml,text/xml,text/plain;q=0.8,*/*;q=0.5");
  const urls = extractSitemapUrls(sitemap);
  const estimate = estimateInventory(urls);
  const selectedUrls = options.full ? selectFullImportUrls(urls, options.limit) : selectBalancedSample(urls, options.limit);

  const detailResults = (
    await mapConcurrent(selectedUrls, options.concurrency, async (url) => {
    await assertAllowed(url, robotsText);
      const result = await detailResultFromUrl(url);
      if (options.pageDelayMs) await sleep(options.pageDelayMs);
      return result;
    })
  ).filter(Boolean);

  const jobs = detailResults
    .map(normalizeForImport)
    .filter((item) => item.normalizedJob.applyUrl && item.normalizedJob.location);
  const duplicateKeys = jobs.map((item) => item.normalizedJob.duplicateKey).filter(Boolean);
  const existingDuplicates = options.dryRun ? 0 : await countExistingDuplicateKeys(duplicateKeys);
  const saved = options.dryRun
    ? []
    : await saveDiscoveryRun(
        {
          source: SOURCE,
          notes: [
            options.full ? "EyeCare Partners full acquisition import." : "EyeCare Partners validation sample only.",
            "Public sitemap and public job detail pages were used.",
            "This script does not publish jobs.",
          ],
          jobs,
        },
        { discoveredBy: options.full ? "script:eyecare-partners-full-acquisition" : "eyecare-partners-validation" }
      );

  const summary = summarizeJobs(jobs);
  const examples = jobs.slice(0, 10).map(({ normalizedJob, discoveryResult }) => ({
    title: normalizedJob.title,
    company: normalizedJob.company,
    employerBrand: normalizedJob.employerBrand,
    parentCompany: normalizedJob.parentCompany,
    practiceName: normalizedJob.practiceName,
    location: normalizedJob.location,
    applyUrl: normalizedJob.applyUrl,
    sourceUrl: normalizedJob.sourceUrl,
    freshnessAgeDays: normalizedJob.sourcePostingAgeDays,
    recommendation: normalizedJob.recommendation,
    roleBadge: normalizedJob.roleBadge,
    freshnessLabel:
      discoveryResult.customFields.find((field) => field.fieldLabel === "Freshness Label")?.valueLabel || null,
  }));

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        full: options.full,
        source: {
          atsProvider: SOURCE.atsProvider,
          careersUrl: SOURCE.careersUrl,
          searchEndpoint: "https://careers.eyecare-partners.com/jobs/EyeCarePartners/All-Opportunities",
          doctorSearchEndpoint: "https://careers.eyecare-partners.com/jobs/EyeCarePartners/Doctor-Careers",
          sitemap: SITEMAP_URL,
          detailEndpointPattern: `${ORIGIN}/job/{network-or-brand}/{slug}`,
          applyUrlPattern: "https://www.eyecare-partners.com/careers/{current-job-openings|doctors-careers}/{optional-id}?gh_jid={greenhouseJobId}",
          robots: {
            url: ROBOTS_URL,
            allowedPathsUsed: ["/sitemap.xml", "/job/..."],
          },
        },
        estimate,
        validationSample: {
          requestedLimit: options.limit,
          selectedForImport: selectedUrls.length,
          fetchedDetails: detailResults.length,
          normalizedEligible: jobs.length,
          existingDuplicates,
          importedOrUpdated: saved.length,
          skippedForMissingApplyOrLocation: detailResults.length - jobs.length,
        },
        classifier: summary.recommendations,
        roleBreakdown: summary.roles,
        freshness: summary.freshness,
        examples,
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
