const { mergeJobHealthPolicy } = require("./policy");

const OUTCOME_SCORES = Object.freeze({
  pass: 100,
  soft_fail: 40,
  hard_fail: 0,
  inconclusive: 55,
  unknown: 50,
});

const OUTCOME_CONFIDENCE = Object.freeze({
  pass: 90,
  soft_fail: 70,
  hard_fail: 95,
  inconclusive: 35,
  unknown: 0,
});

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function roundScore(value) {
  return Math.round(clamp(value) * 100) / 100;
}

function daysBetween(older, newer) {
  if (!older) return null;
  const oldDate = older instanceof Date ? older : new Date(older);
  const newDate = newer instanceof Date ? newer : new Date(newer);
  if (Number.isNaN(oldDate.getTime()) || Number.isNaN(newDate.getTime())) return null;
  return Math.max(0, (newDate.getTime() - oldDate.getTime()) / 86_400_000);
}

function freshnessScoreForAge(ageDays, evergreen = false) {
  if (!Number.isFinite(ageDays)) return evergreen ? 65 : 50;
  if (ageDays <= 14) return 100;
  if (ageDays <= 30) return 90;
  if (ageDays <= 60) return 75;
  if (ageDays <= 90) return 60;
  if (ageDays <= 180) return evergreen ? 65 : 40;
  if (ageDays <= 365) return evergreen ? 55 : 25;
  return evergreen ? 45 : 10;
}

function scoreFreshness(input = {}, now = new Date()) {
  const sourceAgeDays = daysBetween(input.sourcePostedAt, now);
  const successfulAgeDays = daysBetween(input.lastSuccessfulVerificationAt, now);
  const sourceScore = freshnessScoreForAge(sourceAgeDays, input.evergreen === true);
  const verificationScore =
    successfulAgeDays === null
      ? 45
      : successfulAgeDays <= 7
      ? 100
      : successfulAgeDays <= 14
      ? 85
      : successfulAgeDays <= 30
      ? 65
      : successfulAgeDays <= 60
      ? 40
      : 20;

  const hasSourceDate = sourceAgeDays !== null;
  const hasSuccessfulVerification = successfulAgeDays !== null;
  const score =
    hasSourceDate && hasSuccessfulVerification
      ? sourceScore * 0.55 + verificationScore * 0.45
      : hasSourceDate
      ? sourceScore
      : hasSuccessfulVerification
      ? verificationScore
      : 50;

  return {
    score: roundScore(score),
    confidence: hasSourceDate && hasSuccessfulVerification ? 95 : hasSourceDate || hasSuccessfulVerification ? 70 : 15,
    sourceAgeDays: sourceAgeDays === null ? null : Math.round(sourceAgeDays * 100) / 100,
    successfulVerificationAgeDays:
      successfulAgeDays === null ? null : Math.round(successfulAgeDays * 100) / 100,
  };
}

function normalizeSignal(signal = {}) {
  const outcome = Object.prototype.hasOwnProperty.call(OUTCOME_SCORES, signal.outcome)
    ? signal.outcome
    : "unknown";
  return {
    outcome,
    score: roundScore(signal.score ?? OUTCOME_SCORES[outcome]),
    confidence: roundScore(signal.confidence ?? OUTCOME_CONFIDENCE[outcome]),
    reasonCodes: Array.isArray(signal.reasonCodes)
      ? signal.reasonCodes.map(String).filter(Boolean)
      : [],
  };
}

function classifyHealthStatus(score, thresholds) {
  if (score >= thresholds.healthy) return "healthy";
  if (score >= thresholds.warning) return "warning";
  if (score >= thresholds.stale) return "stale";
  return "broken";
}

function verificationStatusFor({
  healthStatus,
  applicationOutcome,
  specificPositionOutcome,
}) {
  if (applicationOutcome === "unknown" && specificPositionOutcome === "unknown") {
    return "pending";
  }
  if (applicationOutcome === "inconclusive") return "inconclusive";
  if (healthStatus === "broken") return "failed";
  if (healthStatus === "warning" || healthStatus === "stale") return "warning";
  return "verified";
}

function uniqueReasonCodes(components) {
  return [
    ...new Set(
      Object.values(components)
        .flatMap((component) => component.reasonCodes || [])
        .map(String)
        .filter(Boolean)
    ),
  ];
}

function evaluateJobHealth(input = {}, policyOverrides = {}, now = new Date()) {
  const policy = mergeJobHealthPolicy(policyOverrides);
  const applicationDestination = normalizeSignal(input.applicationDestination);
  const specificPosition = normalizeSignal(input.specificPosition);
  const freshness = scoreFreshness(input.freshness, now);
  const employerActivity = {
    score: roundScore(input.employerActivity?.score ?? 50),
    confidence: roundScore(input.employerActivity?.confidence ?? 20),
    reasonCodes: input.employerActivity?.reasonCodes || [],
  };
  const engagementQuality = {
    score: roundScore(input.engagementQuality?.score ?? 50),
    confidence: roundScore(input.engagementQuality?.confidence ?? 10),
    reasonCodes: input.engagementQuality?.reasonCodes || [],
  };

  const components = {
    applicationDestination,
    specificPosition,
    freshness: {
      ...freshness,
      reasonCodes: input.freshness?.reasonCodes || [],
    },
    employerActivity,
    engagementQuality,
  };

  const weightEntries = Object.entries(policy.weights);
  const totalWeight = weightEntries.reduce((sum, [, weight]) => sum + Number(weight || 0), 0) || 1;
  let score =
    weightEntries.reduce(
      (sum, [key, weight]) => sum + (components[key]?.score ?? 0) * Number(weight || 0),
      0
    ) / totalWeight;
  const weightedConfidence =
    weightEntries.reduce(
      (sum, [key, weight]) => sum + (components[key]?.confidence ?? 0) * Number(weight || 0),
      0
    ) / totalWeight;
  const hasEvidence = Boolean(
    input.applicationDestination ||
      input.specificPosition ||
      input.freshness?.sourcePostedAt ||
      input.freshness?.lastSuccessfulVerificationAt ||
      input.employerActivity ||
      input.engagementQuality
  );

  if (applicationDestination.outcome === "hard_fail") score = Math.min(score, 35);
  if (specificPosition.outcome === "soft_fail") score = Math.min(score, 79);
  if (specificPosition.outcome === "hard_fail") score = Math.min(score, 55);
  if (
    applicationDestination.outcome === "hard_fail" &&
    specificPosition.outcome === "hard_fail"
  ) {
    score = Math.min(score, 20);
  }

  const healthScore = roundScore(score);
  const roundedConfidence = hasEvidence ? roundScore(weightedConfidence) : 0;
  const healthStatus = classifyHealthStatus(healthScore, policy.thresholds);
  const verificationStatus = verificationStatusFor({
    healthStatus,
    applicationOutcome: applicationDestination.outcome,
    specificPositionOutcome: specificPosition.outcome,
  });
  const reasonCodes = uniqueReasonCodes(components);

  return {
    healthScore,
    healthStatus,
    confidenceScore: roundedConfidence,
    verificationStatus,
    primaryReasonCode: reasonCodes[0] || null,
    reasonCodes,
    components,
    policyVersion: policy.version,
    evaluatedAt: now.toISOString(),
  };
}

module.exports = {
  OUTCOME_SCORES,
  clamp,
  classifyHealthStatus,
  evaluateJobHealth,
  freshnessScoreForAge,
  scoreFreshness,
};
