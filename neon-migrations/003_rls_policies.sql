-- jobs.vision Neon PostgreSQL 17 migration
-- 003_rls_policies.sql
-- Uses Neon RLS/Data API auth.user_id() when JWT context is available.

create or replace function public.current_auth_user_id()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid text;
begin
  begin
    execute 'select auth.user_id()::text' into uid;
  exception
    when invalid_schema_name or undefined_function then
      uid := null;
  end;

  return uid;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = public.current_auth_user_id()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_recruiter_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('recruiter', 'admin'), false)
$$;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_favorites enable row level security;
alter table public.hidden_jobs enable row level security;
alter table public.recruiter_domains enable row level security;
alter table public.manual_overrides enable row level security;
alter table public.recruiter_entitlements enable row level security;
alter table public.candidate_entitlements enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  using (id = public.current_auth_user_id() or public.is_admin());

drop policy if exists profiles_insert_own_or_admin on public.profiles;
create policy profiles_insert_own_or_admin
  on public.profiles
  for insert
  with check (public.is_admin() or (id = public.current_auth_user_id() and role = 'candidate'));

drop policy if exists profiles_update_admin_only on public.profiles;
create policy profiles_update_admin_only
  on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists jobs_public_active_select on public.jobs;
create policy jobs_public_active_select
  on public.jobs
  for select
  using (status = 'active' and is_archived = false);

drop policy if exists jobs_manager_select_own_or_admin on public.jobs;
create policy jobs_manager_select_own_or_admin
  on public.jobs
  for select
  using (
    public.is_admin()
    or recruiter_id = public.current_auth_user_id()
    or posted_by = public.current_auth_user_id()
  );

drop policy if exists jobs_manager_insert on public.jobs;
create policy jobs_manager_insert
  on public.jobs
  for insert
  with check (
    public.is_recruiter_or_admin()
    and (
      public.is_admin()
      or recruiter_id = public.current_auth_user_id()
      or posted_by = public.current_auth_user_id()
    )
  );

drop policy if exists jobs_manager_update_own_or_admin on public.jobs;
create policy jobs_manager_update_own_or_admin
  on public.jobs
  for update
  using (
    public.is_admin()
    or recruiter_id = public.current_auth_user_id()
    or posted_by = public.current_auth_user_id()
  )
  with check (
    public.is_admin()
    or recruiter_id = public.current_auth_user_id()
    or posted_by = public.current_auth_user_id()
  );

drop policy if exists jobs_manager_delete_own_or_admin on public.jobs;
create policy jobs_manager_delete_own_or_admin
  on public.jobs
  for delete
  using (
    public.is_admin()
    or recruiter_id = public.current_auth_user_id()
    or posted_by = public.current_auth_user_id()
  );

drop policy if exists job_applications_insert_own_active_job on public.job_applications;
create policy job_applications_insert_own_active_job
  on public.job_applications
  for insert
  with check (
    user_id = public.current_auth_user_id()
    and exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and j.status = 'active'
        and j.is_archived = false
    )
  );

drop policy if exists job_applications_select_participant_or_admin on public.job_applications;
create policy job_applications_select_participant_or_admin
  on public.job_applications
  for select
  using (
    user_id = public.current_auth_user_id()
    or public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (
          j.recruiter_id = public.current_auth_user_id()
          or j.posted_by = public.current_auth_user_id()
        )
    )
  );

drop policy if exists job_applications_update_recruiter_or_admin on public.job_applications;
create policy job_applications_update_recruiter_or_admin
  on public.job_applications
  for update
  using (
    public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (
          j.recruiter_id = public.current_auth_user_id()
          or j.posted_by = public.current_auth_user_id()
        )
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (
          j.recruiter_id = public.current_auth_user_id()
          or j.posted_by = public.current_auth_user_id()
        )
    )
  );

drop policy if exists job_applications_delete_own_or_admin on public.job_applications;
create policy job_applications_delete_own_or_admin
  on public.job_applications
  for delete
  using (user_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists job_favorites_select_own on public.job_favorites;
create policy job_favorites_select_own
  on public.job_favorites
  for select
  using (user_id = public.current_auth_user_id());

drop policy if exists job_favorites_insert_own_active_job on public.job_favorites;
create policy job_favorites_insert_own_active_job
  on public.job_favorites
  for insert
  with check (
    user_id = public.current_auth_user_id()
    and exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and j.status = 'active'
        and j.is_archived = false
    )
  );

drop policy if exists job_favorites_delete_own on public.job_favorites;
create policy job_favorites_delete_own
  on public.job_favorites
  for delete
  using (user_id = public.current_auth_user_id());

drop policy if exists hidden_jobs_select_own on public.hidden_jobs;
create policy hidden_jobs_select_own
  on public.hidden_jobs
  for select
  using (user_id = public.current_auth_user_id());

drop policy if exists hidden_jobs_insert_own_active_job on public.hidden_jobs;
create policy hidden_jobs_insert_own_active_job
  on public.hidden_jobs
  for insert
  with check (
    user_id = public.current_auth_user_id()
    and exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and j.status = 'active'
        and j.is_archived = false
    )
  );

drop policy if exists hidden_jobs_delete_own on public.hidden_jobs;
create policy hidden_jobs_delete_own
  on public.hidden_jobs
  for delete
  using (user_id = public.current_auth_user_id());

drop policy if exists recruiter_domains_select_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_select_own_or_admin
  on public.recruiter_domains
  for select
  using (user_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists recruiter_domains_insert_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_insert_own_or_admin
  on public.recruiter_domains
  for insert
  with check (user_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists recruiter_domains_update_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_update_own_or_admin
  on public.recruiter_domains
  for update
  using (user_id = public.current_auth_user_id() or public.is_admin())
  with check (user_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists recruiter_domains_delete_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_delete_own_or_admin
  on public.recruiter_domains
  for delete
  using (user_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists manual_overrides_admin_all on public.manual_overrides;
create policy manual_overrides_admin_all
  on public.manual_overrides
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists recruiter_entitlements_select_own_or_admin on public.recruiter_entitlements;
create policy recruiter_entitlements_select_own_or_admin
  on public.recruiter_entitlements
  for select
  using (profile_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists recruiter_entitlements_admin_all on public.recruiter_entitlements;
create policy recruiter_entitlements_admin_all
  on public.recruiter_entitlements
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists candidate_entitlements_select_own_or_admin on public.candidate_entitlements;
create policy candidate_entitlements_select_own_or_admin
  on public.candidate_entitlements
  for select
  using (profile_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists candidate_entitlements_admin_all on public.candidate_entitlements;
create policy candidate_entitlements_admin_all
  on public.candidate_entitlements
  for all
  using (public.is_admin())
  with check (public.is_admin());
