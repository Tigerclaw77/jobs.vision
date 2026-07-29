-- Import quality decisions and batch traceability.

create table if not exists public.job_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text,
  source_label text,
  importer_version text,
  status text not null default 'running',
  counts jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint job_import_batches_status_check
    check (status in ('running', 'completed', 'failed'))
);

alter table public.job_imports
  add column if not exists import_batch_id uuid references public.job_import_batches(id) on delete set null,
  add column if not exists quality_status text not null default 'legacy_unchecked',
  add column if not exists quality_score numeric(5,2) not null default 50,
  add column if not exists quality_reason_codes text[] not null default '{}',
  add column if not exists quality_details jsonb not null default '{}'::jsonb,
  add column if not exists quality_checked_at timestamptz,
  add column if not exists description_fingerprint text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_imports_quality_status_check'
      and conrelid = 'public.job_imports'::regclass
  ) then
    alter table public.job_imports
      add constraint job_imports_quality_status_check
      check (quality_status in ('legacy_unchecked', 'passed', 'quarantined', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'job_imports_quality_score_check'
      and conrelid = 'public.job_imports'::regclass
  ) then
    alter table public.job_imports
      add constraint job_imports_quality_score_check
      check (quality_score >= 0 and quality_score <= 100);
  end if;
end $$;

create index if not exists job_imports_quality_status_idx
  on public.job_imports (quality_status, status, discovered_at desc);

create index if not exists job_imports_description_fingerprint_idx
  on public.job_imports (description_fingerprint)
  where description_fingerprint is not null;

create index if not exists job_imports_batch_idx
  on public.job_imports (import_batch_id, quality_status);

create index if not exists job_import_batches_started_idx
  on public.job_import_batches (started_at desc, status);

create or replace function public.enforce_job_import_quality_before_publish()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published'
     and coalesce(new.quality_status, 'legacy_unchecked') not in ('passed', 'legacy_unchecked') then
    if tg_op = 'INSERT' then
      raise exception 'Import quality status % cannot be published', new.quality_status
        using errcode = '23514';
    elsif old.status is distinct from 'published' then
      raise exception 'Import quality status % cannot be published', new.quality_status
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_import_quality_publish_guard on public.job_imports;
create trigger job_import_quality_publish_guard
before insert or update of status, quality_status on public.job_imports
for each row execute function public.enforce_job_import_quality_before_publish();
