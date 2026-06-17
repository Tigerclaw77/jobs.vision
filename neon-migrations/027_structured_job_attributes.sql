alter table public.jobs
  add column if not exists clinical_focuses text[] not null default '{}',
  add column if not exists practice_types text[] not null default '{}',
  add column if not exists benefit_flags text[] not null default '{}';

create index if not exists jobs_clinical_focuses_gin_idx
  on public.jobs using gin (clinical_focuses);

create index if not exists jobs_practice_types_gin_idx
  on public.jobs using gin (practice_types);

create index if not exists jobs_benefit_flags_gin_idx
  on public.jobs using gin (benefit_flags);
