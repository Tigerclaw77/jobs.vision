const { fetchJson, fetchPage } = require("./fetcher");
const { cleanText, normalizeUrl, truncate, uniqueStrings } = require("./utils");

const ATS_SOURCE_TYPES = new Set([
  "smartrecruiters",
  "greenhouse",
  "lever",
  "workday",
  "icims",
  "taleo",
]);

const CAREER_LANDING_PATTERNS = [
  /\b(retail|corporate|lab|distribution center|doctor of optometry|od career opportunities|careers?|overview)\b/i,
];

const NAVIGATION_PATTERNS = [
  /\b(skip to content|access .*portal|internal applicant portal|employee portal|home|privacy|terms|contact)\b/i,
];

const INFORMATIONAL_PATTERNS = [
  /\b(benefits?|what is|referral program|job alert|set up a job alert|independent practices?)\b/i,
];

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function flattenJsonLd(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => flattenJsonLd(item, output));
    return output;
  }
  if (typeof value !== "object") return output;
  output.push(value);
  if (value["@graph"]) flattenJsonLd(value["@graph"], output);
  return output;
}

function hasJobPostingType(node) {
  const type = node?.["@type"];
  if (Array.isArray(type)) return type.some((entry) => String(entry).toLowerCase() === "jobposting");
  return String(type || "").toLowerCase() === "jobposting";
}

function extractJsonLdJobs(html, pageUrl, source) {
  const jobs = [];
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scripts) {
    const parsed = safeJsonParse(match[1].trim());
    const nodes = flattenJsonLd(parsed);
    for (const node of nodes) {
      if (!hasJobPostingType(node)) continue;
      const location = Array.isArray(node.jobLocation)
        ? node.jobLocation[0]
        : node.jobLocation;
      const address = location?.address || {};
      const rawLocation = cleanText(
        [
          address.addressLocality,
          address.addressRegion,
          address.addressCountry,
        ]
          .filter(Boolean)
          .join(", ")
      );
      const identifier =
        typeof node.identifier === "object"
          ? node.identifier?.value || node.identifier?.name || node.identifier?.["@id"]
          : node.identifier;
      const applyUrl =
        normalizeUrl(node.url, pageUrl) ||
        normalizeUrl(node.sameAs, pageUrl) ||
        normalizeUrl(node.identifier?.url, pageUrl);

      jobs.push(
        withClassification({
          sourceUrl: normalizeUrl(node.url, pageUrl) || pageUrl,
          discoveredAt: new Date().toISOString(),
          rawTitle: cleanText(node.title),
          rawLocation: rawLocation || null,
          rawDescription: truncate(cleanText(node.description), 30000) || null,
          applyUrl,
          requisitionId: cleanText(identifier) || null,
          employerName: source.employerName,
          sourceType: source.sourceType,
          atsProvider: detectAtsProvider(applyUrl || pageUrl),
          confidenceScore: 0,
          extractionNotes: ["Extracted from JSON-LD JobPosting schema."],
        })
      );
    }
  }

  return jobs;
}

function extractAnchors(html, pageUrl) {
  const anchors = [];
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const attrs = match[1] || "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const url = normalizeUrl(hrefMatch[1], pageUrl);
    if (!url) continue;
    anchors.push({ url, text: cleanText(match[2]) });
  }
  return anchors;
}

function detectAtsProvider(url = "") {
  const text = String(url || "").toLowerCase();
  if (/smartrecruiters\.com|api\.smartrecruiters\.com/.test(text)) return "smartrecruiters";
  if (/greenhouse\.io|job-boards\.greenhouse\.io|boards-api\.greenhouse\.io/.test(text)) return "greenhouse";
  if (/lever\.co|api\.lever\.co/.test(text)) return "lever";
  if (/workdayjobs\.com|myworkdayjobs\.com|myworkday\.com/.test(text)) return "workday";
  if (/icims\.com/.test(text)) return "icims";
  if (/taleo\.net|taleo\.com/.test(text)) return "taleo";
  if (/jibecdn\.com|jibeapply\.com|talentplatform\.us/.test(text)) return "jibe";
  return null;
}

function sourceTypeForResult(source, provider) {
  if (provider) return provider;
  if (source.sourceType && source.sourceType !== "unknown") return source.sourceType;
  return source.sourceType || "unknown";
}

