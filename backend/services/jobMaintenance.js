const { discoverJobsForSource } = require("../../src/lib/job-discovery");
const eyecareDiscoveryConfig = require("../../src/lib/job-discovery/industries/eyecare.ts");
const { one, query } = require("./db");
const { saveDiscoveryRun } = require("./jobImportRepository");
const {
  recordDiscoverySourceRun,
  toSourceInput,
} = require("./jobDiscoverySourceRepository");

const TERMINAL_HTTP_STATUSES = new Set([404, 410]);
const DEFAULT_VALIDATION_BATCH_SIZE = 24;
const DEFAULT_VALIDATION_CONCURRENCY = 6;
const DEFAULT_REQUEST_TIMEOUT_MS = 6000;
const HEALTHY_RECHECK_DAYS = 14;
const SUSPECT_RECHECK_DAYS = 2;
const DISCOVERY_RECHECK_DAYS = 7;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function healthResultForStatus(status) {
  if (status >= 200 && status < 400) return "healthy";
  if (TERMINAL_HTTP_STATUSES.has(status)) return "terminal";
  return "error";
}

function failureStateForResult(job = {}, result = {}) {
  const previousFailureCount = Number(job.health_failure_count || 0);
  if (result.result !== "terminal") {
    return { failureCount: previousFailureCount + 1, shouldArchive: false };
  }

  const failureCount = job.health_status === "suspect" ? previousFailureCount + 1 : 1;
  return { failureCount, shouldArchive: failureCount >= 2 };
}

