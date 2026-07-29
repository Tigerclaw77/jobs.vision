const { pool, query, one } = require("../db");

const JOB_HEALTH_SELECT = `
  id,
  health_score,
  health_status,
  health_confidence_score,
  verification_status,
  last_verified_at,
  last_successful_verification_at,
  next_verification_at,
  health_reason_code,
  health_reason_codes,
  health_policy_version,
  health_hidden_at
`;

function boundedLimit(value, fallback = 100, max = 500) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return fallback;
  return Math.min(numeric, max);
}

function json(value, fallback = {}) {
  return value && typeof value === "object" ? value : fallback;
}

async function getActiveJobHealthPolicy() {
  return one(
    `
      select version, name, config, enabled, effective_at, created_at
      from public.job_health_policies
      where enabled = true
        and (effective_at is null or effective_at <= now())
      order by effective_at desc nulls last, created_at desc
      limit 1
    `
  );
}

async function getJobHealth(jobId) {
  return one(
    `
      select ${JOB_HEALTH_SELECT}
      from public.jobs
      where id = $1
    `,
    [jobId]
  );
}

async function getJobsDueForVerification({ limit = 100 } = {}) {
  return query(
    `
      select
        id,
        title,
        company,
        employer_name,
        location,
        source,
        source_url,
        external_apply_url,
        posted_at,
        created_at,
        health_score,
        health_status,
        health_confidence_score,
        verification_status,
        last_verified_at,
        last_successful_verification_at,
        next_verification_at
      from public.jobs
      where is_archived = false
        and status in ('active', 'paused', 'pending_domain')
        and next_verification_at <= now()
      order by
        case health_status
          when 'broken' then 0
          when 'stale' then 1
          when 'warning' then 2
          when 'unknown' then 3
          else 4
        end,
        next_verification_at asc,
        created_at asc
      limit $1
    `,
    [boundedLimit(limit)]
  ).then((result) => result.rows || []);
}

async function recordHealthCheck(check) {
  return one(
    `
      insert into public.job_health_checks (
        job_id,
        verifier_key,
        verifier_version,
        outcome,
        confidence_score,
        reason_codes,
        started_at,
        completed_at,
        duration_ms,
        http_status,
        final_url,
        redirect_count,
        destination_domain,
        signals,
        error_code,
        error_detail,
        content_hash,
        evidence_excerpt
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      returning *
    `,
    [
      check.jobId,
      check.verifierKey,
      check.verifierVersion,
      check.outcome,
      check.confidenceScore ?? 0,
      check.reasonCodes || [],
      check.startedAt || new Date().toISOString(),
      check.completedAt || new Date().toISOString(),
      check.durationMs ?? null,
      check.httpStatus ?? null,
      check.finalUrl || null,
      check.redirectCount ?? null,
      check.destinationDomain || null,
      json(check.signals),
      check.errorCode || null,
      check.errorDetail || null,
      check.contentHash || null,
      check.evidenceExcerpt || null,
    ]
  );
}

async function saveHealthEvaluation({
  jobId,
  evaluation,
  evidenceCheckIds = [],
  nextVerificationAt,
  actorType = "automation",
}) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const previousResult = await client.query(
      `
        select health_status, verification_status
        from public.jobs
        where id = $1
        for update
      `,
      [jobId]
    );
    const previous = previousResult.rows[0];
    if (!previous) throw new Error(`Job not found: ${jobId}`);

    const successful = evaluation.verificationStatus === "verified";
    const updatedResult = await client.query(
      `
        update public.jobs
        set
          health_score = $2,
          health_status = $3,
          health_confidence_score = $4,
          verification_status = $5,
          last_verified_at = $6,
          last_successful_verification_at = case
            when $7::boolean then $6
            else last_successful_verification_at
          end,
          next_verification_at = $8,
          health_reason_code = $9,
          health_reason_codes = $10,
          health_policy_version = $11,
          updated_at = now()
        where id = $1
        returning ${JOB_HEALTH_SELECT}
      `,
      [
        jobId,
        evaluation.healthScore,
        evaluation.healthStatus,
        evaluation.confidenceScore,
        evaluation.verificationStatus,
        evaluation.evaluatedAt,
        successful,
        nextVerificationAt,
        evaluation.primaryReasonCode,
        evaluation.reasonCodes || [],
        evaluation.policyVersion,
      ]
    );

    await client.query(
      `
        insert into public.job_health_snapshots (
          job_id,
          health_score,
          health_status,
          confidence_score,
          verification_status,
          primary_reason_code,
          reason_codes,
          components,
          evidence_check_ids,
          policy_version,
          evaluated_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        on conflict (job_id) do update set
          health_score = excluded.health_score,
          health_status = excluded.health_status,
          confidence_score = excluded.confidence_score,
          verification_status = excluded.verification_status,
          primary_reason_code = excluded.primary_reason_code,
          reason_codes = excluded.reason_codes,
          components = excluded.components,
          evidence_check_ids = excluded.evidence_check_ids,
          policy_version = excluded.policy_version,
          evaluated_at = excluded.evaluated_at,
          updated_at = now()
      `,
      [
        jobId,
        evaluation.healthScore,
        evaluation.healthStatus,
        evaluation.confidenceScore,
        evaluation.verificationStatus,
        evaluation.primaryReasonCode,
        evaluation.reasonCodes || [],
        json(evaluation.components),
        evidenceCheckIds,
        evaluation.policyVersion,
        evaluation.evaluatedAt,
      ]
    );

    if (
      previous.health_status !== evaluation.healthStatus ||
      previous.verification_status !== evaluation.verificationStatus
    ) {
      await client.query(
        `
          insert into public.job_health_events (
            job_id,
            event_type,
            actor_type,
            previous_status,
            new_status,
            reason_code,
            policy_version,
            evidence_check_ids,
            metadata
          )
          values ($1, 'evaluation_changed', $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          jobId,
          actorType,
          previous.health_status,
          evaluation.healthStatus,
          evaluation.primaryReasonCode,
          evaluation.policyVersion,
          evidenceCheckIds,
          {
            previousVerificationStatus: previous.verification_status,
            newVerificationStatus: evaluation.verificationStatus,
          },
        ]
      );
    }

    await client.query("commit");
    return updatedResult.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getActiveJobHealthPolicy,
  getJobHealth,
  getJobsDueForVerification,
  recordHealthCheck,
  saveHealthEvaluation,
};

