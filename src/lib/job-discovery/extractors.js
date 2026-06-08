const { cleanText, normalizeUrl, truncate, uniqueStrings } = require("./utils");

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
      const applyUrl =
        normalizeUrl(node.url, pageUrl) ||
        normalizeUrl(node.sameAs, pageUrl) ||
        normalizeUrl(node.identifier?.url, pageUrl);

      jobs.push({
        sourceUrl: normalizeUrl(node.url, pageUrl) || pageUrl,
        discoveredAt: new Date().toISOString(),
        rawTitle: cleanText(node.title),
        rawLocation: rawLocation || null,
        rawDescription: truncate(cleanText(node.description), 30000) || null,
        applyUrl,
        employerName: source.employerName,
        sourceType: source.sourceType,
        confidenceScore: 0,
        extractionNotes: ["Extracted from JSON-LD JobPosting schema."],
      });
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

function isLikelyJobLink(anchor, sourceType) {
  const text = anchor.text.toLowerCase();
  const url = anchor.url.toLowerCase();
  if (sourceType === "greenhouse" && url.includes("greenhouse.io")) return true;
  if (sourceType === "lever" && url.includes("lever.co")) return true;
  if (sourceType === "workday" && url.includes("workdayjobs")) return true;

  const urlLooksLikeJob =
    /\/(job|jobs|careers|career|position|positions|posting|openings?)\b/.test(url) ||
    /greenhouse\.io|lever\.co|workdayjobs|icims|smartrecruiters|bamboohr|ashbyhq/.test(url);
  const textLooksLikeJob =
    /\b(apply|job|career|position|opening|view role|details)\b/i.test(text) ||
    (text.length >= 8 && text.length <= 140 && !/\b(home|about|privacy|terms|contact)\b/i.test(text));

  return urlLooksLikeJob && textLooksLikeJob;
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
      unique.set(anchor.url, {
        sourceUrl: pageUrl,
        discoveredAt: new Date().toISOString(),
        rawTitle: title,
        rawLocation: null,
        rawDescription: null,
        applyUrl: anchor.url,
        employerName: source.employerName,
        sourceType: source.sourceType,
        confidenceScore: 0,
        extractionNotes: ["Extracted from likely job link on HTML career page."],
      });
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

function extractJobsFromHtml(html, pageUrl, source) {
  const jsonLdJobs = extractJsonLdJobs(html, pageUrl, source);
  const fallbackJobs = extractHtmlFallbackJobs(html, pageUrl, source);
  const byKey = new Map();

  for (const job of [...jsonLdJobs, ...fallbackJobs]) {
    const key = `${job.rawTitle}|${job.applyUrl || job.sourceUrl}`;
    if (!byKey.has(key)) byKey.set(key, job);
  }

  return Array.from(byKey.values());
}

module.exports = {
  extractJobsFromHtml,
  findCareerLinks,
};
