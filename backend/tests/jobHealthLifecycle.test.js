const test = require("node:test");
const assert = require("node:assert/strict");
const {
  countRecentOutcomes,
  decideHealthLifecycle,
} = require("../services/jobHealth/lifecycle");

const NOW = new Date("2026-07-29T12:00:00.000Z");
const BROKEN_EVALUATION = {
  healthScore: 20,
  healthStatus: "broken",
  confidenceScore: 95,
  primaryReasonCode: "http_410",
};
const HEALTHY_EVALUATION = {
  healthScore: 95,
  healthStatus: "healthy",
  confidenceScore: 92,
  primaryReasonCode: null,
};
const ENABLED_POLICY = {
  automation: {
    shadowMode: false,
    allowAutomaticHide: true,
    allowAutomaticRestore: true,
    allowAutomaticArchive: true,
  },
};

test("requires repeated failure evidence before hiding", () => {
  const decision = decideHealthLifecycle({
    job: { status: "active", is_archived: false },
    evaluation: BROKEN_EVALUATION,
    recentChecks: [{ outcome: "hard_fail" }],
    policy: ENABLED_POLICY,
    now: NOW,
  });
  assert.equal(decision.action, "none");
  assert.equal(decision.blockedBy, "threshold_not_met");
});

test("hides after the configurable confirmation threshold", () => {
  const decision = decideHealthLifecycle({
    job: { status: "active", is_archived: false },
    evaluation: BROKEN_EVALUATION,
    recentChecks: [{ outcome: "hard_fail" }, { outcome: "hard_fail" }],
    policy: ENABLED_POLICY,
    now: NOW,
  });
  assert.equal(decision.action, "hide");
  assert.equal(decision.reasonCode, "http_410");
});

test("shadow mode reports the recommended action without mutating state", () => {
  const decision = decideHealthLifecycle({
    job: { status: "active", is_archived: false },
    evaluation: BROKEN_EVALUATION,
    recentChecks: [{ outcome: "hard_fail" }, { outcome: "hard_fail" }],
    policy: {
      automation: {
        shadowMode: true,
        allowAutomaticHide: false,
      },
    },
    now: NOW,
  });
  assert.equal(decision.action, "none");
  assert.equal(decision.recommendedAction, "hide");
  assert.equal(decision.blockedBy, "shadow_mode");
});

test("does not hide when evaluator confidence is below the policy threshold", () => {
  const decision = decideHealthLifecycle({
    job: { status: "active", is_archived: false },
    evaluation: { ...BROKEN_EVALUATION, confidenceScore: 40 },
    recentChecks: [{ outcome: "hard_fail" }, { outcome: "hard_fail" }],
    policy: ENABLED_POLICY,
    now: NOW,
  });
  assert.equal(decision.action, "none");
});

test("restores a hidden listing after a confident passing verification", () => {
  const decision = decideHealthLifecycle({
    job: {
      status: "paused",
      is_archived: false,
      health_hidden_at: "2026-07-28T12:00:00.000Z",
    },
    evaluation: HEALTHY_EVALUATION,
    recentChecks: [{ outcome: "pass" }],
    policy: ENABLED_POLICY,
    now: NOW,
  });
  assert.equal(decision.action, "restore");
  assert.equal(decision.reasonCode, "health_recovered");
});

test("archives rather than deletes after a prolonged confirmed failure", () => {
  const decision = decideHealthLifecycle({
    job: {
      status: "paused",
      is_archived: false,
      health_hidden_at: "2026-07-10T12:00:00.000Z",
    },
    evaluation: BROKEN_EVALUATION,
    recentChecks: [
      { outcome: "hard_fail" },
      { outcome: "hard_fail" },
      { outcome: "hard_fail" },
    ],
    policy: ENABLED_POLICY,
    now: NOW,
  });
  assert.equal(decision.action, "archive");
  assert.equal(decision.evidence.hardFailureConfirmations, 3);
});

test("inconclusive checks neither confirm nor erase consecutive failure evidence", () => {
  const count = countRecentOutcomes(
    [
      { outcome: "hard_fail" },
      { outcome: "inconclusive" },
      { outcome: "hard_fail" },
      { outcome: "pass" },
    ],
    new Set(["hard_fail", "soft_fail"])
  );
  assert.equal(count, 2);
});