async function fetchForHealth(url, options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Global fetch is unavailable.");

  const controller = new AbortController();
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    DEFAULT_REQUEST_TIMEOUT_MS,
    1000,
    15000
  );
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Jobs.Vision-JobHealth/1.0 (+https://www.jobs.vision)",
  };

  async function request(method) {
    const response = await fetchImpl(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: method === "GET" ? { ...headers, Range: "bytes=0-2047" } : headers,
    });
    if (method === "GET") await response.body?.cancel?.();
    return response;
  }

  try {
    const head = await request("HEAD");
    if (healthResultForStatus(head.status) === "healthy") {
      return { result: "healthy", statusCode: head.status, method: "HEAD" };
    }

    const get = await request("GET");
    return {
      result: healthResultForStatus(get.status),
      statusCode: get.status,
      method: "GET",
    };
  } catch (error) {
    return {
      result: "error",
      statusCode: null,
      method: null,
      error: error?.name === "AbortError" ? "Request timed out." : error?.message || "Request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function jobsDueForValidation(limit) {
  const result = await query(
    `
      select
        id,
        coalesce(external_apply_url, source_url) as health_url,
        health_failure_count,
        health_status
      from public.jobs
      where status = 'active'
        and is_archived = false
        and (
          listing_source = 'imported'
          or source in ('discovery', 'import', 'imported')
        )
        and coalesce(external_apply_url, source_url) is not null
        and (health_next_check_at is null or health_next_check_at <= now())
      order by
        case when health_checked_at is null then 0 else 1 end,
        health_next_check_at asc nulls first,
        health_checked_at asc nulls first,
        posted_at asc
      limit $1
    `,
    [limit]
  );
  return result.rows || [];
}

async function saveHealthResult(job, result, now = new Date()) {
  if (result.result === "healthy") {
    await query(
      `
        update public.jobs
        set health_status = 'healthy',
            health_checked_at = $2,
            health_status_code = $3,
            health_failure_count = 0,
            health_next_check_at = $4,
            health_last_error = null,
            health_archive_reason = null,
            updated_at = now()
        where id = $1
      `,
      [job.id, now, result.statusCode, addDays(now, HEALTHY_RECHECK_DAYS)]
    );
    return "healthy";
  }

  const failureState = failureStateForResult(job, result);
  const failureCount = failureState.failureCount;
  if (failureState.shouldArchive) {
    const reason = `Archived after ${failureCount} consecutive terminal source checks; latest HTTP status ${result.statusCode}.`;
    await query(
      `
        update public.jobs
        set status = 'archived',
            is_archived = true,
            archived_at = $2,
            health_status = 'archived',
            health_checked_at = $2,
            health_status_code = $3,
            health_failure_count = $4,
            health_next_check_at = null,
            health_last_error = $5,
            health_archive_reason = $5,
            total_active_seconds = coalesce(total_active_seconds, 0) + case
              when last_activated_at is null then 0
              else greatest(0, extract(epoch from ($2 - last_activated_at))::integer)
            end,
            updated_at = now()
        where id = $1
      `,
      [job.id, now, result.statusCode, failureCount, reason]
    );
    return "archived";
  }

  const isTerminal = result.result === "terminal";
  const retryDays = isTerminal
    ? SUSPECT_RECHECK_DAYS
    : Math.min(14, 2 ** Math.max(0, failureCount - 1));
  const message = isTerminal
    ? `Terminal HTTP status ${result.statusCode}; one confirming check is required before archive.`
    : result.error || `HTTP status ${result.statusCode || "unknown"}.`;

  await query(
    `
      update public.jobs
      set health_status = $2,
          health_checked_at = $3,
          health_status_code = $4,
          health_failure_count = $5,
          health_next_check_at = $6,
          health_last_error = $7,
          updated_at = now()
      where id = $1
    `,
    [
      job.id,
      isTerminal ? "suspect" : "error",
      now,
      result.statusCode,
      failureCount,
      addDays(now, retryDays),
      message,
    ]
  );
  return isTerminal ? "suspect" : "error";
}

async function validateDueJobs(options = {}) {
  const limit = boundedInteger(
    options.limit || process.env.JOB_MAINTENANCE_VALIDATION_BATCH_SIZE,
    DEFAULT_VALIDATION_BATCH_SIZE,
    1,
    100
  );
  const concurrency = boundedInteger(
    options.concurrency || process.env.JOB_MAINTENANCE_VALIDATION_CONCURRENCY,
    DEFAULT_VALIDATION_CONCURRENCY,
    1,
    10
  );
  const jobs = await jobsDueForValidation(limit);
  const metrics = { selected: jobs.length, checked: 0, healthy: 0, suspect: 0, errors: 0, archived: 0 };
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      const result = await fetchForHealth(job.health_url, {
        fetchImpl: options.fetchImpl,
        timeoutMs: options.timeoutMs || process.env.JOB_MAINTENANCE_REQUEST_TIMEOUT_MS,
      });
      const outcome = await saveHealthResult(job, result);
      metrics.checked += 1;
      if (outcome === "healthy") metrics.healthy += 1;
      else if (outcome === "suspect") metrics.suspect += 1;
      else if (outcome === "archived") metrics.archived += 1;
      else metrics.errors += 1;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
  return metrics;
}

function discoveryOptions(source) {
  return {
    industryConfig: source.industryKey === "eyecare" ? eyecareDiscoveryConfig : null,
    maxDepth: 1,
    maxFollowLinks: 1,
    maxAtsJobs: boundedInteger(process.env.JOB_MAINTENANCE_DISCOVERY_MAX_ATS_JOBS, 150, 10, 500),
    maxIcimsPages: boundedInteger(process.env.JOB_MAINTENANCE_DISCOVERY_MAX_ICIMS_PAGES, 2, 1, 5),
    atsPageDelayMs: boundedInteger(process.env.JOB_DISCOVERY_ATS_PAGE_DELAY_MS, 150, 0, 2000),
    timeoutMs: boundedInteger(process.env.JOB_MAINTENANCE_REQUEST_TIMEOUT_MS, 6000, 1000, 15000),
    delayMs: 250,
    logger: console,
  };
}

async function nextDiscoverySource() {
  return one(
    `
      select *
      from public.job_discovery_sources
      where enabled = true
        and (last_run_at is null or last_run_at <= now() - ($1 * interval '1 day'))
      order by last_run_at asc nulls first, employer_name asc
      limit 1
    `,
    [DISCOVERY_RECHECK_DAYS]
  );
}

async function runIncrementalDiscovery() {
  const row = await nextDiscoverySource();
  if (!row) return { sourceId: null, skipped: true, discovered: 0, saved: 0, failures: 0 };

  const source = toSourceInput(row);
  try {
    const run = await discoverJobsForSource(source, discoveryOptions(source));
    const saved = await saveDiscoveryRun(run, { discoveredBy: "cron" });
    await recordDiscoverySourceRun(row.id, {
      status: "success",
      message: `${saved.length} review item(s) refreshed or saved by incremental maintenance.`,
      discoveredCount: saved.length,
    });
    return {
      sourceId: row.id,
      employerName: row.employer_name,
      skipped: false,
      discovered: run.jobs.length,
      saved: saved.length,
      failures: 0,
    };
  } catch (error) {
    await recordDiscoverySourceRun(row.id, {
      status: "failed",
      message: error?.message || "Discovery failed.",
      discoveredCount: 0,
    });
    return {
      sourceId: row.id,
      employerName: row.employer_name,
      skipped: false,
      discovered: 0,
      saved: 0,
      failures: 1,
      error: error?.message || "Discovery failed.",
    };
  }
}

async function startMaintenanceRun(runType = "maintenance") {
  return one(
    `insert into public.job_maintenance_runs (run_type) values ($1) returning id, started_at`,
    [runType]
  );
}

async function finishMaintenanceRun(id, status, metrics = {}, errorMessage = null) {
  return one(
    `
      update public.job_maintenance_runs
      set status = $2,
          completed_at = now(),
          metrics = $3::jsonb,
          error_message = $4
      where id = $1
      returning *
    `,
    [id, status, JSON.stringify(metrics), errorMessage]
  );
}

async function runMaintenance(options = {}) {
  const run = await startMaintenanceRun();
  try {
    const validation = await validateDueJobs(options.validation || {});
    const discovery = await runIncrementalDiscovery();
    const metrics = { validation, discovery };
    const status = validation.errors > 0 || discovery.failures > 0 ? "partial" : "success";
    await finishMaintenanceRun(run.id, status, metrics);
    return { ok: true, runId: run.id, status, ...metrics };
  } catch (error) {
    await finishMaintenanceRun(run.id, "failed", {}, error?.message || "Maintenance failed.");
    throw error;
  }
}

module.exports = {
  failureStateForResult,
  fetchForHealth,
  healthResultForStatus,
  runIncrementalDiscovery,
  runMaintenance,
  validateDueJobs,
};
