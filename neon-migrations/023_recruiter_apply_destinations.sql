alter table public.jobs
  add column if not exists application_email text;

create index if not exists jobs_application_email_idx
  on public.jobs (application_email)
  where application_email is not null;
