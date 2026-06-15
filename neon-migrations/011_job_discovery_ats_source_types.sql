-- Allow explicit ATS source types for job discovery sources/import metadata.
-- This migration does not publish or alter discovered jobs.

alter table if exists public.job_imports
  drop constraint if exists job_imports_source_type_check,
  add constraint job_imports_source_type_check check (
    source_type in ('career_page', 'smartrecruiters', 'greenhouse', 'lever', 'workday', 'icims', 'taleo', 'unknown')
  );

alter table if exists public.job_imports
  drop constraint if exists job_imports_normalized_source_type_check,
  add constraint job_imports_normalized_source_type_check check (
    normalized_source_type in ('career_page', 'smartrecruiters', 'greenhouse', 'lever', 'workday', 'icims', 'taleo', 'unknown')
  );

alter table if exists public.job_discovery_sources
  drop constraint if exists job_discovery_sources_source_type_check,
  add constraint job_discovery_sources_source_type_check check (
    source_type in ('career_page', 'smartrecruiters', 'greenhouse', 'lever', 'workday', 'icims', 'taleo', 'unknown')
  );
