const {
  cleanText,
  createDuplicateKey,
  stableLower,
  truncate,
  uniqueStrings,
} = require("./utils");

function detectEmploymentType(text) {
  const haystack = stableLower(text);
  if (/\bfull[-\s]?time\b/.test(haystack)) return "full_time";
  if (/\bpart[-\s]?time\b/.test(haystack)) return "part_time";
  if (/\bper\s?diem\b|\bfill[-\s]?in\b/.test(haystack)) return "per_diem_fill_in";
  return null;
}

function detectCompensation(text) {
  const cleaned = cleanText(text);
  const range = cleaned.match(/\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?\s?(?:-|to|\u2013|\u2014)\s?\$\s?\d{2,3}(?:,\d{3})?(?:\.\d{2})?/i);
  if (range) return range[0];
  const hourly = cleaned.match(/\$\s?\d{2,3}(?:\.\d{2})?\s?(?:\/\s?hr|per hour|hourly)/i);
  if (hourly) return hourly[0];
  const salary = cleaned.match(/\$\s?\d{2,3},\d{3}/i);
  return salary ? salary[0] : null;
}

function tagsFromKeywordSets(text, keywordSets = {}) {
  const haystack = stableLower(text);
  const tags = [];
  for (const [tag, keywords] of Object.entries(keywordSets || {})) {
    if ((keywords || []).some((keyword) => haystack.includes(stableLower(keyword)))) {
      tags.push(tag);
    }
  }
  return uniqueStrings(tags);
}

function normalizeDiscoveryResult(result, source, options = {}) {
  const industryConfig = options.industryConfig || null;
  const title = cleanText(result.rawTitle);
  const description = truncate(cleanText(result.rawDescription), 30000) || null;
  const company = cleanText(result.employerName || source.employerName);
  const location = cleanText(result.rawLocation) || null;
  const combinedText = [title, location, description].filter(Boolean).join(" ");
  const industryTags = industryConfig
    ? tagsFromKeywordSets(combinedText, industryConfig.industryTags)
    : [];
  const roleTags = industryConfig
    ? tagsFromKeywordSets(combinedText, industryConfig.roleKeywordSets)
    : [];

  const normalized = {
    title,
    company,
    location,
    employmentType: detectEmploymentType(combinedText),
    compensation: detectCompensation(combinedText),
    description,
    applyUrl: result.applyUrl || null,
    sourceUrl: result.sourceUrl,
    sourceType: result.sourceType,
    industryTags,
    roleTags,
    status: "needs_review",
  };

  normalized.duplicateKey = createDuplicateKey(normalized);
  return normalized;
}

module.exports = {
  normalizeDiscoveryResult,
};
