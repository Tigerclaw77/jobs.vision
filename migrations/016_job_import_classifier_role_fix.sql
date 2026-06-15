-- Keep specialty separate from role category and allow ambiguous imports to be marked for manual review.

alter table public.job_imports
  add column if not exists specialty text;

update public.job_imports
set specialty = coalesce(specialty, normalized_job->>'specialty', normalized_job #>> '{classificationSummary,specialty}')
where normalized_job is not null;

alter table public.job_imports
  drop constraint if exists job_imports_recommendation_check;

alter table public.job_imports
  add constraint job_imports_recommendation_check
  check (recommendation is null or recommendation in ('approve', 'reject', 'review'));
