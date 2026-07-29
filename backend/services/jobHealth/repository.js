const { pool, query, one } = require("../db");

const JOB_HEALTH_SELECT = `
  id,
  status,
  is_archived,
  archived_at,
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
  health_hidden_at,
  health_previous_status,
  health_hidden_reason,
  health_archived_at
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

async function claimJobsDueForVerification({ limit = 100, leaseMinutes = 15 } = {}) {
  const safeLeaseMinutes = Math.min(60, Math.max(1, Number(leaseMinutes) || 15));
  return query(
    `
      with due as (
        select id
        from public.jobs
        where is_archived = false
          and status in ('active', 'paused', 'pending_domain')
          and next_verification_at <= now()
          and (
            verification_lease_expires_at is null
            or verification_lease_expires_at <= now()
          )
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
        for update skip locked
        limit $1
      )
      update public.jobs jobs
      set
        verification_lease_id = gen_random_uuid(),
        verification_lease_expires_at = now() + make_interval(mins => $2)
      from due
      where jobs.id = due.id
      returning
        jobs.id,
        jobs.title,
        jobs.company,
        jobs.employer_name,
        jobs.location,
        jobs.source,
        jobs.source_url,
        jobs.external_apply_url,
        jobs.posted_at,
        jobs.created_at,
        jobs.health_score,
        jobs.health_status,
        jobs.health_confidence_score,
        jobs.verification_status,
        jobs.last_verified_at,
        jobs.last_successful_verification_at,
        jobs.next_verification_at,
        jobs.health_hidden_at,
        jobs.health_previous_status,
        jobs.health_hidden_reason,
        jobs.health_archived_at,
        jobs.status,
        jobs.is_archived,
        jobs.archived_at,
        jobs.verification_lease_id,
        jobs.verification_lease_expires_at
    `,
    [boundedLimit(limit), safeLeaseMinutes]
  ).then((result) => result.rows || []);
}

async function getRecentHealthChecks(jobId, { limit = 10, windowDays = 7 } = {}) {
  const safeWindowDays = Math.min(90, Math.max(1, Number(windowDays) || 7));
  return query(
    `
      select
        id,
        verifier_key,
        verifier_version,
        outcome,
        confidence_score,
        reason_codes,
        completed_at,
        http_status,
        error_code
      from public.job_health_checks
      where job_id = $1
        and completed_at >= now() - make_interval(days => $3)
      order by completed_at desc, created_at desc
      limit $2
    `,
    [jobId, boundedLimit(limit, 10, 50), safeWindowDays]
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
  leaseId = null,
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
          verification_lease_id = null,
          verification_lease_expires_at = null,
          verification_attempt_count = verification_attempt_count + 1,
          verification_last_error = null,
          updated_at = now()
        where id = $1
          and ($12::uuid is null or verification_lease_id = $12::uuid)
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
        leaseId,
      ]
    );
    if (!updatedResult.rows[0]) {
      throw new Error(`Verification lease no longer belongs to this worker: ${jobId}`);
    }

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

async function releaseVerificationLease(
  jobId,
  leaseId,
  { error = null, retryAfterMinutes = 30 } = {}
) {
  const safeRetryMinutes = Math.min(
    1_440,
    Math.max(1, Number(retryAfterMinutes) || 30)
  );
  return one(
    `
      update public.jobs
      set
        verification_lease_id = null,
        verification_lease_expires_at = null,
        verification_attempt_count = verification_attempt_count + 1,
        verification_last_error = $3,
        next_verification_at = now() + make_interval(mins => $4),
        updated_at = now()
      where id = $1
        and verification_lease_id = $2::uuid
      returning ${JOB_HEALTH_SELECT}
    `,
    [jobId, leaseId, error ? String(error).slice(0, 500) : null, safeRetryMinutes]
  );
}

async function applyHealthLifecycleAction({
  jobId,
  action,
  reasonCode,
  reason = null,
  policyVersion,
  evidenceCheckIds = [],
  evidence = {},
  actorType = "automation",
}) {
  if (!["hide", "restore", "archive"].includes(action)) {
    throw new Error(`Unsupported health lifecycle action: ${action}`);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const previousResult = await client.query(
      `
        select ${JOB_HEALTH_SELECT}
        from public.jobs
        where id = $1
        for update
      `,
      [jobId]
    );
    const previous = previousResult.rows[0];
    if (!previous) throw new Error(`Job not found: ${jobId}`);

    let updatedResult;
    if (action === "hide") {
      updatedResult = await client.query(
        `
          update public.jobs
          set
            health_previous_status = coalesce(health_previous_status, status),
            health_hidden_at = coalesce(health_hidden_at, now()),
            health_hidden_reason = $2,
            status = case when status = 'active' then 'paused' else status end,
            updated_at = now()
          where id = $1
            and is_archived = false
          returning ${JOB_HEALTH_SELECT}
        `,
        [jobId, reasonCode]
      );
    } else if (action === "restore") {
      updatedResult = await client.query(
        `
          update public.jobs
          set
            status = case
              when status = 'paused' and health_previous_status = 'active' then 'active'
              else status
            end,
            health_hidden_at = null,
            health_hidden_reason = null,
            health_previous_status = null,
            updated_at = now()
          where id = $1
            and is_archived = false
          returning ${JOB_HEALTH_SELECT}
        `,
        [jobId]
      );
    } else {
      updatedResult = await client.query(
        `
          update public.jobs
          set
            health_previous_status = coalesce(health_previous_status, status),
            health_hidden_at = coalesce(health_hidden_at, now()),
            health_hidden_reason = $2,
            health_archived_at = coalesce(health_archived_at, now()),
            status = 'archived',
            is_archived = true,
            archived_at = coalesce(archived_at, now()),
            updated_at = now()
          where id = $1
          returning ${JOB_HEALTH_SELECT}
        `,
        [jobId, reasonCode]
      );
    }

    const updated = updatedResult.rows[0];
    if (!updated) throw new Error(`Lifecycle action did not update job: ${jobId}`);

    await client.query(
      `
        insert into public.job_health_events (
          job_id,
          event_type,
          actor_type,
          previous_status,
          new_status,
          reason_code,
          reason,
          policy_version,
          evidence_check_ids,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        jobId,
        action === "hide" ? "hidden" : action === "restore" ? "restored" : "archived",
        actorType,
        previous.status,
        updated.status,
        reasonCode || null,
        reason,
        policyVersion || null,
        evidenceCheckIds,
        {
          lifecycleEvidence: json(evidence),
          previousJobStatus: previous.status,
          newJobStatus: updated.status,
        },
      ]
    );

    await client.query("commit");
    return updated;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  applyHealthLifecycleAction,
  claimJobsDueForVerification,
  getActiveJobHealthPolicy,
  getJobHealth,
  getJobsDueForVerification,
  getRecentHealthChecks,
  recordHealthCheck,
  releaseVerificationLease,
  saveHealthEvaluation,
};
