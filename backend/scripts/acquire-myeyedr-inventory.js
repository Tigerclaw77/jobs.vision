const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config();

const { pool, query } = require("../services/db");
const { saveDiscoveryRun } = require("../services/jobImportRepository");
const eyecareConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const { normalizeDiscoveryResult } = require("../../src/lib/job-discovery/normalizer");
const { classifyJobForReview } = require("../../src/lib/job-discovery/classifier");
const {
  cleanText,
  createDuplicateKey,
  stableLower,
  truncate,
  uniqueStrings,
} = require("../../src/lib/job-discovery/utils");

const BRAND = "MyEyeDr.";
const CAREERS_URL = "https://careers.myeyedr.com";
const SEARCH_URL = `${CAREERS_URL}/search/jobs`;
const DIRECT_JOBVITE_BOARD = "https://jobs.jobvite.com/myeyedr";
const CURRENT_RUN_AT = new Date();
const execFileAsync = promisify(execFile);

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const entry = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

const OPTIONS = {
  dbSummary: process.argv.includes("--db-summary"),
  importJobs: process.argv.includes("--import"),
  dryRun: process.argv.includes("--dry-run") || !process.argv.includes("--import"),
  skipDetails: process.argv.includes("--skip-details"),
  fetchDetails: process.argv.includes("--fetch-details"),
  limit: Number(argValue("--limit", 0)) || null,
  maxPages: Number(argValue("--max-pages", 40)) || 40,
  sourceTotalOverride: Number(argValue("--source-total", 0)) || null,
  sourcePagesOverride: Number(argValue("--source-pages", 0)) || null,
  concurrency: Math.min(10, Math.max(1, Number(argValue("--concurrency", 5)) || 5)),
  pageDelayMs: Math.max(0, Number(argValue("--page-delay-ms", 400)) || 0),
  fetchRetries: Math.max(1, Number(argValue("--fetch-retries", 4)) || 4),
  passes: Math.max(1, Number(argValue("--passes", 3)) || 3),
  verbose: process.argv.includes("--verbose"),
};

if (OPTIONS.importJobs) {
  OPTIONS.dryRun = false;
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const SOURCE = {
  employerName: BRAND,
  employerWebsiteUrl: "https://www.myeyedr.com",
  careersUrl: SEARCH_URL,
  industryKey: "eyecare",
  sourceType: "career_page",
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqBy(values, keyFn) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = keyFn(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function parseUrl(url, baseUrl = CAREERS_URL) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function parseJobId(sourceUrl) {
  try {
    const match = new URL(sourceUrl).pathname.match(/\/jobs\/(\d+)-([^/]+)/i);
    return match
      ? {
          requisitionId: match[1],
          slug: match[2],
        }
      : { requisitionId: null, slug: null };
  } catch {
    return { requisitionId: null, slug: null };
  }
}

function parseInteger(value) {
  const numeric = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCloudflareChallenge(html) {
  return /Just a moment|challenge-platform|cf-browser-verification/i.test(
    String(html || "")
  );
}

async function fetchTextWithCurl(url) {
  try {
    const { stdout } = await execFileAsync(
      "curl.exe",
      [
        "-L",
        "--silent",
        "--show-error",
        "--connect-timeout",
        "5",
        "--max-time",
        "12",
        "-A",
        FETCH_HEADERS["User-Agent"],
        url,
      ],
      { maxBuffer: 25 * 1024 * 1024, windowsHide: true }
    );
    return stdout;
  } catch (error) {
    if (error.stdout) return error.stdout;
    if (OPTIONS.verbose) {
      console.error(`curl fetch failed for ${url}: ${error.message}`);
    }
    return "";
  }
}

function parsePostedAt(value) {
  const text = cleanText(value);
  const match = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return null;

  const monthIndex = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  }[match[1].toLowerCase()];

  if (!Number.isInteger(monthIndex)) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ageDaysFromPostedAt(postedAt) {
  if (!postedAt) return null;
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((CURRENT_RUN_AT.getTime() - date.getTime()) / 86400000));
}

function bucketAge(ageDays) {
  if (!Number.isInteger(ageDays)) return "unknown";
  if (ageDays <= 30) return "0-30 days";
  if (ageDays <= 60) return "31-60 days";
  if (ageDays <= 90) return "61-90 days";
  if (ageDays <= 180) return "91-180 days";
  return "180+ days";
}

function emptyFreshnessBuckets() {
  return {
    "0-30 days": 0,
    "31-60 days": 0,
    "61-90 days": 0,
    "91-180 days": 0,
    "180+ days": 0,
    unknown: 0,
  };
}

function countFreshness(jobs) {
  const buckets = emptyFreshnessBuckets();
  for (const job of jobs) {
    buckets[bucketAge(job.sourcePostingAgeDays)] += 1;
  }
  return buckets;
}

async function fetchText(url) {
  if (/^https:\/\/careers\.myeyedr\.com\//i.test(url)) {
    let lastHtml = "";
    for (let attempt = 1; attempt <= OPTIONS.fetchRetries; attempt += 1) {
      lastHtml = await fetchTextWithCurl(url);
      if (!isCloudflareChallenge(lastHtml)) return lastHtml;
      await sleep(750 * attempt);
    }
    return lastHtml;
  }

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
    });

    if (response.ok) {
      return response.text();
    }

    if (![403, 429].includes(response.status)) {
      throw new Error(`HTTP ${response.status} fetching ${url}`);
    }
  } catch (error) {
    if (!/fetch failed/i.test(error.message || "")) {
      throw error;
    }
  }

  return fetchTextWithCurl(url);
}

