function scoreDiscovery(result, normalized, options = {}) {
  let score = 0;
  const notes = [...(result.extractionNotes || [])];

  if (normalized.title) score += 25;
  else notes.push("Missing normalized title.");

  if (normalized.company) score += 10;
  if (normalized.location) score += 10;
  if (normalized.description && normalized.description.length > 120) score += 15;
  if (normalized.applyUrl) score += 15;
  if (result.extractionNotes?.some((note) => /json-ld/i.test(note))) score += 15;
  if (["greenhouse", "lever", "workday"].includes(result.sourceType)) score += 5;
  if (normalized.roleTags?.length) score += 5;

  if (options.industryConfig?.includeIfAnyKeywordMatches?.length && !normalized.roleTags?.length) {
    notes.push("No configured industry role keywords matched.");
  }

  return {
    confidenceScore: Math.max(0, Math.min(100, score)),
    extractionNotes: notes,
  };
}

module.exports = {
  scoreDiscovery,
};
