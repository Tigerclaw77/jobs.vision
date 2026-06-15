alter table public.job_imports
  add column if not exists evergreen boolean not null default false,
  add column if not exists evergreen_reason text,
  add column if not exists source_posted_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists source_posting_age_days integer,
  add column if not exists freshness_checked_at timestamptz;

alter table public.job_imports
  drop constraint if exists job_imports_status_check;

alter table public.job_imports
  add constraint job_imports_status_check check (
    status in ('discovered', 'needs_review', 'evergreen', 'rejected', 'published')
  );

create index if not exists job_imports_evergreen_idx
  on public.job_imports (evergreen, status, source_posting_age_days desc);

update public.job_imports
set
  evergreen = true,
  evergreen_reason = coalesce(
    evergreen_reason,
    'Costco uses long-lived searchable/applyable requisitions for future hiring needs; freshness audit found the source is predominantly older than 180 days.'
  ),
  status = case
    when status in ('published', 'rejected') then status
    else 'evergreen'
  end,
  freshness_checked_at = coalesce(freshness_checked_at, now()),
  updated_at = now()
where lower(coalesce(employer_name, '') || ' ' || coalesce(normalized_company, '')) like '%costco%'
  and status <> 'published';
