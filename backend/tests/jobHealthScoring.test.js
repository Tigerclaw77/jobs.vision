const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateJobHealth,
  freshnessScoreForAge,
} = require("../services/jobHealth/scoring");

const NOW = new Date("2026-07-29T12:00:00.000Z");

test("healthy verified job receives a high score", () => {
  const evaluation = evaluateJobHealth(
    {
      applicationDestination: { outcome: "pass", confidence: 98 },
      specificPosition: { outcome: "pass", confidence: 95 },
      freshness: {
        sourcePostedAt: "2026-07-20T12:00:00.000Z",
        lastSuccessfulVerificationAt: "2026-07-28T12:00:00.000Z",
      },
      employerActivity: { score: 90, confidence: 80 },
      engagementQuality: { score: 75, confidence: 60 },
    },
    {},
    NOW
  );

  assert.equal(evaluation.healthStatus, "healthy");
  assert.equal(evaluation.verificationStatus, "verified");
  assert.ok(evaluation.healthScore >= 90);
  assert.ok(evaluation.confidenceScore >= 80);
});

test("hard application failure caps health and preserves failure reason", () => {
  const evaluation = evaluateJobHealth(
    {
      applicationDestination: {
        outcome: "hard_fail",
        confidence: 99,
        reasonCodes: ["http_410"],
      },
      specificPosition: {
        outcome: "hard_fail",
        confidence: 95,
        reasonCodes: ["position_closed"],
      },
      freshness: {
        sourcePostedAt: "2026-07-28T12:00:00.000Z",
      },
      employerActivity: { score: 100, confidence: 100 },
      engagementQuality: { score: 100, confidence: 100 },
    },
    {},
    NOW
  );

  assert.equal(evaluation.healthStatus, "broken");
  assert.equal(evaluation.verificationStatus, "failed");
  assert.ok(evaluation.healthScore <= 20);
  assert.deepEqual(evaluation.reasonCodes, ["http_410", "position_closed"]);
  assert.equal(evaluation.primaryReasonCode, "http_410");
});

test("generic careers page degrades health without treating the URL as dead", () => {
  const evaluation = evaluateJobHealth(
    {
      applicationDestination: { outcome: "pass", confidence: 95 },
      specificPosition: {
        outcome: "soft_fail",
        confidence: 80,
        reasonCodes: ["generic_careers_page"],
      },
      freshness: {
        sourcePostedAt: "2026-07-10T12:00:00.000Z",
        lastSuccessfulVerificationAt: "2026-07-28T12:00:00.000Z",
      },
      employerActivity: { score: 60, confidence: 50 },
      engagementQuality: { score: 50, confidence: 10 },
    },
    {},
    NOW
  );

  assert.equal(evaluation.healthStatus, "warning");
  assert.equal(evaluation.verificationStatus, "warning");
  assert.equal(evaluation.primaryReasonCode, "generic_careers_page");
});

test("inconclusive network result is not classified as a hard failure", () => {
  const evaluation = evaluateJobHealth(
    {
      applicationDestination: {
        outcome: "inconclusive",
        reasonCodes: ["http_429"],
      },
      specificPosition: { outcome: "unknown" },
      freshness: {},
    },
    {},
    NOW
  );

  assert.notEqual(evaluation.healthStatus, "broken");
  assert.equal(evaluation.verificationStatus, "inconclusive");
});

test("unknown listing remains pending and receives bounded defaults", () => {
  const evaluation = evaluateJobHealth({}, {}, NOW);
  assert.equal(evaluation.verificationStatus, "pending");
  assert.ok(evaluation.healthScore >= 0 && evaluation.healthScore <= 100);
  assert.equal(evaluation.confidenceScore, 0);
});

test("freshness decay treats evergreen listings more conservatively", () => {
  assert.equal(freshnessScoreForAge(10, false), 100);
  assert.equal(freshnessScoreForAge(400, false), 10);
  assert.equal(freshnessScoreForAge(400, true), 45);
});

