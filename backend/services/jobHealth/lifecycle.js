const { mergeJobHealthPolicy } = require("./policy");

const FAILURE_OUTCOMES = new Set(["hard_fail", "soft_fail"]);

function countRecentOutcomes(checks = [], acceptedOutcomes = new Set()) {
  let count = 0;
  for (const check of checks) {
    const outcome = String(check?.outcome || "unknown");
    if (outcome === "inconclusive" || outcome === "unknown") continue;
    if (!acceptedOutcomes.has(outcome)) break;
    count += 1;
  }
  return count;
}

function daysSince(value, now = new Date()) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 86_400_000);
}

function noAction(recommendedAction = null, blockedBy = null, evidence = {}) {
  return {
    action: "none",
    recommendedAction,
    blockedBy,
    evidence,
  };
}

function decideHealthLifecycle({
  job = {},
  evaluation,
  recentChecks = [],
  policy: policyOverrides = {},
  now = new Date(),
} = {}) {
  const policy = mergeJobHealthPolicy(policyOverrides);
  const failureConfirmations = countRecentOutcomes(recentChecks, FAILURE_OUTCOMES);
  const hardFailureConfirmations = countRecentOutcomes(
    recentChecks,
    new Set(["hard_fail"])
  );
  const passConfirmations = countRecentOutcomes(recentChecks, new Set(["pass"]));
  const hiddenDays = daysSince(job.health_hidden_at, now);
  const evidence = {
    failureConfirmations,
    hardFailureConfirmations,
    passConfirmations,
    hiddenDays,
    healthScore: evaluation.healthScore,
    confidenceScore: evaluation.confidenceScore,
  };

  if (job.is_archived || job.status === "archived") {
    return noAction(null, "already_archived", evidence);
  }

  const confidenceIsActionable =
    evaluation.confidenceScore >= policy.thresholds.minimumActionConfidence;
  const belowPublicThreshold =
    evaluation.healthScore < policy.thresholds.publicVisibilityMinimum;
  const sufficientlyConfirmed =
    failureConfirmations >= policy.lifecycle.failureConfirmationsRequired;

  if (job.health_hidden_at) {
    const shouldRestore =
      evaluation.healthStatus === "healthy" &&
      confidenceIsActionable &&
      passConfirmations >= policy.lifecycle.restoreConfirmationsRequired;
    if (shouldRestore) {
      if (policy.automation.shadowMode) {
        return noAction("restore", "shadow_mode", evidence);
      }
      if (!policy.automation.allowAutomaticRestore) {
        return noAction("restore", "automatic_restore_disabled", evidence);
      }
      return { action: "restore", reasonCode: "health_recovered", evidence };
    }

    const shouldArchive =
      hiddenDays !== null &&
      hiddenDays >= policy.lifecycle.archiveAfterHiddenDays &&
      hardFailureConfirmations >= policy.lifecycle.archiveConfirmationsRequired;
    if (shouldArchive) {
      if (policy.automation.shadowMode) {
        return noAction("archive", "shadow_mode", evidence);
      }
      if (!policy.automation.allowAutomaticArchive) {
        return noAction("archive", "automatic_archive_disabled", evidence);
      }
      return {
        action: "archive",
        reasonCode: evaluation.primaryReasonCode || "health_failure_persisted",
        evidence,
      };
    }

    return noAction(null, "health_hold_remains", evidence);
  }

  if (belowPublicThreshold && confidenceIsActionable && sufficientlyConfirmed) {
    if (policy.automation.shadowMode) {
      return noAction("hide", "shadow_mode", evidence);
    }
    if (!policy.automation.allowAutomaticHide) {
      return noAction("hide", "automatic_hide_disabled", evidence);
    }
    return {
      action: "hide",
      reasonCode: evaluation.primaryReasonCode || "health_below_public_threshold",
      evidence,
    };
  }

  return noAction(null, "threshold_not_met", evidence);
}

module.exports = {
  countRecentOutcomes,
  daysSince,
  decideHealthLifecycle,
};

