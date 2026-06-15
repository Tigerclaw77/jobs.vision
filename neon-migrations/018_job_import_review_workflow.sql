-- Track high-confidence auto recommendations and manual/batch review actions.

alter table public.job_imports
  add column if not exists auto_decision_applied boolean not null default false,
  add column if not exists auto_decision text,
  add column if not exists auto_decision_at timestamptz,
  add column if not exists review_action text,
  add column if not exists review_source text;

update public.job_imports
set
  auto_decision_applied = true,
  auto_decision = recommendation,
  auto_decision_at = coalesce(auto_decision_at, now())
where status in ('discovered', 'needs_review')
  and recommendation in ('approve', 'reject')
  and classification_confidence_score >= 95
  and coalesce(role_badge, '') <> 'UNKNOWN'
  and (
    recommendation = 'reject'
    or (
      coalesce(role_badge, '') not in ('OTHER', 'OMD')
      and coalesce(normalized_apply_url, apply_url, normalized_job->>'applyUrl', '') <> ''
    )
  );

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_imports_auto_decision_check') then
    alter table public.job_imports
      add constraint job_imports_auto_decision_check
      check (auto_decision is null or auto_decision in ('approve', 'reject'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_review_action_check') then
    alter table public.job_imports
      add constraint job_imports_review_action_check
      check (review_action is null or review_action in ('publish', 'reject'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_review_source_check') then
    alter table public.job_imports
      add constraint job_imports_review_source_check
      check (review_source is null or review_source in ('manual', 'batch', 'auto'));
  end if;
end $$;

create index if not exists job_imports_auto_decision_idx
  on public.job_imports (status, auto_decision_applied, auto_decision, classification_confidence_score desc);

create index if not exists job_imports_review_source_idx
  on public.job_imports (review_source, reviewed_at desc);
