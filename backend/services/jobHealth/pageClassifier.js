const CLOSED_PATTERNS = [
  { code: "job_not_found", pattern: /\b(?:job|position|posting|requisition)\s+(?:was\s+|is\s+)?not found\b/i },
  { code: "position_filled", pattern: /\b(?:position|role|vacancy)\s+(?:has been\s+|is\s+)?filled\b/i },
  { code: "posting_expired", pattern: /\b(?:this\s+)?(?:job\s+)?posting\s+(?:has\s+)?expired\b/i },
  { code: "job_expired", pattern: /\b(?:this\s+)?job\s+(?:has\s+)?expired\b/i },
  { code: "position_closed", pattern: /\b(?:position|job|requisition)\s+(?:has been\s+|is\s+)?closed\b/i },
  { code: "no_longer_available", pattern: /\b(?:job|position|opportunity)\s+is\s+no longer available\b/i },
  { code: "not_accepting_applications", pattern: /\bno longer accepting applications\b/i },
];

const GENERIC_CAREERS_PATTERNS = [
  /\bsearch (?:all )?jobs\b/i,
  /\bview (?:all )?open positions\b/i,
  /\bjoin our talent community\b/i,
  /\bcareers at\b/i,
  /\bjob search results\b/i,
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "or",
  "the",
  "to",
  "with",
  "job",
  "position",
]);

function decodeEntities(text = "") {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function visibleTextFromHtml(html = "") {
  return decodeEntities(
    String(html)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<(?:nav|header|footer|svg|form)\b[^>]*>[\s\S]*?<\/(?:nav|header|footer|svg|form)>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function normalizedWords(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function titleMatchScore(title, pageText) {
  const titleWords = [...new Set(normalizedWords(title))];
  if (!titleWords.length) return 0;
  const pageWords = new Set(normalizedWords(pageText));
  const matched = titleWords.filter((word) => pageWords.has(word)).length;
  return matched / titleWords.length;
}

function isGenericCareersUrl(rawUrl = "") {
  try {
    const path = new URL(rawUrl).pathname.toLowerCase().replace(/\/+$/, "");
    return (
      path === "/careers" ||
      path === "/jobs" ||
      path.endsWith("/careers") ||
      path.endsWith("/jobs") ||
      path.includes("/job-search") ||
      path.includes("/search-jobs")
    );
  } catch {
    return false;
  }
}

function classifyJobPage({ html = "", title = "", location = "", finalUrl = "" } = {}) {
  const text = visibleTextFromHtml(html);
  const closedMatch = CLOSED_PATTERNS.find(({ pattern }) => pattern.test(text));
  const matchScore = titleMatchScore(title, text);
  const locationWords = normalizedWords(location);
  const lowerText = text.toLowerCase();
  const locationMatched =
    !locationWords.length || locationWords.some((word) => lowerText.includes(word));

  if (closedMatch) {
    return {
      outcome: "hard_fail",
      confidence: 94,
      reasonCodes: [closedMatch.code],
      signals: {
        closedLanguage: closedMatch.code,
        titleMatchScore: matchScore,
        locationMatched,
      },
      evidenceExcerpt: text.slice(0, 240),
    };
  }

  if (matchScore >= 0.6 && locationMatched) {
    return {
      outcome: "pass",
      confidence: Math.round(Math.min(98, 82 + matchScore * 16)),
      reasonCodes: [],
      signals: { titleMatchScore: matchScore, locationMatched },
      evidenceExcerpt: null,
    };
  }

  const genericCareersPage =
    isGenericCareersUrl(finalUrl) ||
    GENERIC_CAREERS_PATTERNS.some((pattern) => pattern.test(text));

  if (genericCareersPage) {
    return {
      outcome: "soft_fail",
      confidence: 80,
      reasonCodes: ["generic_careers_page"],
      signals: { titleMatchScore: matchScore, locationMatched, genericCareersPage: true },
      evidenceExcerpt: text.slice(0, 240),
    };
  }

  return {
    outcome: "soft_fail",
    confidence: text.length >= 100 ? 70 : 45,
    reasonCodes: [text.length >= 100 ? "position_not_found_on_page" : "page_content_insufficient"],
    signals: {
      titleMatchScore: matchScore,
      locationMatched,
      visibleTextLength: text.length,
    },
    evidenceExcerpt: text.slice(0, 240),
  };
}

module.exports = {
  CLOSED_PATTERNS,
  classifyJobPage,
  isGenericCareersUrl,
  titleMatchScore,
  visibleTextFromHtml,
};

