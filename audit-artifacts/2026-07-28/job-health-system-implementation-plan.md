# jobs.vision automated job health system

## Decision

Implement this as a staged, self-maintaining pipeline. Do not immediately enable destructive
automation against production inventory. Start in shadow mode, compare classifications with a
sample of real listings, then progressively enable import quarantine, public hiding, and archival.

The system should optimize for candidate trust: an uncertain listing may be temporarily hidden
while it is rechecked. A low-confidence listing should not remain public merely to preserve the
headline inventory count.

## Existing foundations to reuse

- `public.jobs` already supports active, paused, and archived lifecycle states.
- `public.job_imports` already stores source URLs, application URLs, discovery timestamps,
  classifier confidence, review status, evergreen policy, source dates, and freshness timestamps.
- Imported jobs are already excluded from public results when their import is rejected.
- `public.job_apply_events` already records listing views and apply clicks.
- Listing reports already provide a candidate-feedback channel.
- The admin marketplace and SEO health reports already provide patterns for operational metrics.
- The importer already has a high-confidence automatic decision path.

These foundations make a separate health subsystem preferable to embedding more one-off conditions
in import scripts or public job queries.

## 1. Data model

Create migration `030_job_health_system.sql` in both `migrations/` and `neon-migrations/`.

### Columns on `public.jobs`

| Column | Type | Purpose |
| --- | --- | --- |
| `health_status` | text | `unknown`, `healthy`, `warning`, `stale`, `broken`, `quarantined` |
| `health_score` | numeric(5,2) | Current 0–100 score |
| `health_checked_at` | timestamptz | Last completed evaluation |
| `health_next_check_at` | timestamptz | Scheduler priority |
| `health_hidden_at` | timestamptz | When health automation removed public visibility |
| `health_reason_code` | text | Stable, filterable primary reason |
| `health_policy_version` | text | Scoring/action policy that produced the state |

Add a constraint for the allowed statuses and indexes on:

- `(health_next_check_at, health_status)`
- `(health_status, health_score)`
- `(source, health_status)`
- `(health_hidden_at desc)` where `health_hidden_at is not null`

### `public.job_health_checks`

Append-only evidence for each verification attempt:

- `id`, `job_id`, `verifier_key`, `verifier_version`
- `started_at`, `completed_at`, `duration_ms`
- `outcome`: `pass`, `soft_fail`, `hard_fail`, `inconclusive`
- `http_status`, `final_url`, `redirect_count`, `destination_domain`
- `signals jsonb` for matched closure phrases, title/requisition match, JSON-LD, DNS result, and
  generic-page confidence
- `error_code`, `error_detail`
- `content_hash` and `evidence_excerpt` with a strict short length limit

Do not store full crawled pages. They may contain personal data, tracking tokens, or copyrighted
content.

### `public.job_health_snapshots`

One current evaluation per job:

- component scores and weights in `components jsonb`
- total score, status, reason codes, evaluator version
- evidence check IDs
- `evaluated_at`

Keep the check log append-only and update this snapshot transactionally.

### `public.job_health_events`

Append-only audit log:

- transitions such as `reverify_scheduled`, `flagged`, `hidden`, `restored`, `archived`,
  `removed_from_public`
- actor `automation`, `admin`, `employer`, or `candidate_feedback`
- previous/new state, policy version, reason, evidence IDs, and timestamp

### Policy and batch support

- Add `public.job_health_policies` containing versioned JSON configuration, enabled state, optional
  employer/source scope, and effective date.
- Add `public.job_import_batches` and `job_imports.import_batch_id`. Batch records should contain
  source, importer version, start/end time, counts, and quality-gate results.
- Prefer a public-removal tombstone over deleting job rows. Permanent removal means inaccessible to
  users and excluded from feeds/sitemaps; evidence remains available to admins for audit and
  duplicate prevention.

## 2. Verification pipeline

