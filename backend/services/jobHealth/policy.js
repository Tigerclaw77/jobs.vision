const DEFAULT_JOB_HEALTH_POLICY = Object.freeze({
  version: "2026-07-29.1",
  weights: Object.freeze({
    applicationDestination: 45,
    specificPosition: 15,
    freshness: 20,
    employerActivity: 10,
    engagementQuality: 10,
  }),
  thresholds: Object.freeze({
    healthy: 80,
    warning: 60,
    stale: 40,
    publicVisibilityMinimum: 60,
    minimumActionConfidence: 70,
  }),
  scheduleHours: Object.freeze({
    healthy: 168,
    warning: 24,
    stale: 6,
    broken: 1,
    unknown: 1,
  }),
  automation: Object.freeze({
    shadowMode: true,
    allowAutomaticHide: false,
    allowAutomaticArchive: false,
  }),
});

function mergeJobHealthPolicy(policy = {}) {
  return {
    ...DEFAULT_JOB_HEALTH_POLICY,
    ...policy,
    weights: {
      ...DEFAULT_JOB_HEALTH_POLICY.weights,
      ...(policy.weights || {}),
    },
    thresholds: {
      ...DEFAULT_JOB_HEALTH_POLICY.thresholds,
      ...(policy.thresholds || {}),
    },
    scheduleHours: {
      ...DEFAULT_JOB_HEALTH_POLICY.scheduleHours,
      ...(policy.scheduleHours || {}),
    },
    automation: {
      ...DEFAULT_JOB_HEALTH_POLICY.automation,
      ...(policy.automation || {}),
    },
  };
}

module.exports = {
  DEFAULT_JOB_HEALTH_POLICY,
  mergeJobHealthPolicy,
};

