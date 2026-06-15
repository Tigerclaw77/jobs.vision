const { discoverJobsForSource, discoverJobsForSources } = require("./pipeline");
const { classifyJobForReview } = require("./classifier");
const { normalizeDiscoveryResult } = require("./normalizer");
const { scoreDiscovery } = require("./scoring");
const { createDuplicateKey } = require("./utils");

module.exports = {
  classifyJobForReview,
  createDuplicateKey,
  discoverJobsForSource,
  discoverJobsForSources,
  normalizeDiscoveryResult,
  scoreDiscovery,
};
