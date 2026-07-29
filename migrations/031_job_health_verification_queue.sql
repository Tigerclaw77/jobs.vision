-- Lease-based verification queue for safe, repeatable worker execution.
-- This migration does not change public job visibility.

alter table public.jobs
  add column if not exists verification_lease_id uuid,
  add column if not exists verification_lease_expires_at timestamptz,
  add column if not exists verification_attempt_count integer not null default 0,
  add column if not exists verification_last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jobs_verification_attempt_count_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_verification_attempt_count_check
      check (verification_attempt_count >= 0);
  end if;
end $$;

create index if not exists jobs_verification_queue_idx
  on public.jobs (next_verification_at, verification_lease_expires_at)
  where is_archived = false;