function detectAtsTargets(html, pageUrl, source) {
  const anchors = extractAnchors(html, pageUrl);
  const urls = uniqueStrings([
    pageUrl,
    source.careersUrl,
    source.employerWebsiteUrl,
    ...anchors.map((anchor) => anchor.url),
  ]);
  const targets = [];
  const add = (provider, key, url) => {
    if (!provider || !key) return;
    const id = `${provider}:${key}`;
    if (!targets.some((target) => target.id === id)) {
      targets.push({ id, provider, key, url });
    }
  };

  for (const rawUrl of urls) {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("smartrecruiters.com")) {
      add("smartrecruiters", parsed.searchParams.get("dcr_ci"), rawUrl);
      if (host === "jobs.smartrecruiters.com" && parts[0]) add("smartrecruiters", parts[0], rawUrl);
    }

    if (host.includes("greenhouse.io")) {
      const board = parts[0] && !["embed", "jobs"].includes(parts[0]) ? parts[0] : null;
      add("greenhouse", board, rawUrl);
    }

    if (host === "jobs.lever.co" && parts[0]) add("lever", parts[0], rawUrl);

    if (/workdayjobs\.com|myworkdayjobs\.com|myworkday\.com/.test(host)) {
      add("workday", host, rawUrl);
    }

    if (host.includes("icims.com") && !host.endsWith(".i.icims.com")) {
      add("icims", host, rawUrl);
    }
    if (host.includes("taleo.net") || host.includes("taleo.com")) add("taleo", host, rawUrl);
  }

  for (const match of html.matchAll(/\bdcr_ci=([A-Za-z0-9_-]+)/g)) {
    add("smartrecruiters", match[1], pageUrl);
  }
  if (/app\.jibecdn\.com|jibeapply\.com|\/api\/jobs\b/i.test(html)) {
    try {
      add("jibe", new URL(pageUrl).origin, pageUrl);
    } catch {
      // Ignore invalid page URLs; the source will fail normally if it cannot be fetched.
    }
  }

  if (ATS_SOURCE_TYPES.has(source.sourceType) && !targets.some((target) => target.provider === source.sourceType)) {
    const key = source.atsKey || source.companySlug || source.employerSlug || null;
    add(source.sourceType, key, source.careersUrl || source.employerWebsiteUrl);
  }

  return targets;
}

function locationName(location) {
  if (!location) return null;
  if (typeof location === "string") return cleanText(location) || null;
  return cleanText(
    [
      location.city,
      location.region,
      location.state,
      location.country,
      location.name,
    ]
      .filter(Boolean)
      .join(", ")
  ) || null;
}

function smartRecruitersDescription(job) {
  const sections = job?.jobAd?.sections || {};
  return cleanText(
    [
      sections.jobDescription?.text || sections.jobDescription,
      sections.qualifications?.text || sections.qualifications,
      sections.additionalInformation?.text || sections.additionalInformation,
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}

async function extractSmartRecruitersJobs(target, source, options = {}) {
  const maxJobs = Math.max(1, Number(options.maxAtsJobs) || 50);
  const pageLimit = Math.min(100, maxJobs);
  const postings = [];
  const notes = [];
  let offset = 0;
  let totalFound = null;

  while (postings.length < maxJobs) {
    const limit = Math.min(pageLimit, maxJobs - postings.length);
    const apiUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(target.key)}/postings?limit=${limit}&offset=${offset}`;
    const response = await fetchJson(apiUrl, options);
    if (!response.ok) {
      const responseNotes = response.notes.map((note) => `SmartRecruiters ${target.key}: ${note}`);
      if (!postings.length) return { jobs: [], notes: responseNotes };
      notes.push(...responseNotes);
      break;
    }

    const pagePostings = Array.isArray(response.json?.content)
      ? response.json.content
      : Array.isArray(response.json)
        ? response.json
        : [];
    postings.push(...pagePostings);
    totalFound = Number.isFinite(Number(response.json?.totalFound))
      ? Number(response.json.totalFound)
      : totalFound;

    if (!pagePostings.length || pagePostings.length < limit) break;
    offset += pagePostings.length;
    if (totalFound !== null && offset >= totalFound) break;

    if (options.atsPageDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.atsPageDelayMs));
    }
  }

  const jobs = postings.map((job) => {
    const id = job.id || job.uuid || job.identifier || null;
    const detailUrl = id
      ? `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(target.key)}/postings/${encodeURIComponent(id)}`
      : normalizeUrl(job.ref);
    const customFields = Array.isArray(job.customField) ? job.customField : [];
    const applyUrl =
      normalizeUrl(job.ref) ||
      normalizeUrl(job.applyUrl) ||
      normalizeUrl(job.url) ||
      (id ? `https://jobs.smartrecruiters.com/${target.key}/${id}` : null);
    return withClassification({
      sourceUrl: applyUrl || target.url || apiUrl,
      discoveredAt: new Date().toISOString(),
      rawTitle: cleanText(job.name || job.title),
      rawLocation: locationName(job.location),
      rawDescription: truncate(smartRecruitersDescription(job), 30000) || null,
      applyUrl,
      requisitionId: id ? String(id) : null,
      employerName: source.employerName,
      sourceType: sourceTypeForResult(source, "smartrecruiters"),
      atsProvider: "smartrecruiters",
      customFields,
      smartRecruiters: {
        companyKey: target.key,
        postingId: id ? String(id) : null,
        detailUrl,
        ref: normalizeUrl(job.ref) || null,
        customFields,
      },
      confidenceScore: 0,
      extractionNotes: [`Extracted from SmartRecruiters postings API (${target.key}).`],
    });
  });

  return { jobs, notes };
}

