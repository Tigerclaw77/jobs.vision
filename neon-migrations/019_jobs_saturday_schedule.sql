-- Add optional OD Saturday schedule metadata for filtering.
-- Nullable rollout: existing jobs remain unspecified until explicitly set.

alter table public.jobs
  add column if not exists saturday_schedule text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_saturday_schedule_check') then
    alter table public.jobs
      add constraint jobs_saturday_schedule_check
      check (
        saturday_schedule is null
        or saturday_schedule in ('none', 'occasional', 'alternating', 'most', 'every', 'unknown')
      );
  end if;
end $$;

create index if not exists jobs_saturday_schedule_idx
  on public.jobs (saturday_schedule);
