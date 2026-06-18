do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'jobs_status_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs drop constraint jobs_status_check;
  end if;

  alter table public.jobs
    add constraint jobs_status_check
    check (status in ('active', 'pending_domain', 'archived', 'draft', 'rejected', 'expired', 'paused'));
end $$;
