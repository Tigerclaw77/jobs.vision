const crypto = require("node:crypto");

function cleanText(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url, baseUrl) {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function stableLower(value = "") {
  return cleanText(value).toLowerCase();
}

function createDuplicateKey(job = {}) {
  const material = [
    stableLower(job.company),
    stableLower(job.title),
    stableLower(job.location),
    stableLower(job.applyUrl || job.sourceUrl),
  ].join("|");
  return crypto.createHash("sha256").update(material).digest("hex");
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(values.map((value) => cleanText(value)).filter(Boolean))
  );
}

function truncate(value, maxLength = 30000) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function hostnameFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

module.exports = {
  cleanText,
  createDuplicateKey,
  hostnameFor,
  normalizeUrl,
  stableLower,
  truncate,
  uniqueStrings,
};
