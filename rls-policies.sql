-- jobs.vision database inventory migration
-- 003_rls_policies.sql

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
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
alter table public.recruiter_domains enable row level security;
alter table public.manual_overrides enable row level security;
alter table public.recruiter_entitlements enable row level security;
alter table public.candidate_entitlements enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_own_or_admin on public.profiles;
create policy profiles_insert_own_or_admin
  on public.profiles
  for insert
  to authenticated
  with check (public.is_admin() or (id = auth.uid() and role = 'candidate'));

drop policy if exists profiles_update_admin_only on public.profiles;
create policy profiles_update_admin_only
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists jobs_public_active_select on public.jobs;
create policy jobs_public_active_select
  on public.jobs
  for select
  to anon, authenticated
  using (status = 'active' and is_archived = false);

drop policy if exists jobs_manager_select_own_or_admin on public.jobs;
create policy jobs_manager_select_own_or_admin
  on public.jobs
  for select
  to authenticated
  using (
    public.is_admin()
    or recruiter_id = auth.uid()
    or posted_by = auth.uid()
  );

drop policy if exists jobs_manager_insert on public.jobs;
create policy jobs_manager_insert
  on public.jobs
  for insert
  to authenticated
  with check (
    public.is_recruiter_or_admin()
    and (
      public.is_admin()
      or recruiter_id = auth.uid()
      or posted_by = auth.uid()
    )
  );

drop policy if exists jobs_manager_update_own_or_admin on public.jobs;
create policy jobs_manager_update_own_or_admin
  on public.jobs
  for update
  to authenticated
  using (
    public.is_admin()
    or recruiter_id = auth.uid()
    or posted_by = auth.uid()
  )
  with check (
    public.is_admin()
    or recruiter_id = auth.uid()
    or posted_by = auth.uid()
  );

drop policy if exists jobs_manager_delete_own_or_admin on public.jobs;
create policy jobs_manager_delete_own_or_admin
  on public.jobs
  for delete
  to authenticated
  using (
    public.is_admin()
    or recruiter_id = auth.uid()
    or posted_by = auth.uid()
  );

drop policy if exists job_applications_insert_own_active_job on public.job_applications;
create policy job_applications_insert_own_active_job
  on public.job_applications
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
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
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (j.recruiter_id = auth.uid() or j.posted_by = auth.uid())
    )
  );

drop policy if exists job_applications_update_recruiter_or_admin on public.job_applications;
create policy job_applications_update_recruiter_or_admin
  on public.job_applications
  for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (j.recruiter_id = auth.uid() or j.posted_by = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.jobs j
      where j.id = job_id
        and (j.recruiter_id = auth.uid() or j.posted_by = auth.uid())
    )
  );

drop policy if exists job_applications_delete_own_or_admin on public.job_applications;
create policy job_applications_delete_own_or_admin
  on public.job_applications
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists job_favorites_select_own on public.job_favorites;
create policy job_favorites_select_own
  on public.job_favorites
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists job_favorites_insert_own_active_job on public.job_favorites;
create policy job_favorites_insert_own_active_job
  on public.job_favorites
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
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
  to authenticated
  using (user_id = auth.uid());

drop policy if exists recruiter_domains_select_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_select_own_or_admin
  on public.recruiter_domains
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists recruiter_domains_insert_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_insert_own_or_admin
  on public.recruiter_domains
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists recruiter_domains_update_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_update_own_or_admin
  on public.recruiter_domains
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists recruiter_domains_delete_own_or_admin on public.recruiter_domains;
create policy recruiter_domains_delete_own_or_admin
  on public.recruiter_domains
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists manual_overrides_admin_all on public.manual_overrides;
create policy manual_overrides_admin_all
  on public.manual_overrides
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists recruiter_entitlements_select_own_or_admin on public.recruiter_entitlements;
create policy recruiter_entitlements_select_own_or_admin
  on public.recruiter_entitlements
  for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists recruiter_entitlements_admin_all on public.recruiter_entitlements;
create policy recruiter_entitlements_admin_all
  on public.recruiter_entitlements
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists candidate_entitlements_select_own_or_admin on public.candidate_entitlements;
create policy candidate_entitlements_select_own_or_admin
  on public.candidate_entitlements
  for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists candidate_entitlements_admin_all on public.candidate_entitlements;
create policy candidate_entitlements_admin_all
  on public.candidate_entitlements
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table storage.objects enable row level security;

drop policy if exists override_docs_admin_select on storage.objects;
create policy override_docs_admin_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'override_docs' and public.is_admin());

drop policy if exists override_docs_admin_insert on storage.objects;
create policy override_docs_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'override_docs' and public.is_admin());

drop policy if exists override_docs_admin_update on storage.objects;
create policy override_docs_admin_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'override_docs' and public.is_admin())
  with check (bucket_id = 'override_docs' and public.is_admin());

drop policy if exists override_docs_admin_delete on storage.objects;
create policy override_docs_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'override_docs' and public.is_admin());
