const { discoverJobsForSource, discoverJobsForSources } = require("./pipeline");
const { normalizeDiscoveryResult } = require("./normalizer");
const { scoreDiscovery } = require("./scoring");
const { createDuplicateKey } = require("./utils");

module.exports = {
  createDuplicateKey,
  discoverJobsForSource,
  discoverJobsForSources,
  normalizeDiscoveryResult,
  scoreDiscovery,
};