Define a verifier interface in `backend/services/jobHealth/verifiers/`:

```js
async function verify(context) {
  return {
    verifierKey,
    outcome,
    confidence,
    signals,
    reasonCodes,
    checkedAt,
  };
}
```

An evaluator combines verifier results. Actions consume only the normalized evaluation, not raw
HTTP details. This lets browser checks, employer confirmations, candidate feedback, and future
classifiers be added without redesigning the pipeline.

### URL verifier

1. Validate that the destination is HTTP or HTTPS.
2. Resolve DNS and reject private, loopback, link-local, metadata-service, and reserved addresses.
   Repeat validation after every redirect to prevent SSRF and DNS rebinding.
3. Attempt `HEAD`; fall back to a limited `GET` when unsupported or insufficient.
4. Use a 10-second timeout, five-redirect maximum, one-megabyte response limit, per-domain
   concurrency limits, retry-after support, and a stable jobs.vision user agent.
5. Record:
   - 404/410 as high-confidence hard failures.
   - redirect loops, DNS failures, invalid TLS, and dead domains as hard failures after a
     corroborating retry.
   - 401/403/429/5xx as inconclusive, not evidence that the job is closed.

### Page-state verifier

Use normalized visible text, structured `JobPosting` data, and ATS identifiers. Maintain a
versioned phrase library for:

- job not found
- position filled or no longer available
- posting expired
- requisition closed
- no longer accepting applications

A phrase match is valid only when it occurs in the main content or structured job payload. Ignore
navigation, footers, cookie banners, and unrelated recommended jobs.

### Specific-position verifier

A generic careers page passes only when it still references the specific job through at least one
strong identifier or two moderate identifiers:

- Strong: requisition ID, canonical job URL, structured-data identifier.
- Moderate: normalized title, city/state, employer/practice, department.

If the final page is a careers search page and the job cannot be found, classify it as a soft
failure first. Recheck with a browser verifier before hiding unless another hard signal exists.

### Optional browser verifier

Run only for JavaScript-rendered or ambiguous pages. It should:

- wait for bounded network idle;
- capture final visible text and structured data;
- detect client-side redirects and error states;
- avoid form submission, login, or cookie acceptance unless strictly necessary;
- produce the same normalized verifier result.

Browser verification is expensive, so use it as escalation rather than the default.

## 3. Health and freshness score

Use a versioned 0–100 score. A recommended initial policy:

| Component | Weight | Notes |
| --- | ---: | --- |
| Application destination health | 45 | HTTP/DNS/redirect/page-state evidence |
| Specific-position confidence | 15 | Requisition/title/location still present |
| Freshness | 20 | Source date, last successful check, and evergreen policy |
| Employer/source activity | 10 | Recent verified inventory or employer confirmation |
| Candidate engagement quality | 10 | Apply clicks and feedback, guarded against sparse data |

Rules:

- A 404/410, dead domain, redirect loop, or explicit closed-state signal can cap the total below 40
  regardless of other components.
- Freshness decays gradually from the original source date and last successful verification.
- Verified employer edits or confirmations add confidence but do not override a known broken URL.
- Click-through rate must use a Bayesian prior and should not penalize jobs with fewer than 100
  impressions.
- An apply click is not an apply success. Add `apply_completed` only when an ATS callback,
  same-origin completion, or explicit candidate confirmation makes it measurable.
- Evergreen listings use an employer-specific policy and still require a working, specific
  application destination.
- Paid listings receive the same candidate-safety rules as imports. Payment must not buy exemption
  from health checks.

## 4. Statuses and automated actions

Initial thresholds should be configuration, not constants:

| Score/status | Public behavior | Automated action |
| --- | --- | --- |
| 80–100 Healthy | Normal ranking | Recheck in 7 days |
| 60–79 Warning | Visible but gradually downranked | Recheck in 24 hours |
| 40–59 Stale | Hidden from search, maps, feeds, and sitemap | Recheck in 6 hours; archive after 7 days unresolved |
| 0–39 Broken | Hidden immediately | Confirm on a separate attempt; archive when confirmed |
| Inconclusive | Preserve last known safe state briefly | Exponential retry; never treat a 429/5xx alone as closure |

