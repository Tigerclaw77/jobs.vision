-- Guarded health lifecycle.
-- The seeded policy remains in shadow mode with automatic hide/archive disabled.

alter table public.jobs
  add column if not exists health_previous_status text,
  add column if not exists health_hidden_reason text,
  add column if not exists health_archived_at timestamptz;

create or replace function public.enforce_health_hidden_job_status()
returns trigger
language plpgsql
as $$
begin
  if new.health_hidden_at is not null
     and coalesce(new.is_archived, false) = false
     and new.status = 'active' then
    new.status := 'paused';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_enforce_health_hidden_status on public.jobs;
create trigger jobs_enforce_health_hidden_status
before insert or update of status, health_hidden_at, is_archived
on public.jobs
for each row
execute function public.enforce_health_hidden_job_status();

update public.job_health_policies
set enabled = false
where enabled = true;

insert into public.job_health_policies (version, name, config, enabled, effective_at)
values (
  '2026-07-29.2',
  'Guarded freshness and lifecycle policy',
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
    "lifecycle": {
      "failureConfirmationsRequired": 2,
      "archiveConfirmationsRequired": 3,
      "restoreConfirmationsRequired": 1,
      "archiveAfterHiddenDays": 14,
      "recentEvidenceWindowDays": 7
    },
    "automation": {
      "shadowMode": true,
      "allowAutomaticHide": false,
      "allowAutomaticRestore": true,
      "allowAutomaticArchive": false
    }
  }'::jsonb,
  true,
  now()
)
on conflict (version) do update set
  name = excluded.name,
  config = excluded.config,
  enabled = excluded.enabled,
  effective_at = excluded.effective_at;

create index if not exists jobs_health_lifecycle_idx
  on public.jobs (health_hidden_at, health_archived_at, health_status);

