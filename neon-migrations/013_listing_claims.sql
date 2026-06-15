-- Listing ownership and claim-review workflow.
-- Additive only: no payments, no billing, no ranking changes.

alter table public.jobs
  add column if not exists claimed_by_user_id text,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_status text not null default 'unclaimed';

update public.jobs
set claim_status = coalesce(nullif(claim_status, ''), 'unclaimed');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_claim_status_check') then
    alter table public.jobs
      add constraint jobs_claim_status_check
      check (claim_status in ('unclaimed', 'pending', 'claimed', 'rejected'));
  end if;
end $$;

create table if not exists public.job_listing_claims (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  requested_by_user_id text not null,
  requester_email text,
  requester_name text,
  company_name text,
  company_website text,
  message text,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_listing_claims_status_check check (
    status in ('pending', 'approved', 'rejected')
  )
);

create index if not exists jobs_claim_status_idx
  on public.jobs (claim_status);

create index if not exists jobs_claimed_by_user_idx
  on public.jobs (claimed_by_user_id)
  where claimed_by_user_id is not null;

create index if not exists job_listing_claims_status_created_idx
  on public.job_listing_claims (status, created_at desc);

create index if not exists job_listing_claims_job_status_idx
  on public.job_listing_claims (job_id, status);

create index if not exists job_listing_claims_requester_idx
  on public.job_listing_claims (requested_by_user_id, created_at desc);

create unique index if not exists job_listing_claims_one_pending_per_user_job_idx
  on public.job_listing_claims (job_id, requested_by_user_id)
  where status = 'pending';
