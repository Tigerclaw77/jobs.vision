alter table public.jobs
  add column if not exists practice_name text;

alter table public.job_imports
  add column if not exists parent_company text,
  add column if not exists employer_brand text,
  add column if not exists practice_name text;

create index if not exists jobs_practice_name_idx
  on public.jobs (practice_name);

create index if not exists job_imports_parent_company_idx
  on public.job_imports (parent_company);

create index if not exists job_imports_employer_brand_idx
  on public.job_imports (employer_brand);

create index if not exists job_imports_practice_name_idx
  on public.job_imports (practice_name);
