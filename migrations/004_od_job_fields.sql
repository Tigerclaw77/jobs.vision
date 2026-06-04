alter table public.jobs
  add column if not exists opportunity_type text,
  add column if not exists practice_type text,
  add column if not exists employment_type text,
  add column if not exists work_arrangement text;

create index if not exists jobs_opportunity_type_idx
  on public.jobs (opportunity_type);

create index if not exists jobs_practice_type_idx
  on public.jobs (practice_type);

create index if not exists jobs_employment_type_idx
  on public.jobs (employment_type);

create index if not exists jobs_work_arrangement_idx
  on public.jobs (work_arrangement);