async function extractGreenhouseJobs(target, source, options = {}) {
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(target.key)}/jobs?content=true`;
  const response = await fetchJson(apiUrl, options);
  if (!response.ok) {
    return {
      jobs: [],
      notes: response.notes.map((note) => `Greenhouse ${target.key}: ${note}`),
    };
  }
  const postings = Array.isArray(response.json?.jobs) ? response.json.jobs : [];
  const jobs = postings.map((job) =>
    withClassification({
      sourceUrl: normalizeUrl(job.absolute_url) || target.url || apiUrl,
      discoveredAt: new Date().toISOString(),
      rawTitle: cleanText(job.title),
      rawLocation: locationName(job.location),
      rawDescription: truncate(cleanText(job.content), 30000) || null,
      applyUrl: normalizeUrl(job.absolute_url) || null,
      requisitionId: job.id ? String(job.id) : null,
      employerName: source.employerName,
      sourceType: sourceTypeForResult(source, "greenhouse"),
      atsProvider: "greenhouse",
      confidenceScore: 0,
      extractionNotes: [`Extracted from Greenhouse job board API (${target.key}).`],
    })
  );
  return { jobs, notes: [] };
}

async function extractLeverJobs(target, source, options = {}) {
  const apiUrl = `https://api.lever.co/v0/postings/${encodeURIComponent(target.key)}?mode=json`;
  const response = await fetchJson(apiUrl, options);
  if (!response.ok) {
    return {
      jobs: [],
      notes: response.notes.map((note) => `Lever ${target.key}: ${note}`),
    };
  }
  const postings = Array.isArray(response.json) ? response.json : [];
  const jobs = postings.map((job) =>
    withClassification({
      sourceUrl: normalizeUrl(job.hostedUrl) || target.url || apiUrl,
      discoveredAt: new Date().toISOString(),
      rawTitle: cleanText(job.text),
      rawLocation: cleanText(job.categories?.location) || null,
      rawDescription: truncate(cleanText([job.descriptionPlain, job.additionalPlain].filter(Boolean).join("\n\n")), 30000) || null,
      applyUrl: normalizeUrl(job.applyUrl) || normalizeUrl(job.hostedUrl) || null,
      requisitionId: job.id ? String(job.id) : null,
      employerName: source.employerName,
      sourceType: sourceTypeForResult(source, "lever"),
      atsProvider: "lever",
      confidenceScore: 0,
      extractionNotes: [`Extracted from Lever postings API (${target.key}).`],
    })
  );
  return { jobs, notes: [] };
}

function jibeJobUrl(origin, job) {
  const data = job?.data || job || {};
  const canonical = data.meta_data?.canonical_url;
  if (canonical) return normalizeUrl(canonical);
  const slug = data.slug || data.req_id || data.id;
  if (!slug || !origin) return null;
  const lang = data.language || "en-us";
  return normalizeUrl(`${origin.replace(/\/$/, "")}/jobs/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`);
}

