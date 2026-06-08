-- Saved employer career-page sources for the admin discovery workflow.
-- These sources feed public.job_imports; they do not publish jobs directly.

create table if not exists public.job_discovery_sources (
  id uuid primary key default gen_random_uuid(),
  employer_name text not null,
  employer_website_url text not null,
  careers_url text,
  industry_key text,
  source_type text not null default 'unknown',
  enabled boolean not null default true,
  notes text,
  last_run_at timestamptz,
  last_run_status text,
  last_run_message text,
  last_discovered_count integer not null default 0,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_discovery_sources_source_type_check check (
    source_type in ('career_page', 'greenhouse', 'lever', 'workday', 'unknown')
  ),
  constraint job_discovery_sources_last_run_status_check check (
    last_run_status is null or last_run_status in ('success', 'failed')
  )
);

create index if not exists job_discovery_sources_enabled_idx
  on public.job_discovery_sources (enabled, employer_name);

create index if not exists job_discovery_sources_industry_idx
  on public.job_discovery_sources (industry_key, enabled);
