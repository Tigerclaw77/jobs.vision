create table if not exists public.job_apply_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id text references public.profiles(id) on delete set null,
  event_type text not null,
  destination_type text,
  destination_domain text,
  event_source text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_apply_events_event_type_check') then
    alter table public.job_apply_events
      add constraint job_apply_events_event_type_check
      check (event_type in ('listing_view', 'apply_click'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_apply_events_destination_type_check') then
    alter table public.job_apply_events
      add constraint job_apply_events_destination_type_check
      check (
        destination_type is null
        or destination_type in ('external_url', 'recruiter_email', 'recruiter_website')
      );
  end if;
end $$;

create index if not exists job_apply_events_job_event_created_idx
  on public.job_apply_events (job_id, event_type, created_at desc);

create index if not exists job_apply_events_apply_click_created_idx
  on public.job_apply_events (job_id, created_at desc)
  where event_type = 'apply_click';

create index if not exists job_apply_events_user_created_idx
  on public.job_apply_events (user_id, created_at desc)
  where user_id is not null;

alter table public.job_apply_events enable row level security;

drop policy if exists job_apply_events_insert_public_active_job on public.job_apply_events;
create policy job_apply_events_insert_public_active_job
  on public.job_apply_events
  for insert
  with check (
    exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and j.status = 'active'
        and j.is_archived = false
    )
  );

drop policy if exists job_apply_events_select_owner_or_admin on public.job_apply_events;
create policy job_apply_events_select_owner_or_admin
  on public.job_apply_events
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (
          j.recruiter_id = public.current_auth_user_id()
          or j.posted_by = public.current_auth_user_id()
          or j.claimed_by_user_id = public.current_auth_user_id()
        )
    )
  );
