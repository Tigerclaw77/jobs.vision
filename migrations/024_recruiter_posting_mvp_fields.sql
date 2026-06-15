alter table public.jobs
  add column if not exists sign_on_bonus text,
  add column if not exists relocation_assistance boolean not null default false,
  add column if not exists benefits text,
  add column if not exists ce_allowance text,
  add column if not exists student_loan_assistance boolean not null default false;
