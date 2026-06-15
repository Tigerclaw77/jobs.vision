alter table public.jobs
  add column if not exists parent_company text;

update public.jobs
set parent_company = coalesce(nullif(parent_company, ''), nullif(employer_name, ''), nullif(company, ''))
where parent_company is null
  and (employer_name is not null or company is not null);

create index if not exists jobs_parent_company_idx
  on public.jobs (parent_company);
