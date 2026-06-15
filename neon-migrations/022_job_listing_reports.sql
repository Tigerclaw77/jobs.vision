create table if not exists public.job_listing_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  reason text not null,
  comment text,
  reported_by_user_id text references public.profiles(id) on delete set null,
  status text not null default 'pending',
  reviewed_by text references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_listing_reports_reason_check check (
    reason in (
      'expired',
      'broken_apply_link',
      'incorrect_location',
      'incorrect_employer',
      'duplicate_listing',
      'other'
    )
  ),
  constraint job_listing_reports_status_check check (
    status in ('pending', 'reviewed', 'dismissed')
  )
);

create index if not exists job_listing_reports_status_created_idx
  on public.job_listing_reports (status, created_at desc);

create index if not exists job_listing_reports_job_idx
  on public.job_listing_reports (job_id, created_at desc);