function jibeLocation(job) {
  const data = job?.data || job || {};
  const postalAddress = data.meta_data?.googlejobs?.derivedInfo?.locations?.[0]?.postalAddress || {};
  return cleanText(
    [
      data.city || postalAddress.locality,
      postalAddress.administrativeArea || data.state,
      data.country_code || postalAddress.regionCode || data.country,
    ]
      .filter(Boolean)
      .join(", ")
  ) || null;
}

async function extractJibeJobs(target, source, options = {}) {
  const maxJobs = Math.max(1, Number(options.maxAtsJobs) || 50);
  const pageLimit = Math.min(100, maxJobs);
  const jobs = [];
  const notes = [];
  let totalFound = null;
  let page = 1;
  let origin = target.key || target.url;

  try {
    origin = new URL(origin).origin;
  } catch {
    try {
      origin = new URL(target.url).origin;
    } catch {
      return { jobs: [], notes: [`Jibe ${target.key}: invalid job search origin.`] };
    }
  }

  while (jobs.length < maxJobs) {
    const limit = Math.min(pageLimit, maxJobs - jobs.length);
    const apiUrl = `${origin.replace(/\/$/, "")}/api/jobs?limit=${limit}&page=${page}`;
    const response = await fetchJson(apiUrl, options);
    if (!response.ok) {
      const responseNotes = response.notes.map((note) => `Jibe ${origin}: ${note}`);
      if (!jobs.length) return { jobs: [], notes: responseNotes };
      notes.push(...responseNotes);
      break;
    }

    const pageJobs = Array.isArray(response.json?.jobs) ? response.json.jobs : [];
    totalFound = Number.isFinite(Number(response.json?.totalCount))
      ? Number(response.json.totalCount)
      : totalFound;

    for (const entry of pageJobs) {
      const data = entry?.data || entry || {};
      const sourceUrl = jibeJobUrl(origin, entry) || apiUrl;
      jobs.push(
        withClassification({
          sourceUrl,
          discoveredAt: new Date().toISOString(),
          rawTitle: cleanText(data.title),
          rawLocation: jibeLocation(entry),
          rawDescription: truncate(cleanText(data.description), 30000) || null,
          applyUrl: normalizeUrl(data.apply_url) || sourceUrl,
          requisitionId: cleanText(data.req_id || data.slug || data.id) || null,
          employerName: source.employerName,
          // Keep persisted source_type compatible with current DB constraints; atsProvider carries Jibe attribution.
          sourceType: sourceTypeForResult(source, null),
          atsProvider: "jibe",
          confidenceScore: 0,
          extractionNotes: [`Extracted from Jibe/Radancy jobs API (${origin}).`],
        })
      );
    }

    if (!pageJobs.length || pageJobs.length < limit) break;
    if (totalFound !== null && jobs.length >= totalFound) break;
    page += 1;

    if (options.atsPageDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.atsPageDelayMs));
    }
  }

  return { jobs, notes };
}

function decodeJsString(value = "") {
  return String(value || "")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/gi, "&");
}

function canonicalIcimsJobUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    parsed.searchParams.delete("in_iframe");
    parsed.searchParams.delete("mobile");
    parsed.searchParams.delete("needsRedirect");
    return parsed.toString();
  } catch {
    return normalized;
  }
}

function icimsSearchUrlForPage(url, page = 0) {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname.includes("icims.com")) return null;
    parsed.pathname = "/jobs/search";
    parsed.search = "";
    parsed.searchParams.set("pr", String(page));
    parsed.searchParams.set("in_iframe", "1");
    return parsed.toString();
  } catch {
    return null;
  }
}

