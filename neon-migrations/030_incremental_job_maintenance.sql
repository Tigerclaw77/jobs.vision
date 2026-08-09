-- Bounded, resumable freshness checks for externally sourced jobs.
-- Jobs are never deleted. Repeated terminal responses can archive an imported
-- listing, which remains recoverable through the existing unarchive workflow.

alter table public.jobs
  add column if not exists health_status text not null default 'unverified',
  add column if not exists health_checked_at timestamptz,
  add column if not exists health_status_code integer,
  add column if not exists health_failure_count integer not null default 0,
  add column if not exists health_next_check_at timestamptz,
  add column if not exists health_last_error text,
  add column if not exists health_archive_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_health_status_check') then
    alter table public.jobs
      add constraint jobs_health_status_check
      check (health_status in ('unverified', 'healthy', 'suspect', 'error', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_health_failure_count_check') then
    alter table public.jobs
      add constraint jobs_health_failure_count_check
      check (health_failure_count >= 0);
  end if;
end $$;

create index if not exists jobs_health_due_idx
  on public.jobs (health_next_check_at, health_checked_at)
  where status = 'active'
    and is_archived = false
    and listing_source = 'imported'
    and coalesce(external_apply_url, source_url) is not null;

create table if not exists public.job_maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  error_message text,
  constraint job_maintenance_runs_type_check check (
    run_type in ('maintenance', 'billing', 'advisory')
  ),
  constraint job_maintenance_runs_status_check check (
    status in ('running', 'success', 'partial', 'failed')
  )
);

create index if not exists job_maintenance_runs_recent_idx
  on public.job_maintenance_runs (run_type, started_at desc);
