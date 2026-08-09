# Jobs.Vision self-maintenance

Jobs.Vision uses the existing Express, Vercel, and Postgres stack for two protected scheduled routes:

- `GET /api/cron/billing` at 03:00 UTC daily (operational billing summary)
- `GET /api/cron/maintenance` at 06:20 UTC daily (bounded validation plus incremental discovery)

Vercel sends `Authorization: Bearer <CRON_SECRET>`. Set `CRON_SECRET` in the production project and apply `030_incremental_job_maintenance.sql` before enabling the schedules. In-process `node-cron` is disabled unless `ENABLE_IN_PROCESS_CRON=true`; leave it disabled on Vercel.

## Freshness behavior

Each maintenance run selects the oldest due imported listings first. Defaults are 24 listings, six concurrent requests, and a six-second request deadline. A cheap `HEAD` request is tried before a bounded `GET` fallback.

- `2xx/3xx`: healthy; check again in 14 days.
- First confirmed `404/410`: suspect; check again in two days.
- Second consecutive confirmed `404/410`: archive using the existing reversible archive state.
- Timeouts, `401/403/429`, and `5xx`: record an error and back off exponentially; do not archive.

Jobs are never deleted. Employer-submitted listings are excluded from automatic URL validation and archiving.

## Discovery behavior

One enabled discovery source that has not run in seven days is selected per daily run. The existing robots-aware discovery pipeline, duplicate key, review queue, and manual publish/reject workflow are reused. Cron discovery defaults to 150 ATS jobs and two iCIMS pages, and it never auto-publishes.

The practical source refresh interval is `max(7 days, enabled source count in days)` because one source runs per day. Adjust the environment budgets only after reviewing Vercel duration and endpoint behavior.

## Founder health view

The existing Admin > Marketplace page shows recent checks, stale/unverified imports, suspect/error counts, new imports, maintenance archives, discovery failures, the last maintenance run, remaining validation/discovery coverage, and current indexing warnings.