function parseTotalOpenings(html) {
  const text = cleanText(html);
  const match = text.match(/Showing\s+\d+\s*-\s*\d+\s+of\s+([\d,]+)\s+results/i);
  return parseInteger(match?.[1]);
}

function parsePageCount(html) {
  const matches = Array.from(html.matchAll(/\/search\/jobs(?:\/in)?\?page=(\d+)/gi));
  const pageNumbers = matches.map((match) => Number(match[1])).filter(Number.isInteger);
  return pageNumbers.length ? Math.max(...pageNumbers) : 1;
}

function countLabel(cleanedHtmlText, label) {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*\\(?([\\d,]+)\\)?`, "i");
  return parseInteger(cleanedHtmlText.match(pattern)?.[1]);
}

function parseSourceFacetCounts(html) {
  const facets = parseFacetLinks(html);
  const countFor = (label) =>
    parseInteger(
      facets.find((facet) => facet.label.toLowerCase() === label.toLowerCase())?.count
    );
  return {
    jobType: {
      fullTimeAssociate: countFor("Full Time Associate"),
      partTimeAssociate: countFor("Part Time Associate"),
      fullTimeOptometrist: countFor("Full Time Optometrist (OD)"),
      partTimeOptometrist: countFor("Part Time Optometrist (OD)"),
      remoteOptometrist: countFor("Remote Optometrist (OD)"),
      intern: countFor("Intern"),
    },
    areaOfFocus: {
      fieldAssociatesManagersRetailOperationsClinical: countFor(
        "Field Associates and Managers - Retail, Operations, and Clinical Support"
      ),
      optometristsExterns: countFor("Optometrists and Externs"),
      homeOfficeDistributionFieldLeadership: countFor(
        "Home Office, Distribution Center, and Field Leadership"
      ),
    },
    department: {
      retailSalesOfficeOperations: countFor("Retail Sales and Office Operations"),
      optometrist: countFor("Optometrist (OD)"),
      clinicalSupport: countFor("Clinical Support"),
      fieldOfficeManagement: countFor("Field Office Management"),
      fieldOfficeMultiUnitLeadership: countFor("Field Office Multi-Unit Leadership"),
      financeAccounting: countFor("Finance and Accounting"),
      marketing: countFor("Marketing"),
      humanResources: countFor("Human Resources"),
      internalOperations: countFor("Internal Operations"),
      managedVisionCareInsurance: countFor("Managed Vision Care and Insurance Processing"),
    },
    links: facets,
  };
}

function parseFacetLinks(html) {
  const entries = [];
  const pattern =
    /<a\s+href="([^"]+)"\s+class="facet-item__option-link js">[\s\S]*?<span class="facet-item__option-item-label">([\s\S]*?)<\/span>[\s\S]*?<span class="facet-item__option-item-count">([\d,]+)/gi;
  for (const match of html.matchAll(pattern)) {
    entries.push({
      href: parseUrl(match[1]),
      label: cleanText(match[2]),
      count: parseInteger(match[3]),
    });
  }
  return entries;
}

function parseLocation(block) {
  const withoutLabel = String(block || "")
    .replace(/<span[^>]*>\s*Location:\s*<\/span>/gi, " ")
    .replace(/<br\s*\/?>/gi, ", ");
  return cleanText(withoutLabel).replace(/\s*,\s*/g, ", ").replace(/,\s*$/, "");
}

function parseJobCards(html) {
  const blocks = html.split(/<div class="jobs-section__item padded-v-small">/i).slice(1);
  return blocks
    .map((block) => {
      const link = block.match(/<a\s+href="([^"]*\/jobs\/[^"]+)">([\s\S]*?)<\/a>/i);
      if (!link) return null;

      const sourceUrl = parseUrl(link[1]);
      const title = cleanText(link[2]);
      const locationBlock = block.match(
        /<div class="large-4 columns font-18 font-med"[^>]*>([\s\S]*?)<\/div>/i
      )?.[1];
      const postedText = cleanText(
        block.match(/Date Posted:\s*<\/span>([\s\S]*?)<\/div>/i)?.[1]
      );
      const areaFocus = cleanText(
        block.match(/Clearance:\s*<\/span>([\s\S]*?)<\/div>\s*-->/i)?.[1]
      );
      const postedAt = parsePostedAt(postedText);
      const ids = parseJobId(sourceUrl);

      return {
        title,
        sourceUrl,
        applyUrl: `${sourceUrl}/apply`,
        location: parseLocation(locationBlock),
        postedText,
        sourcePostedAt: postedAt,
        sourcePostingAgeDays: ageDaysFromPostedAt(postedAt),
        areaFocus,
        ...ids,
      };
    })
    .filter(Boolean);
}

function sourceUrlForPage(page) {
  if (page <= 1) return `${SEARCH_URL}?page=1`;
  return `${SEARCH_URL}/in?page=${page}`;
}

async function fetchSearchInventory() {
  let sourceTotal = OPTIONS.sourceTotalOverride;
  let sourcePages = OPTIONS.sourcePagesOverride;
  let sourceFacetCounts = null;
  const pageJobs = new Map();
  const pageAttempts = new Map();

  for (let pass = 1; pass <= OPTIONS.passes; pass += 1) {
    const pageLimit = Math.min(OPTIONS.maxPages, sourcePages || OPTIONS.maxPages);
    for (let page = 1; page <= pageLimit; page += 1) {
      if (pageJobs.has(page)) continue;
      const html = await fetchText(sourceUrlForPage(page));
      pageAttempts.set(page, (pageAttempts.get(page) || 0) + 1);

      if (page === 1) {
        sourceTotal = sourceTotal || parseTotalOpenings(html);
        sourcePages = sourcePages || parsePageCount(html);
        sourceFacetCounts = parseSourceFacetCounts(html);
      }

      const jobs = parseJobCards(html);
      if (OPTIONS.verbose) {
        console.error(`Fetched MyEyeDr. page ${page} pass ${pass}: ${jobs.length} job card(s).`);
      }
      if (jobs.length) {
        pageJobs.set(page, jobs);
      }

      if (OPTIONS.pageDelayMs) await sleep(OPTIONS.pageDelayMs);
    }

    const expectedPages = Math.min(OPTIONS.maxPages, sourcePages || OPTIONS.maxPages);
    if (pageJobs.size >= expectedPages) break;
    await sleep(1500 * pass);
  }

  const allJobs = Array.from(pageJobs.values()).flat();
  const fetchedPages = Array.from(pageJobs.keys()).sort((a, b) => a - b);
  const expectedPages = Math.min(OPTIONS.maxPages, sourcePages || OPTIONS.maxPages);
  const missingPages = Array.from({ length: expectedPages }, (_, index) => index + 1).filter(
    (page) => !pageJobs.has(page)
  );

  return {
    sourceTotal,
    sourcePages,
    sourceFacetCounts,
    pageCoverage: {
      expectedPages,
      fetchedPages: fetchedPages.length,
      missingPages,
      attempts: Object.fromEntries(pageAttempts),
    },
    jobs: uniqBy(allJobs, (job) => job.sourceUrl),
  };
}

const TITLE_EXCLUDE_PATTERNS = [
  /\bfinance\b/,
  /\baccounting\b/,
  /\bpayroll\b/,
  /\bhuman resources\b/,
  /\bhr\b/,
  /\brecruit(er|ing|ment)\b/,
  /\btalent acquisition\b/,
  /\bmarketing\b/,
  /\blegal\b/,
  /\bcounsel\b/,
  /\bprocurement\b/,
  /\bvendor\b/,
  /\bsupply chain\b/,
  /\bwarehouse\b/,
  /\bdistribution center\b/,
  /\bhome office\b/,
  /\binternal operations\b/,
  /\bmanaged vision care\b/,
  /\binsurance processing\b/,
  /\bbilling\b/,
  /\brevenue cycle\b/,
  /\baccounts?\s+receivable\b/,
  /\bdata analyst\b/,
  /\banalytics\b/,
  /\bdeveloper\b/,
  /\bengineer\b/,
  /\bit\b/,
  /\bcloud\b/,
  /\bsecurity\b/,
  /\bnurse\b/,
  /\brn\b/,
  /\blpn\b/,
  /\blvn\b/,
  /\bpharmacy\b/,
  /\bphysician assistant\b/,
  /\bmedical coder\b/,
  /\bdirector\b/,
  /\bdistrict manager\b/,
  /\bregional\b/,
  /\bvice president\b/,
  /\bvp\b/,
  /\bfield leadership\b/,
  /\bworkforce planning\b/,
  /\btraining manager\b/,
  /\blearning experience\b/,
  /\bpaid media\b/,
  /\bdigital experience\b/,
  /\bcreative\b/,
  /\bintegration planning\b/,
];

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function classifyMyEyeDrRole(job) {
  const title = stableLower(job.title);
  const area = stableLower(job.areaFocus);
  const fieldLeadership = area.includes("home office") || area.includes("field leadership");

  if (matchesAny(title, TITLE_EXCLUDE_PATTERNS) || fieldLeadership) {
    return {
      include: false,
      category: "excluded",
      reason: fieldLeadership ? "home_office_or_field_leadership" : "excluded_title",
      roleTags: [],
      industryTags: [],
      roleBadge: "OTHER",
    };
  }

  if (/\boptometrist\b|\bdoctor of optometry\b|\bod\b/.test(title)) {
    return {
      include: true,
      category: "od",
      reason: "target_optometrist",
      roleTags: ["optometrist"],
      industryTags: ["optometry"],
      roleBadge: "OD",
    };
  }

  if (/\blicensed optician\b|\boptician\b/.test(title)) {
    return {
      include: true,
      category: "optician",
      reason: "target_optician",
      roleTags: ["optician"],
      industryTags: ["optical"],
      roleBadge: "OPTICIAN",
    };
  }

  if (
    /\boptometric technician\b|\boptometric assistant\b|\bophthalmic technician\b|\bophthalmic assistant\b|\bmedical assistant\b|\btechnician\b/.test(
      title
    )
  ) {
    return {
      include: true,
      category: "technician",
      reason: "target_technician",
      roleTags: ["ophthalmic_technician"],
      industryTags: ["optometry", "ophthalmology"],
      roleBadge: "TECH",
    };
  }

  if (/\bfront desk\b|\bpatient service\b|\bpatient services\b|\bpatient coordinator\b|\breceptionist\b/.test(title)) {
    return {
      include: true,
      category: "front_desk",
      reason: "target_front_desk",
      roleTags: ["front_desk"],
      industryTags: ["practice_operations"],
      roleBadge: "FRONT_DESK",
    };
  }

  if (/\bpractice manager\b|\boffice manager\b|\boptical manager\b|\bgeneral manager\b|\bassistant general manager\b/.test(title)) {
    return {
      include: true,
      category: "manager",
      reason: "target_practice_or_optical_manager",
      roleTags: ["practice_manager"],
      industryTags: ["practice_operations", "optical"],
      roleBadge: "MANAGER",
    };
  }

  if (
    /\beyewear\b/.test(title) ||
    /\boptical sales\b|\bsales advisor\b|\bsales associate\b|\boptical associate\b|\bcustomer service\b/.test(title)
  ) {
    return {
      include: true,
      category: "optical",
      reason: "target_optical_sales",
      roleTags: ["optical_sales"],
      industryTags: ["optical"],
      roleBadge: "OPTICAL",
    };
  }

  return {
    include: false,
    category: "excluded",
    reason: "not_target_role",
    roleTags: [],
    industryTags: [],
    roleBadge: "UNKNOWN",
  };
}

function countInventoryByTitle(jobs) {
  const counts = {
    totalParsed: jobs.length,
    odOpenings: 0,
    opticianOpenings: 0,
    opticalOpenings: 0,
    technicianOpenings: 0,
    managerOpenings: 0,
    frontDeskOpenings: 0,
    excludedOrOther: 0,
  };

  for (const job of jobs) {
    const role = classifyMyEyeDrRole(job);
    if (role.category === "od") counts.odOpenings += 1;
    else if (role.category === "optician") counts.opticianOpenings += 1;
    else if (role.category === "optical") counts.opticalOpenings += 1;
    else if (role.category === "technician") counts.technicianOpenings += 1;
    else if (role.category === "manager") counts.managerOpenings += 1;
    else if (role.category === "front_desk") counts.frontDeskOpenings += 1;
    else counts.excludedOrOther += 1;
  }

  return counts;
}

function inferEmploymentTypeFromTitle(title) {
  const text = stableLower(title);
  if (/\bpart[-\s]?time\b/.test(text)) return "part_time";
  if (/\bfull[-\s]?time\b/.test(text)) return "full_time";
  return null;
}

function parseDetailDescription(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const markers = [
    /<p>\s*<b>\s*Description\s*<\/b>\s*<\/p>/i,
    /<b>\s*Description\s*<\/b>/i,
    /job-description/i,
  ];
  let start = -1;
  for (const marker of markers) {
    const match = main.match(marker);
    if (match?.index >= 0) {
      start = match.index;
      break;
    }
  }
  if (start < 0) start = 0;

  const endCandidates = [
    main.indexOf("<footer", start + 1),
    main.indexOf('<div class="row">', start + 1),
    main.indexOf("<script", start + 1),
  ].filter((index) => index > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : main.length;
  return truncate(cleanText(main.slice(start, end)), 30000);
}

async function enrichDetails(jobs) {
  if (OPTIONS.skipDetails || (OPTIONS.dryRun && !OPTIONS.fetchDetails)) {
    return jobs.map((job) => ({
      ...job,
      description: `${job.title} at ${BRAND}. Source posting details are available at ${job.sourceUrl}.`,
      detailFetched: false,
    }));
  }

  const output = new Array(jobs.length);
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      try {
        const html = await fetchText(job.sourceUrl);
        output[index] = {
          ...job,
          description:
            parseDetailDescription(html) ||
            `${job.title} at ${BRAND}. Source posting details are available at ${job.sourceUrl}.`,
          detailFetched: true,
        };
      } catch (error) {
        output[index] = {
          ...job,
          description: `${job.title} at ${BRAND}. Source posting details are available at ${job.sourceUrl}.`,
          detailFetched: false,
          detailError: error.message,
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(OPTIONS.concurrency, jobs.length) }, () => worker())
  );
  return output;
}

function buildDiscoveryResult(job, role) {
  const customFields = [
    { fieldLabel: "ATS Provider", valueLabel: "Jobvite" },
    { fieldLabel: "Source Search Endpoint", valueLabel: SEARCH_URL },
    { fieldLabel: "Direct Jobvite Board", valueLabel: DIRECT_JOBVITE_BOARD },
    { fieldLabel: "Area of Focus", valueLabel: job.areaFocus || null },
    { fieldLabel: "Source Posted At", valueLabel: job.sourcePostedAt || null },
    { fieldLabel: "MyEyeDr Role Filter", valueLabel: role.reason },
  ].filter((field) => field.valueLabel);

  return {
    sourceUrl: job.sourceUrl,
    discoveredAt: CURRENT_RUN_AT.toISOString(),
    rawTitle: job.title,
    rawLocation: job.location,
    rawDescription: job.description,
    applyUrl: job.applyUrl,
    confidenceScore: 96,
    extractionNotes: [
      `MyEyeDr. branded careers search endpoint ${SEARCH_URL}`,
      "Apply URL redirects to Jobvite app.jobvite.com apply flow.",
      `Role filter: ${role.reason}`,
    ],
    employerName: BRAND,
    sourceType: "career_page",
    atsProvider: "jobvite",
    customFields,
    classification: "job_posting",
    requisitionId: job.requisitionId,
  };
}

function normalizeMyEyeDrJob(discoveryResult, job, role) {
  const normalized = normalizeDiscoveryResult(discoveryResult, SOURCE, {
    industryConfig: eyecareConfig,
  });
  const roleTags = uniqueStrings([...(normalized.roleTags || []), ...role.roleTags]);
  const industryTags = uniqueStrings([...(normalized.industryTags || []), ...role.industryTags]);

  Object.assign(normalized, {
    company: BRAND,
    parentCompany: BRAND,
    employerBrand: BRAND,
    practiceName: BRAND,
    sourceType: "career_page",
    atsProvider: "jobvite",
    applyUrl: job.applyUrl,
    sourceUrl: job.sourceUrl,
    requisitionId: job.requisitionId,
    sourcePostedAt: job.sourcePostedAt,
    sourcePostingAgeDays: job.sourcePostingAgeDays,
    freshnessCheckedAt: CURRENT_RUN_AT.toISOString(),
    listingSource: "imported",
    listingTier: "imported",
    listingOpportunityType: "job",
    locationPrecision: job.location ? "facility" : "unknown",
    employmentType: normalized.employmentType || inferEmploymentTypeFromTitle(job.title),
    roleTags,
    industryTags,
    customFields: discoveryResult.customFields,
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

  return normalized;
}

function countBy(values, keyFn) {
  return values.reduce((acc, value) => {
    const key = keyFn(value) || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildInventoryEstimates(jobs, sourceFacetCounts) {
  const byTitle = countInventoryByTitle(jobs);
  const department = sourceFacetCounts?.department || {};
  const jobType = sourceFacetCounts?.jobType || {};
  return {
    sourceTotalEstimate: jobs.length,
    sourceFacetTotalEstimate:
      [
        jobType.fullTimeAssociate,
        jobType.partTimeAssociate,
        jobType.fullTimeOptometrist,
        jobType.partTimeOptometrist,
        jobType.remoteOptometrist,
        jobType.intern,
      ].filter(Number.isInteger).reduce((sum, count) => sum + count, 0) || null,
    byTitle,
    sourceFacetRoleEstimates: {
      odOpenings:
        [jobType.fullTimeOptometrist, jobType.partTimeOptometrist, jobType.remoteOptometrist]
          .filter(Number.isInteger)
          .reduce((sum, count) => sum + count, 0) || department.optometrist || null,
      opticalOpenings: department.retailSalesOfficeOperations || null,
      technicianOpenings: department.clinicalSupport || null,
      managerOpenings:
        [department.fieldOfficeManagement, department.fieldOfficeMultiUnitLeadership]
          .filter(Number.isInteger)
          .reduce((sum, count) => sum + count, 0) || null,
      opticianOpenings: byTitle.opticianOpenings,
    },
  };
}

async function existingDuplicateKeys(duplicateKeys) {
  if (!duplicateKeys.length) return new Set();
  const result = await query(
    `
      select duplicate_key
      from public.job_imports
      where duplicate_key = any($1::text[])
    `,
    [duplicateKeys]
  );
  return new Set((result.rows || []).map((row) => row.duplicate_key));
}

async function existingMyEyeDrImportCount() {
  const result = await query(
    `
      select count(*)::int as total
      from public.job_imports
      where employer_name ilike '%myeyedr%'
         or normalized_company ilike '%myeyedr%'
         or employer_brand ilike '%myeyedr%'
         or practice_name ilike '%myeyedr%'
    `
  );
  return Number(result.rows?.[0]?.total || 0);
}

function summarizeRows(rows) {
  return {
    status: countBy(rows, (row) => row.status),
    recommendations: countBy(rows, (row) => row.recommendation),
    autoDecisions: countBy(rows, (row) => row.auto_decision || "none"),
    evergreen: rows.filter((row) => row.evergreen).length,
  };
}

async function main() {
  if (OPTIONS.dbSummary) {
    const summary = await summarizeMyEyeDrAcquisitionImports();
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const searchInventory = await fetchSearchInventory();
  const sourceJobs = searchInventory.jobs;
  const limitedJobs = OPTIONS.limit ? sourceJobs.slice(0, OPTIONS.limit) : sourceJobs;
  const inventoryEstimates = buildInventoryEstimates(sourceJobs, searchInventory.sourceFacetCounts);

  const roleAnnotated = limitedJobs.map((job) => ({
    ...job,
    myEyeDrRole: classifyMyEyeDrRole(job),
  }));
  const included = roleAnnotated.filter((job) => job.myEyeDrRole.include);
  const excluded = roleAnnotated.filter((job) => !job.myEyeDrRole.include);
  const detailed = await enrichDetails(included);

  const discoveryRun = {
    source: SOURCE,
    jobs: detailed.map((job) => {
      const discoveryResult = buildDiscoveryResult(job, job.myEyeDrRole);
      const normalizedJob = normalizeMyEyeDrJob(discoveryResult, job, job.myEyeDrRole);
      return { discoveryResult, normalizedJob };
    }),
  };

  const duplicateKeys = discoveryRun.jobs.map((item) => item.normalizedJob.duplicateKey);
  const existingDuplicates = await existingDuplicateKeys(duplicateKeys);
  const existingImportsBefore = await existingMyEyeDrImportCount();

  const classifierCounts = {
    approved: discoveryRun.jobs.filter((item) => item.normalizedJob.recommendation === "approve").length,
    rejected: discoveryRun.jobs.filter((item) => item.normalizedJob.recommendation === "reject").length,
    review: discoveryRun.jobs.filter((item) => item.normalizedJob.recommendation === "review").length,
  };

  let savedRows = [];
  if (OPTIONS.importJobs) {
    savedRows = await saveDiscoveryRun(discoveryRun, { discoveredBy: "script:myeyedr-acquisition" });
  }

  const output = {
    mode: OPTIONS.importJobs ? "import" : "dry-run",
    sourceInfrastructure: {
      atsProvider: "Jobvite / Employ",
      careersUrl: "https://careers.myeyedr.com",
      searchEndpoint: SEARCH_URL,
      jobDetailEndpoint: `${CAREERS_URL}/jobs/{numericId}-{slug}`,
      applyUrlStructure: `${CAREERS_URL}/jobs/{numericId}-{slug}/apply -> https://app.jobvite.com/CompanyJobs/Careers.aspx?...`,
      directJobviteBoard: DIRECT_JOBVITE_BOARD,
      sourceTypePersistedAs: "career_page",
    },
    discovery: {
      sourceReportedTotal: searchInventory.sourceTotal,
      sourceReportedPages: searchInventory.sourcePages,
      parsedOpenings: sourceJobs.length,
      processedOpenings: limitedJobs.length,
      relevantOpenings: included.length,
      excludedOpenings: excluded.length,
      pageCoverage: searchInventory.pageCoverage,
    },
    inventoryEstimates,
    relevantByRole: countBy(included, (job) => job.myEyeDrRole.category),
    excludedByReason: countBy(excluded, (job) => job.myEyeDrRole.reason),
    freshnessAllParsed: countFreshness(sourceJobs),
    freshnessRelevant: countFreshness(included),
    classifier: {
      discovered: sourceJobs.length,
      imported: OPTIONS.importJobs ? savedRows.length : 0,
      approved: classifierCounts.approved,
      rejected: classifierCounts.rejected,
      review: classifierCounts.review,
      duplicateCount: existingDuplicates.size,
      duplicateRate:
        discoveryRun.jobs.length > 0
          ? Number(((existingDuplicates.size / discoveryRun.jobs.length) * 100).toFixed(2))
          : 0,
    },
    importState: {
      existingMyEyeDrImportsBefore: existingImportsBefore,
      savedOrUpdated: savedRows.length,
      savedSummary: summarizeRows(savedRows),
    },
    detailFetch: {
      attempted: !(OPTIONS.skipDetails || (OPTIONS.dryRun && !OPTIONS.fetchDetails)),
      fetched: detailed.filter((job) => job.detailFetched).length,
      failed: detailed.filter((job) => job.detailError).length,
    },
    sampleIncluded: included.slice(0, 8).map((job) => ({
      title: job.title,
      location: job.location,
      role: job.myEyeDrRole.category,
      posted: job.postedText,
      sourceUrl: job.sourceUrl,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

async function summarizeMyEyeDrAcquisitionImports() {
  const result = await query(
    `
      select
        count(*)::int as total,
        count(*) filter (where status = 'needs_review')::int as needs_review,
        count(*) filter (where status = 'evergreen')::int as evergreen,
        count(*) filter (where status = 'published')::int as published,
        count(*) filter (where recommendation = 'approve')::int as approved,
        count(*) filter (where recommendation = 'reject')::int as rejected,
        count(*) filter (where recommendation = 'review')::int as review,
        count(*) filter (where role_badge = 'OD')::int as od,
        count(*) filter (where role_badge = 'OPTICIAN')::int as optician,
        count(*) filter (where role_badge = 'OPTICAL')::int as optical,
        count(*) filter (where role_badge = 'TECH')::int as technician,
        count(*) filter (where role_badge = 'MANAGER')::int as manager,
        count(*) filter (where role_badge = 'FRONT_DESK')::int as front_desk,
        count(*) filter (where source_posting_age_days between 0 and 30)::int as age_0_30,
        count(*) filter (where source_posting_age_days between 31 and 60)::int as age_31_60,
        count(*) filter (where source_posting_age_days between 61 and 90)::int as age_61_90,
        count(*) filter (where source_posting_age_days between 91 and 180)::int as age_91_180,
        count(*) filter (where source_posting_age_days > 180)::int as age_180_plus,
        count(*) filter (where source_posting_age_days is null)::int as age_unknown,
        min(source_posted_at) as oldest_source_posted_at,
        max(source_posted_at) as newest_source_posted_at
      from public.job_imports
      where discovered_by = 'script:myeyedr-acquisition'
    `
  );
  const row = result.rows?.[0] || {};
  return {
    imports: {
      total: Number(row.total || 0),
      status: {
        needs_review: Number(row.needs_review || 0),
        evergreen: Number(row.evergreen || 0),
        published: Number(row.published || 0),
      },
      classifier: {
        approved: Number(row.approved || 0),
        rejected: Number(row.rejected || 0),
        review: Number(row.review || 0),
      },
      roles: {
        od: Number(row.od || 0),
        optician: Number(row.optician || 0),
        optical: Number(row.optical || 0),
        technician: Number(row.technician || 0),
        manager: Number(row.manager || 0),
        frontDesk: Number(row.front_desk || 0),
      },
      freshness: {
        "0-30 days": Number(row.age_0_30 || 0),
        "31-60 days": Number(row.age_31_60 || 0),
        "61-90 days": Number(row.age_61_90 || 0),
        "91-180 days": Number(row.age_91_180 || 0),
        "180+ days": Number(row.age_180_plus || 0),
        unknown: Number(row.age_unknown || 0),
      },
      oldestSourcePostedAt: row.oldest_source_posted_at,
      newestSourcePostedAt: row.newest_source_posted_at,
    },
  };
}

main()
  .catch((error) => {
    console.error("MyEyeDr. acquisition failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
