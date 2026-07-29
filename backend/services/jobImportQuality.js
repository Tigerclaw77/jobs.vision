const crypto = require("node:crypto");

const NAVIGATION_ARTIFACTS = [
  "skip to main content",
  "home",
  "about us",
  "contact us",
  "search jobs",
  "view all jobs",
  "sign in",
  "create account",
  "privacy policy",
  "cookie policy",
  "cookie settings",
  "terms of use",
  "menu",
];

const EXPIRED_PATTERNS = [
  { code: "expired_language", pattern: /\b(?:this\s+)?(?:job\s+)?posting\s+(?:has\s+)?expired\b/i },
  { code: "expired_language", pattern: /\b(?:this\s+)?job\s+(?:has\s+)?expired\b/i },
  { code: "filled_language", pattern: /\b(?:position|role|vacancy)\s+(?:has been\s+|is\s+)?filled\b/i },
  { code: "closed_language", pattern: /\bno longer accepting applications\b/i },
  { code: "closed_language", pattern: /\b(?:job|position|requisition)\s+(?:has been\s+|is\s+)?closed\b/i },
  { code: "job_not_found_language", pattern: /\b(?:job|position|posting)\s+(?:was\s+|is\s+)?not found\b/i },
];

const BALANCED_TAGS = [
  "article",
  "div",
  "li",
  "main",
  "ol",
  "p",
  "section",
  "table",
  "td",
  "tr",
  "ul",
];

function visibleText(value = "") {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedDescription(value = "") {
  return visibleText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionFingerprint(value = "") {
  const normalized = normalizedDescription(value);
  if (normalized.length < 80) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function countTag(html, tag, closing = false) {
  const prefix = closing ? "<\\/" : "<";
  return (String(html).match(new RegExp(`${prefix}${tag}\\b`, "gi")) || []).length;
}

function malformedHtmlSignals(value = "") {
  const html = String(value);
  if (!html.includes("<") && !html.includes(">")) {
    return { malformed: false, unbalancedTags: [], strayAngles: 0 };
  }
  const unbalancedTags = BALANCED_TAGS.filter((tag) => {
    const opens = countTag(html, tag, false);
    const closes = countTag(html, tag, true);
    return opens !== closes;
  });
  const strippedTags = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "");
  const strayAngles = (strippedTags.match(/[<>]/g) || []).length;
  return {
    malformed:
      html.includes("\u0000") ||
      strayAngles > 0 ||
      unbalancedTags.length >= 2,
    unbalancedTags,
    strayAngles,
  };
}

function navigationSignals(value = "") {
  const html = String(value);
  const text = visibleText(html).toLowerCase();
  const artifactMatches = NAVIGATION_ARTIFACTS.filter((artifact) => {
    const pattern = new RegExp(`\\b${artifact.replace(/\s+/g, "\\s+")}\\b`, "i");
    return pattern.test(text);
  });
  const navigationText = visibleText(
    (html.match(/<(?:nav|header|footer)\b[^>]*>[\s\S]*?<\/(?:nav|header|footer)>/gi) || []).join(" ")
  );
  const navigationRatio = text.length
    ? Math.min(1, navigationText.length / text.length)
    : 0;
  return {
    navigationHeavy:
      artifactMatches.length >= 5 ||
      (navigationRatio >= 0.45 && navigationText.length >= 80),
    artifactMatches,
    navigationRatio: Math.round(navigationRatio * 1000) / 1000,
  };
}

function validApplyUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function evaluateImportQuality({
  description = "",
  applyUrl = "",
  duplicateDescription = false,
} = {}) {
  const reasons = [];
  const hardRejectReasons = [];
  const quarantineReasons = [];
  const text = visibleText(description);
  const malformed = malformedHtmlSignals(description);
  const navigation = navigationSignals(description);
  const expiredMatch = EXPIRED_PATTERNS.find(({ pattern }) => pattern.test(text));

  if (!validApplyUrl(applyUrl)) {
    hardRejectReasons.push("missing_or_invalid_apply_url");
  }
  if (expiredMatch) hardRejectReasons.push(expiredMatch.code);
  if (malformed.malformed) quarantineReasons.push("malformed_html");
  if (navigation.navigationHeavy) quarantineReasons.push("scraped_navigation");
  if (duplicateDescription) quarantineReasons.push("duplicate_description");

  reasons.push(...new Set([...hardRejectReasons, ...quarantineReasons]));
  let status = "passed";
  if (hardRejectReasons.length) status = "rejected";
  else if (quarantineReasons.length) status = "quarantined";

  let score = 100;
  if (hardRejectReasons.length) score = Math.min(score, 20);
  score -= malformed.malformed ? 30 : 0;
  score -= navigation.navigationHeavy ? 30 : 0;
  score -= duplicateDescription ? 35 : 0;
  score = Math.max(0, Math.min(100, score));
  if (status === "quarantined") score = Math.min(score, 59);

  return {
    status,
    score,
    reasonCodes: reasons,
    fingerprint: descriptionFingerprint(description),
    checkedAt: new Date().toISOString(),
    details: {
      visibleTextLength: text.length,
      malformedHtml: malformed,
      navigation,
      expiredLanguage: expiredMatch?.code || null,
      duplicateDescription,
    },
  };
}

module.exports = {
  EXPIRED_PATTERNS,
  NAVIGATION_ARTIFACTS,
  descriptionFingerprint,
  evaluateImportQuality,
  malformedHtmlSignals,
  navigationSignals,
  normalizedDescription,
  validApplyUrl,
  visibleText,
};
