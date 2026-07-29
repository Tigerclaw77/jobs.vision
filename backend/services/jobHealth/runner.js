const { evaluateJobHealth } = require("./scoring");
const { nextVerificationAtFor } = require("./scheduler");
const { decideHealthLifecycle } = require("./lifecycle");
const {
  applyHealthLifecycleAction,
  claimJobsDueForVerification,
  getActiveJobHealthPolicy,
  getRecentHealthChecks,
  recordHealthCheck,
  releaseVerificationLease,
  saveHealthEvaluation,
} = require("./repository");
const { verifyExternalApplication } = require("./httpVerifier");

async function verifyAndScoreJob(job, {
  policy,
  verifier = verifyExternalApplication,
  verifierOptions = {},
  now = new Date(),
} = {}) {
  const verification = await verifier({ job, ...verifierOptions });
  const evaluation = evaluateJobHealth(
    {
      applicationDestination: verification.applicationDestination,
      specificPosition: verification.specificPosition,
      freshness: {
        sourcePostedAt: job.posted_at || job.created_at,
        lastSuccessfulVerificationAt: job.last_successful_verification_at,
        evergreen: job.evergreen === true,
      },
    },
    policy,
    now
  );
  return {
    verification,
    evaluation,
    nextVerificationAt: nextVerificationAtFor(evaluation.healthStatus, policy, now),
  };
}

async function runDueJobHealthChecks({
  limit = 50,
  leaseMinutes = 15,
  concurrency = 5,
  verifier = verifyExternalApplication,
  verifierOptions = {},
} = {}) {
  const activePolicy = await getActiveJobHealthPolicy();
  const policy = { ...(activePolicy?.config || {}) };
  if (activePolicy?.version) policy.version = activePolicy.version;
  const jobs = await claimJobsDueForVerification({ limit, leaseMinutes });
  const summary = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
    lifecycleErrors: 0,
    outcomes: {},
    actions: {},
    recommendedActions: {},
  };

  async function processJob(job) {
    let evaluationSaved = false;
    try {
      const result = await verifyAndScoreJob(job, {
        policy,
        verifier,
        verifierOptions,
      });
      const check = await recordHealthCheck({
        jobId: job.id,
        ...result.verification.check,
      });
      const updatedJob = await saveHealthEvaluation({
        jobId: job.id,
        evaluation: result.evaluation,
        evidenceCheckIds: [check.id],
        nextVerificationAt: result.nextVerificationAt,
        leaseId: job.verification_lease_id,
      });
      evaluationSaved = true;
      summary.completed += 1;
      const outcome = result.verification.check.outcome;
      summary.outcomes[outcome] = (summary.outcomes[outcome] || 0) + 1;

      try {
        const recentChecks = await getRecentHealthChecks(job.id, {
          limit: Math.max(
            policy.lifecycle?.archiveConfirmationsRequired || 3,
            policy.lifecycle?.failureConfirmationsRequired || 2
          ) + 2,
          windowDays: policy.lifecycle?.recentEvidenceWindowDays || 7,
        });
        const decision = decideHealthLifecycle({
          job: { ...job, ...updatedJob },
          evaluation: result.evaluation,
          recentChecks,
          policy,
        });
        if (decision.recommendedAction) {
          summary.recommendedActions[decision.recommendedAction] =
            (summary.recommendedActions[decision.recommendedAction] || 0) + 1;
        }
        if (decision.action !== "none") {
          await applyHealthLifecycleAction({
            jobId: job.id,
            action: decision.action,
            reasonCode: decision.reasonCode,
            policyVersion: result.evaluation.policyVersion,
            evidenceCheckIds: [check.id],
            evidence: decision.evidence,
          });
          summary.actions[decision.action] =
            (summary.actions[decision.action] || 0) + 1;
        }
      } catch {
        summary.lifecycleErrors += 1;
      }
    } catch (error) {
      summary.failed += 1;
      if (!evaluationSaved) {
        await releaseVerificationLease(job.id, job.verification_lease_id, {
          error: error?.message || String(error),
          retryAfterMinutes: 30,
        }).catch(() => {});
      }
    }
  }

  const safeConcurrency = Math.min(10, Math.max(1, Number(concurrency) || 5));
  for (let index = 0; index < jobs.length; index += safeConcurrency) {
    await Promise.all(jobs.slice(index, index + safeConcurrency).map(processJob));
  }

  return summary;
}

module.exports = {
  runDueJobHealthChecks,
  verifyAndScoreJob,
};