function findIcimsSearchUrls(html = "", pageUrl, target) {
  const urls = [];
  const add = (url) => {
    const normalized = normalizeUrl(decodeJsString(url), pageUrl);
    if (normalized && normalized.includes("icims.com") && normalized.includes("/jobs/search")) {
      urls.push(icimsSearchUrlForPage(normalized, 0) || normalized);
    }
  };

  for (const match of html.matchAll(/https?:\\?\/\\?\/[^"']*?icims\.com\\?\/jobs\\?\/search[^"']*/gi)) {
    add(match[0]);
  }
  for (const match of html.matchAll(/\bsrc\s*=\s*["']([^"']*icims\.com[^"']*\/jobs\/search[^"']*)["']/gi)) {
    add(match[1]);
  }
  if (target?.url) add(target.url);

  if (!urls.length && target?.key && String(target.key).includes("icims.com")) {
    urls.push(`https://${target.key}/jobs/search?pr=0&in_iframe=1`);
  }

  return uniqueStrings(urls);
}

function titleFromIcimsAnchor(anchorText = "", titleAttr = "") {
  const title = cleanText(titleAttr || anchorText)
    .replace(/^\d+\s*-\s*/, "")
    .replace(/^Title\s+/i, "");
  return title || null;
}

function extractIcimsJobLinks(html = "", pageUrl) {
  const links = [];
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);

  for (const match of matches) {
    const attrs = match[1] || "";
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || !/\/jobs\/\d+\/[^"']*\/job/i.test(href)) continue;
    const url = normalizeUrl(href, pageUrl);
    if (!url || isNoiseUrl(url)) continue;
    const titleAttr = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
    const text = cleanText(match[2]);
    const title = titleFromIcimsAnchor(text, titleAttr);
    const requisitionId = url.match(/\/jobs\/(\d+)\//i)?.[1] || titleAttr.match(/^(\d+)\s*-/)?.[1] || null;
    if (!title || isGenericTitle(title)) continue;
    links.push({
      url,
      canonicalUrl: canonicalIcimsJobUrl(url),
      title,
      requisitionId,
    });
  }

  const unique = new Map();
  for (const link of links) {
    if (!unique.has(link.canonicalUrl || link.url)) {
      unique.set(link.canonicalUrl || link.url, link);
    }
  }
  return Array.from(unique.values());
}

function mergeIcimsDetailJob(job, link, source) {
  return withClassification({
    ...job,
    sourceUrl: canonicalIcimsJobUrl(job.sourceUrl) || link.canonicalUrl || job.sourceUrl,
    applyUrl: canonicalIcimsJobUrl(job.applyUrl) || link.canonicalUrl || job.applyUrl,
    rawTitle: job.rawTitle || link.title,
    requisitionId: job.requisitionId || link.requisitionId,
    employerName: source.employerName,
    sourceType: sourceTypeForResult(source, "icims"),
    atsProvider: "icims",
    extractionNotes: [
      ...(job.extractionNotes || []),
      "Extracted from ICIMS job detail JSON-LD.",
    ],
  });
}

async function extractIcimsJobs(target, source, options = {}, html = "", pageUrl) {
  const notes = [];
  const maxJobs = Math.min(250, Math.max(1, Number(options.maxAtsJobs) || 50));
  const maxPages = Math.min(10, Math.max(1, Number(options.maxIcimsPages) || Math.ceil(maxJobs / 50) + 1));
  const searchUrls = findIcimsSearchUrls(html, pageUrl, target);
  const links = [];
  const seen = new Set();

  for (const baseSearchUrl of searchUrls.slice(0, 3)) {
    for (let page = 0; page < maxPages && links.length < maxJobs; page += 1) {
      const searchUrl = icimsSearchUrlForPage(baseSearchUrl, page) || baseSearchUrl;
      const response = await fetchPage(searchUrl, options);
      if (!response.ok) {
        notes.push(`ICIMS ${target.key}: ${searchUrl}: ${response.notes.join("; ")}`);
        if (page === 0) break;
        continue;
      }

      const pageLinks = extractIcimsJobLinks(response.html, response.finalUrl);
      const newLinks = pageLinks.filter((link) => {
        const key = link.canonicalUrl || link.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      links.push(...newLinks);

      if (!newLinks.length) break;
    }
  }

  const jobs = [];
  for (const link of links.slice(0, maxJobs)) {
    const detail = await fetchPage(link.url, options);
    if (detail.ok) {
      const jsonLdJobs = extractJsonLdJobs(detail.html, detail.finalUrl, {
        ...source,
        sourceType: sourceTypeForResult(source, "icims"),
      });
      const jobPosting = jsonLdJobs.find((job) => job.classification === "job_posting");
      if (jobPosting) {
        jobs.push(mergeIcimsDetailJob(jobPosting, link, source));
        continue;
      }
      notes.push(`ICIMS ${target.key}: ${link.url}: detail page did not expose JobPosting JSON-LD.`);
    } else {
      notes.push(`ICIMS ${target.key}: ${link.url}: ${detail.notes.join("; ")}`);
    }

    jobs.push(
      withClassification({
        sourceUrl: link.canonicalUrl || link.url,
        discoveredAt: new Date().toISOString(),
        rawTitle: link.title,
        rawLocation: null,
        rawDescription: null,
        applyUrl: link.canonicalUrl || link.url,
        requisitionId: link.requisitionId,
        employerName: source.employerName,
        sourceType: sourceTypeForResult(source, "icims"),
        atsProvider: "icims",
        confidenceScore: 0,
        extractionNotes: ["Extracted from ICIMS search results."],
      })
    );
  }

  if (links.length) {
    notes.push(`Extracted ${links.slice(0, maxJobs).length} ICIMS job link(s) from public search endpoint(s).`);
  }

  return { jobs, notes };
}

async function extractAtsFeedJobs(html, pageUrl, source, options = {}) {
  const notes = [];
  const jobs = [];
  const targets = detectAtsTargets(html, pageUrl, source);

  for (const target of targets) {
    if (target.provider === "smartrecruiters") {
      const result = await extractSmartRecruitersJobs(target, source, options);
      jobs.push(...result.jobs);
      notes.push(...result.notes);
    } else if (target.provider === "greenhouse") {
      const result = await extractGreenhouseJobs(target, source, options);
      jobs.push(...result.jobs);
      notes.push(...result.notes);
    } else if (target.provider === "lever") {
      const result = await extractLeverJobs(target, source, options);
      jobs.push(...result.jobs);
      notes.push(...result.notes);
    } else if (target.provider === "jibe") {
      const result = await extractJibeJobs(target, source, options);
      jobs.push(...result.jobs);
      notes.push(...result.notes);
    } else if (target.provider === "icims") {
      const result = await extractIcimsJobs(target, source, options, html, pageUrl);
      jobs.push(...result.jobs);
      notes.push(...result.notes);
    } else {
      notes.push(`Detected ${target.provider} ATS at ${target.url}, but no structured feed extractor is configured yet.`);
    }
  }

  return { jobs, notes, targets };
}

function isNoiseUrl(url = "") {
  const text = String(url || "").toLowerCase();
  return (
    /#main$|subscriptions\.smartrecruiters\.com\/job-alert|\/app\/employee-portal/.test(text) ||
    /\/(benefits?|privacy|terms|contact|about|overview|optometrist-referral|what-is-a-sublease)\b/.test(text)
  );
}

function isGenericTitle(title = "") {
  const text = cleanText(title).toLowerCase();
  if (!text || text.length < 4) return true;
  return (
    NAVIGATION_PATTERNS.some((pattern) => pattern.test(text)) ||
    INFORMATIONAL_PATTERNS.some((pattern) => pattern.test(text)) ||
    CAREER_LANDING_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function classifyCandidate(result = {}) {
  const title = cleanText(result.rawTitle);
  const url = result.applyUrl || result.sourceUrl || "";
  const haystack = `${title} ${url}`.toLowerCase();

  if (NAVIGATION_PATTERNS.some((pattern) => pattern.test(haystack)) || /#main$/.test(url)) {
    return "navigation";
  }
  if (INFORMATIONAL_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return "informational";
  }
  if (CAREER_LANDING_PATTERNS.some((pattern) => pattern.test(title)) && !result.rawLocation && !result.rawDescription) {
    return "career_landing_page";
  }
  if (isNoiseUrl(url)) {
    return "navigation";
  }

  const signals = [
    !isGenericTitle(title),
    Boolean(cleanText(result.rawLocation)),
    Boolean(cleanText(result.requisitionId)),
    Boolean(normalizeUrl(result.applyUrl) && !isNoiseUrl(result.applyUrl)),
    Boolean(cleanText(result.rawDescription) && cleanText(result.rawDescription).length >= 80),
  ].filter(Boolean).length;

  return signals >= 2 ? "job_posting" : "unknown";
}

function withClassification(result) {
  const classification = classifyCandidate(result);
  return {
    ...result,
    classification,
    extractionNotes: [
      ...(result.extractionNotes || []),
      `Classified as ${classification}.`,
    ],
  };
}

function isLikelyJobLink(anchor, sourceType) {
  const text = anchor.text.toLowerCase();
  const url = anchor.url.toLowerCase();
  if (sourceType === "greenhouse" && url.includes("greenhouse.io")) return true;
  if (sourceType === "lever" && url.includes("lever.co")) return true;
  if (sourceType === "workday" && url.includes("workdayjobs")) return true;
  if (sourceType === "smartrecruiters" && url.includes("smartrecruiters.com")) return true;
  if (sourceType === "icims" && url.includes("icims.com")) return true;
  if (sourceType === "taleo" && url.includes("taleo")) return true;

  if (isNoiseUrl(anchor.url) || isGenericTitle(anchor.text)) return false;

  const urlLooksLikeSpecificJob =
    /\/(job|jobs|position|positions|posting|openings?)\/[^/?#]+/i.test(url) ||
    /\/jobdetails\b|jobid=|requisition|reqid=|gh_jid=|lever\.co\/[^/]+\/[a-f0-9-]{20,}/i.test(url) ||
    /greenhouse\.io|lever\.co|workdayjobs|icims|smartrecruiters|bamboohr|ashbyhq/.test(url);
  const textLooksSpecific =
    text.length >= 8 &&
    text.length <= 160 &&
    !/\b(home|about|privacy|terms|contact|benefits|overview|careers?|job alert|portal)\b/i.test(text);

  return urlLooksLikeSpecificJob && textLooksSpecific;
}

function extractHtmlFallbackJobs(html, pageUrl, source) {
  const anchors = extractAnchors(html, pageUrl).filter((anchor) =>
    isLikelyJobLink(anchor, source.sourceType)
  );
  const unique = new Map();

  for (const anchor of anchors) {
    const title = cleanText(anchor.text.replace(/\b(apply now|view role|view job|details)\b/gi, ""));
    if (!title || title.length < 4) continue;
    if (!unique.has(anchor.url)) {
      unique.set(
        anchor.url,
        withClassification({
          sourceUrl: pageUrl,
          discoveredAt: new Date().toISOString(),
          rawTitle: title,
          rawLocation: null,
          rawDescription: null,
          applyUrl: anchor.url,
          requisitionId: null,
          employerName: source.employerName,
          sourceType: source.sourceType,
          atsProvider: detectAtsProvider(anchor.url),
          confidenceScore: 0,
          extractionNotes: ["Extracted from likely job link on HTML career page."],
        })
      );
    }
  }

  return Array.from(unique.values());
}

function findCareerLinks(html, pageUrl) {
  const anchors = extractAnchors(html, pageUrl);
  const matches = anchors.filter((anchor) =>
    /\b(careers?|jobs?|join our team|work with us|open positions)\b/i.test(anchor.text) ||
    /\/(careers?|jobs?|open-positions)\b/i.test(anchor.url)
  );
  return uniqueStrings(matches.map((match) => match.url)).slice(0, 3);
}

async function extractJobsFromPage(page, source, options = {}) {
  const jsonLdJobs = extractJsonLdJobs(page.html, page.finalUrl, source);
  if (jsonLdJobs.some((job) => job.classification === "job_posting")) {
    return {
      jobs: jsonLdJobs,
      notes: ["Preferred JSON-LD JobPosting data over fallback link extraction."],
    };
  }

  const ats = await extractAtsFeedJobs(page.html, page.finalUrl, source, options);
  if (ats.jobs.some((job) => job.classification === "job_posting")) {
    return {
      jobs: ats.jobs,
      notes: [
        ...ats.notes,
        "Preferred structured ATS feed over fallback link extraction.",
      ],
    };
  }

  const fallbackJobs = extractHtmlFallbackJobs(page.html, page.finalUrl, source);
  return {
    jobs: fallbackJobs,
    notes: ats.notes,
  };
}

async function extractJobsFromHtml(html, pageUrl, source, options = {}) {
  return extractJobsFromPage({ html, finalUrl: pageUrl }, source, options);
}

module.exports = {
  classifyCandidate,
  detectAtsProvider,
  extractJobsFromHtml,
  extractJobsFromPage,
  findCareerLinks,
};
