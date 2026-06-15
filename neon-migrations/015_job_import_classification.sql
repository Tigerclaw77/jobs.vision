-- Store review-first classification data for imported jobs.
-- These fields are generated during discovery normalization and shown in the admin review queue.

alter table public.job_imports
  add column if not exists primary_role text,
  add column if not exists secondary_role text,
  add column if not exists classification_employment_type text,
  add column if not exists classification_practice_type text,
  add column if not exists compensation_summary text,
  add column if not exists jobs_vision_relevant boolean,
  add column if not exists recommendation text,
  add column if not exists recommendation_reason text,
  add column if not exists classification_confidence_score numeric(5,2),
  add column if not exists role_badge text;

update public.job_imports
set
  primary_role = coalesce(primary_role, normalized_job->>'primaryRole', normalized_job #>> '{classificationSummary,primaryRole}'),
  secondary_role = coalesce(secondary_role, normalized_job->>'secondaryRole', normalized_job #>> '{classificationSummary,secondaryRole}'),
  classification_employment_type = coalesce(classification_employment_type, normalized_job #>> '{classificationSummary,employmentType}'),
  classification_practice_type = coalesce(classification_practice_type, normalized_job->>'practiceType', normalized_job #>> '{classificationSummary,practiceType}'),
  compensation_summary = coalesce(compensation_summary, normalized_job->>'compensationSummary', normalized_job #>> '{classificationSummary,compensationSummary}', normalized_compensation),
  jobs_vision_relevant = coalesce(
    jobs_vision_relevant,
    nullif(normalized_job->>'jobsVisionRelevant', '')::boolean,
    nullif(normalized_job #>> '{classificationSummary,jobsVisionRelevant}', '')::boolean
  ),
  recommendation = coalesce(recommendation, normalized_job->>'recommendation', normalized_job #>> '{classificationSummary,recommendation}'),
  recommendation_reason = coalesce(recommendation_reason, normalized_job->>'recommendationReason', normalized_job #>> '{classificationSummary,recommendationReason}'),
  classification_confidence_score = coalesce(
    classification_confidence_score,
    nullif(normalized_job->>'classificationConfidenceScore', '')::numeric,
    nullif(normalized_job #>> '{classificationSummary,confidenceScore}', '')::numeric
  ),
  role_badge = coalesce(role_badge, normalized_job->>'roleBadge', normalized_job #>> '{classificationSummary,roleBadge}')
where normalized_job is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_imports_recommendation_check') then
    alter table public.job_imports
      add constraint job_imports_recommendation_check
      check (recommendation is null or recommendation in ('approve', 'reject'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_role_badge_check') then
    alter table public.job_imports
      add constraint job_imports_role_badge_check
      check (role_badge is null or role_badge in ('OD', 'OPTICIAN', 'TECH', 'MANAGER', 'OPTICAL', 'OMD', 'UNKNOWN'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_classification_confidence_score_check') then
    alter table public.job_imports
      add constraint job_imports_classification_confidence_score_check
      check (classification_confidence_score is null or (classification_confidence_score >= 0 and classification_confidence_score <= 100));
  end if;
end $$;

create index if not exists job_imports_recommendation_idx
  on public.job_imports (status, recommendation, classification_confidence_score desc);

create index if not exists job_imports_role_badge_idx
  on public.job_imports (status, role_badge, discovered_at desc);
