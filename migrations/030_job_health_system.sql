-- Job Health framework.
-- This migration adds observability and scoring only. It does not hide or archive jobs.

alter table public.jobs
  add column if not exists health_score numeric(5,2) not null default 50,
  add column if not exists health_status text not null default 'unknown',
  add column if not exists health_confidence_score numeric(5,2) not null default 0,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_successful_verification_at timestamptz,
  add column if not exists next_verification_at timestamptz not null default now(),
  add column if not exists health_reason_code text,
  add column if not exists health_reason_codes text[] not null default '{}',
  add column if not exists health_policy_version text,
  add column if not exists health_hidden_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_health_score_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_health_score_check
      check (health_score >= 0 and health_score <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_health_confidence_score_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_health_confidence_score_check
      check (health_confidence_score >= 0 and health_confidence_score <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_health_status_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_health_status_check
      check (health_status in ('unknown', 'healthy', 'warning', 'stale', 'broken', 'quarantined'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_verification_status_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_verification_status_check
      check (verification_status in ('pending', 'verified', 'warning', 'failed', 'inconclusive'));
  end if;
end $$;

create table if not exists public.job_health_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  verifier_key text not null,
  verifier_version text not null,
  outcome text not null,
  confidence_score numeric(5,2) not null default 0,
  reason_codes text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  http_status integer,
  final_url text,
  redirect_count integer,
  destination_domain text,
  signals jsonb not null default '{}'::jsonb,
  error_code text,
  error_detail text,
  content_hash text,
  evidence_excerpt text,
  created_at timestamptz not null default now(),
  constraint job_health_checks_outcome_check
    check (outcome in ('pass', 'soft_fail', 'hard_fail', 'inconclusive', 'unknown')),
  constraint job_health_checks_confidence_score_check
    check (confidence_score >= 0 and confidence_score <= 100),
  constraint job_health_checks_duration_check
    check (duration_ms is null or duration_ms >= 0),
  constraint job_health_checks_redirect_count_check
    check (redirect_count is null or redirect_count >= 0)
);

create table if not exists public.job_health_snapshots (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  health_score numeric(5,2) not null,
  health_status text not null,
  confidence_score numeric(5,2) not null,
  verification_status text not null,
  primary_reason_code text,
  reason_codes text[] not null default '{}',
  components jsonb not null default '{}'::jsonb,
  evidence_check_ids uuid[] not null default '{}',
  policy_version text not null,
  evaluated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_health_snapshots_health_score_check
    check (health_score >= 0 and health_score <= 100),
  constraint job_health_snapshots_confidence_score_check
    check (confidence_score >= 0 and confidence_score <= 100),
  constraint job_health_snapshots_health_status_check
    check (health_status in ('unknown', 'healthy', 'warning', 'stale', 'broken', 'quarantined')),
  constraint job_health_snapshots_verification_status_check
    check (verification_status in ('pending', 'verified', 'warning', 'failed', 'inconclusive'))
);

create table if not exists public.job_health_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type text not null,
  actor_type text not null default 'automation',
  previous_status text,
  new_status text,
  reason_code text,
  reason text,
  policy_version text,
  evidence_check_ids uuid[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_health_events_actor_type_check
    check (actor_type in ('automation', 'admin', 'employer', 'candidate_feedback', 'system'))
);

create table if not exists public.job_health_policies (
  version text primary key,
  name text not null,
  config jsonb not null,
  enabled boolean not null default false,
  effective_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists jobs_health_due_idx
  on public.jobs (next_verification_at, health_status)
  where is_archived = false;

create index if not exists jobs_health_status_score_idx
  on public.jobs (health_status, health_score);

create index if not exists jobs_health_source_status_idx
  on public.jobs (source, health_status);

create index if not exists jobs_health_hidden_idx
  on public.jobs (health_hidden_at desc)
  where health_hidden_at is not null;

create index if not exists job_health_checks_job_completed_idx
  on public.job_health_checks (job_id, completed_at desc);

create index if not exists job_health_checks_outcome_completed_idx
  on public.job_health_checks (outcome, completed_at desc);

create index if not exists job_health_events_job_created_idx
  on public.job_health_events (job_id, created_at desc);

insert into public.job_health_policies (version, name, config, enabled, effective_at)
values (
  '2026-07-29.1',
  'Initial shadow-mode job health policy',
  '{
    "weights": {
      "applicationDestination": 45,
      "specificPosition": 15,
      "freshness": 20,
      "employerActivity": 10,
      "engagementQuality": 10
    },
    "thresholds": {
      "healthy": 80,
      "warning": 60,
      "stale": 40,
      "publicVisibilityMinimum": 60,
      "minimumActionConfidence": 70
    },
    "scheduleHours": {
      "healthy": 168,
      "warning": 24,
      "stale": 6,
      "broken": 1,
      "unknown": 1
    },
    "automation": {
      "shadowMode": true,
      "allowAutomaticHide": false,
      "allowAutomaticArchive": false
    }
  }'::jsonb,
  true,
  now()
)
on conflict (version) do nothing;

update public.jobs
set
  health_score = coalesce(health_score, 50),
  health_status = coalesce(health_status, 'unknown'),
  health_confidence_score = coalesce(health_confidence_score, 0),
  verification_status = coalesce(verification_status, 'pending'),
  next_verification_at = coalesce(next_verification_at, now()),
  health_reason_codes = coalesce(health_reason_codes, '{}'),
  health_policy_version = coalesce(health_policy_version, '2026-07-29.1');

