const { evaluateJobHealth } = require("./scoring");
const { nextVerificationAtFor } = require("./scheduler");
const {
  claimJobsDueForVerification,
  getActiveJobHealthPolicy,
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
    outcomes: {},
  };

  for (const job of jobs) {
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
      await saveHealthEvaluation({
        jobId: job.id,
        evaluation: result.evaluation,
        evidenceCheckIds: [check.id],
        nextVerificationAt: result.nextVerificationAt,
        leaseId: job.verification_lease_id,
      });
      summary.completed += 1;
      const outcome = result.verification.check.outcome;
      summary.outcomes[outcome] = (summary.outcomes[outcome] || 0) + 1;
    } catch (error) {
      summary.failed += 1;
      await releaseVerificationLease(job.id, job.verification_lease_id, {
        error: error?.message || String(error),
        retryAfterMinutes: 30,
      }).catch(() => {});
    }
  }

  return summary;
}

module.exports = {
  runDueJobHealthChecks,
  verifyAndScoreJob,
};