High-confidence 404/410 or explicit closed language may hide after one check. Network failures,
generic-page misses, and ambiguous copy require two independent attempts at least 30 minutes apart.

State transitions:

1. `unknown` -> prioritized initial check.
2. `healthy` -> `warning` after soft confidence decay.
3. `warning` -> `stale` when below threshold or verification becomes overdue.
4. `stale`/`broken` -> public hide using a health visibility gate.
5. Confirmed unresolved state -> archive.
6. New successful evidence -> restore automatically unless an admin or employer explicitly closed
   the listing.
7. Archived for 90 days with repeated hard failure -> permanent public removal/tombstone.

For recruiter-owned paid jobs, notify the recruiter when a listing is hidden and give a direct edit
link. Billing behavior must be decided explicitly: recommended policy is to stop renewal for a
health-archived listing and never continue charging for a listing users cannot see.

## 5. Public visibility and ranking

Update every public job query, sitemap query, map query, and recommendations query to require:

```sql
health_status in ('healthy', 'warning')
```

During migration, treat `unknown` as visible only in shadow mode. After the initial backfill,
`unknown` should be hidden for newly imported jobs until their first successful check.

Ranking should multiply the existing relevance score by:

- healthy: `1.00`
- warning 70–79: `0.85`
- warning 60–69: `0.65`

Do not use raw health score as a substitute for search relevance; use it only as a confidence
multiplier and hard visibility gate.

## 6. Import quality gate

Create `backend/services/jobImportQuality.js` and run it before an import can be published.

### Hard reject

- missing or non-HTTP(S) application destination;
- explicit expired/filled/closed language tied to the position;
- exact duplicate destination/requisition already active;
- destination fails a confirmed hard health check.

### Quarantine

- navigation/footer text dominates the description;
- malformed or unbalanced HTML remains after sanitization;
- description is mostly links, menu labels, cookie text, or repeated boilerplate;
- near-duplicate description detected with normalized hash plus employer/title/location similarity;
- generic careers page cannot be tied to the specific position;
- source date is unavailable and no successful live verification exists.

### Quality signals

- normalize and sanitize HTML before scoring;
- compare visible-text length to anchor/navigation text;
- detect repeated sitewide boilerplate within each import batch;
- use exact hashes first, then a similarity fingerprint for near duplicates;
- maintain configurable forbidden phrase and navigation-token dictionaries;
- store all reason codes on the import row and expose them in admin filtering.

A new import should become public only after passing both the import quality gate and an initial
application health check.

## 7. Scheduler and operational safety

Do not add this to the existing in-process `node-cron` callback. Multiple application instances can
duplicate work, and serverless instances may not remain alive.

Use a dedicated scheduled worker such as `backend/scripts/run-job-health-worker.js`, triggered by
the deployment platform or a queue. Requirements:

- claim work with `for update skip locked` or an advisory lock;
- idempotency key `(job_id, verifier_key, scheduled_window)`;
- prioritize unknown, warning, stale, and candidate-reported jobs;
- domain-level rate limiting and circuit breakers;
- exponential retries with jitter;
- bounded batches and graceful shutdown;
- metrics for queue lag, check latency, outcome rates, hide/restore counts, and domain failures;
- alert when a source-wide failure would hide an abnormal percentage of inventory.

A source-wide circuit breaker must pause destructive actions when, for example, an ATS blocks the
crawler or changes markup across thousands of jobs.

## 8. Admin Job Health dashboard

Add `/admin/job-health`, linked from the existing Admin and Marketplace dashboards.

Summary cards:

- Healthy jobs
- Warning jobs
- Stale jobs
- Broken application links
- Recently hidden jobs
- Jobs needing review
- Unknown/unverified jobs
- Worker queue lag

Filters:

- source/ATS
- employer/practice
- import batch
- age range
- score range/status
- reason code
- last checked range
- listing source: imported or employer-submitted

Job detail drawer:

- score components and current policy version;
- redirect chain and HTTP/DNS outcome;
- matched closure/specificity evidence;
- check timeline and automated actions;
- source/import batch;
- public visibility state;
- `Recheck now`, `Restore with expiring override`, and `Archive` actions.

Every override requires a reason and expiry. The system should re-evaluate when the override expires.

Suggested API:

- `GET /api/admin/job-health/summary`
- `GET /api/admin/job-health/jobs`
- `GET /api/admin/job-health/jobs/:id`
- `POST /api/admin/job-health/jobs/:id/recheck`
- `POST /api/admin/job-health/jobs/:id/override`
- `GET /api/admin/job-health/policies`
- `POST /api/admin/job-health/policies` with version creation, never in-place mutation

## 9. Candidate and employer feedback

- Add structured listing-report reasons `job_closed`, `application_broken`, and
  `wrong_destination`.
- One report triggers a priority recheck; reports do not automatically hide a job by themselves.
- Multiple independent reports plus a failing verifier may satisfy confirmation.
- Let a verified employer confirm “still hiring” or “position filled.” A filled confirmation hides
  immediately; a still-hiring confirmation raises freshness confidence but cannot override a dead
  destination.

## 10. Rollout

### Phase 0 — Shadow mode

- Add schema, checks, evaluator, audit logs, and dashboard.
- Backfill active jobs in rate-limited batches.
- Take no public actions for at least seven days.
- Manually review stratified samples of healthy, warning, stale, and broken results.

Exit criteria: at least 95% precision for confirmed broken classifications and no source-wide false
positive incident.

### Phase 1 — Gate new imports

- Require initial health pass before publishing.
- Quarantine low-quality imports automatically.
- Keep existing public inventory in shadow mode.

### Phase 2 — Protect candidates from hard failures

- Enable automatic hiding for confirmed 404/410, dead domains, redirect loops, and explicit closed
  states.
- Enable automatic restoration after a verified recovery.

### Phase 3 — Freshness ranking

- Enable warning-state downranking and stale hiding.
- Tune decay separately for employer-submitted, ATS imports, and evergreen sources.

### Phase 4 — Archival and removal

- Enable automatic archive after the configured grace period.
- Stop renewal for health-archived paid listings.
- Enable 90-day public tombstoning.

## 11. Verification and acceptance criteria

- Every active external-application job has a check and next-check timestamp.
- No job below the public threshold appears in search, map results, recommendations, sitemap, or
  structured feeds.
- A known 404/410 listing is hidden within one worker interval.
- Temporary 429/5xx responses do not cause archival.
- A recovered destination restores automatically when no explicit closure exists.
- Import fixtures cover malformed HTML, navigation-heavy text, exact/near duplicates, missing
  destinations, expired language, and generic careers pages.
- Verifier fixtures cover redirect loops, DNS failure, SSRF targets, JavaScript rendering, closure
  phrases, and ATS job identifiers.
- All automated state changes are idempotent and auditable.
- Source-wide circuit breakers prevent mass hiding during crawler blocking or parser regressions.
- Dashboard counts reconcile with direct database queries.

## 12. Estimated effort

| Workstream | Effort |
| --- | --- |
| Schema, repositories, policy/evaluator, unit tests | M |
| Safe HTTP verifier and scheduler | L |
| Import quality gate | M |
| Admin APIs and dashboard | M |
| Browser verifier escalation | M |
| Shadow backfill, calibration, alerts, rollout | L |

Recommended sequence: schema/evidence first, HTTP verification second, import gating third, dashboard
fourth, and destructive automation only after shadow-mode precision is proven.
