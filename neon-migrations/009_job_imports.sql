-- Reusable job discovery/import queue.
-- Discovered jobs land here for admin review and are never public until approved.

alter table public.jobs
  add column if not exists external_apply_url text,
  add column if not exists source_url text;

create table if not exists public.job_imports (
  id uuid primary key default gen_random_uuid(),
  employer_name text not null,
  employer_website_url text not null,
  careers_url text,
  industry_key text,
  source_type text not null default 'unknown',
  source_url text not null,
  discovered_at timestamptz not null default now(),
  raw_title text not null,
  raw_location text,
  raw_description text,
  apply_url text,
  confidence_score numeric(5,2) not null default 0,
  extraction_notes text[] not null default '{}',
  normalized_title text not null,
  normalized_company text not null,
  normalized_location text,
  normalized_employment_type text,
  normalized_compensation text,
  normalized_description text,
  normalized_apply_url text,
  normalized_source_url text not null,
  normalized_source_type text not null default 'unknown',
  industry_tags text[] not null default '{}',
  role_tags text[] not null default '{}',
  status text not null default 'needs_review',
  duplicate_key text not null,
  discovery_result jsonb not null,
  normalized_job jsonb not null,
  rejection_reason text,
  published_job_id uuid references public.jobs(id) on delete set null,
  discovered_by text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_imports_source_type_check check (
    source_type in ('career_page', 'greenhouse', 'lever', 'workday', 'unknown')
  ),
  constraint job_imports_normalized_source_type_check check (
    normalized_source_type in ('career_page', 'greenhouse', 'lever', 'workday', 'unknown')
  ),
  constraint job_imports_status_check check (
    status in ('discovered', 'needs_review', 'rejected', 'published')
  ),
  constraint job_imports_confidence_score_check check (
    confidence_score >= 0 and confidence_score <= 100
  )
);

create unique index if not exists job_imports_duplicate_key_idx
  on public.job_imports (duplicate_key);

create index if not exists job_imports_status_discovered_idx
  on public.job_imports (status, discovered_at desc);

create index if not exists job_imports_industry_status_idx
  on public.job_imports (industry_key, status);

create index if not exists job_imports_role_tags_gin_idx
  on public.job_imports using gin (role_tags);

create index if not exists job_imports_industry_tags_gin_idx
  on public.job_imports using gin (industry_tags);

create index if not exists jobs_external_apply_url_idx
  on public.jobs (external_apply_url)
  where external_apply_url is not null;
