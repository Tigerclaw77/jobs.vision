const { fetchPage } = require("./fetcher");
const { extractJobsFromHtml, findCareerLinks } = require("./extractors");
const { normalizeDiscoveryResult } = require("./normalizer");
const { scoreDiscovery } = require("./scoring");
const { normalizeUrl } = require("./utils");

const SOURCE_TYPES = new Set(["career_page", "greenhouse", "lever", "workday", "unknown"]);

function validateSource(source) {
  if (!source || typeof source !== "object") throw new Error("Source input is required.");
  if (!source.employerName) throw new Error("Source employerName is required.");
  if (!source.employerWebsiteUrl) throw new Error("Source employerWebsiteUrl is required.");
  if (!SOURCE_TYPES.has(source.sourceType)) {
    throw new Error(`Unsupported sourceType: ${source.sourceType}`);
  }
}

async function fetchSourcePages(source, options = {}) {
  const notes = [];
  const pages = [];
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 1;
  const firstUrl = normalizeUrl(source.careersUrl || source.employerWebsiteUrl);
  const firstPage = await fetchPage(firstUrl, options);

  if (firstPage.ok) {
    pages.push(firstPage);
  } else {
    notes.push(...firstPage.notes);
    return { pages, notes };
  }

  if (!source.careersUrl && maxDepth >= 1) {
    const careerLinks = findCareerLinks(firstPage.html, firstPage.finalUrl);
    for (const link of careerLinks.slice(0, options.maxFollowLinks || 1)) {
      const page = await fetchPage(link, options);
      if (page.ok) pages.push(page);
      else notes.push(...page.notes.map((note) => `${link}: ${note}`));
    }
  }

  return { pages, notes };
}

async function discoverJobsForSource(source, options = {}) {
  validateSource(source);
  const logger = options.logger || console;
  const sourceForPipeline = {
    ...source,
    sourceType: source.sourceType || "unknown",
    careersUrl: source.careersUrl || null,
    industryKey: source.industryKey || null,
  };

  const { pages, notes } = await fetchSourcePages(sourceForPipeline, options);
  const rawResults = [];
  for (const page of pages) {
    rawResults.push(...extractJobsFromHtml(page.html, page.finalUrl, sourceForPipeline));
  }

  const normalizedJobs = rawResults
    .map((result) => {
      const normalized = normalizeDiscoveryResult(result, sourceForPipeline, options);
      const scoring = scoreDiscovery(result, normalized, options);
      return {
        discoveryResult: {
          ...result,
          confidenceScore: scoring.confidenceScore,
          extractionNotes: scoring.extractionNotes,
        },
        normalizedJob: {
          ...normalized,
          status: "needs_review",
        },
      };
    })
    .filter((item) => item.normalizedJob.title);

  if (!normalizedJobs.length) {
    logger.warn?.("No jobs discovered for source", {
      employerName: sourceForPipeline.employerName,
      careersUrl: sourceForPipeline.careersUrl,
      employerWebsiteUrl: sourceForPipeline.employerWebsiteUrl,
      notes,
    });
  }

  return {
    source: sourceForPipeline,
    discoveredAt: new Date().toISOString(),
    notes,
    jobs: normalizedJobs,
  };
}

async function discoverJobsForSources(sources, options = {}) {
  const results = [];
  for (const source of sources) {
    try {
      results.push(await discoverJobsForSource(source, options));
      if (options.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    } catch (error) {
      results.push({
        source,
        discoveredAt: new Date().toISOString(),
        notes: [error.message],
        jobs: [],
        error: error.message,
      });
    }
  }
  return results;
}

module.exports = {
  discoverJobsForSource,
  discoverJobsForSources,
};
