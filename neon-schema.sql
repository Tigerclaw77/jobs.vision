-- jobs.vision consolidated Neon PostgreSQL 17 schema
-- User ids are stored as text to match Neon Auth user ids.
-- Provider-managed auth tables and managed object buckets are intentionally not referenced.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id text primary key,
  email text,
  role text not null default 'candidate',
  first_name text,
  last_name text,
  company text,
  locked boolean not null default false,
  locked_at timestamptz,
  failed_attempts integer not null default 0,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id text references public.profiles(id) on delete set null,
  posted_by text references public.profiles(id) on delete set null,
  title text not null,
  description text,
  company text,
  employer_name text,
  employer_brand text,
  employer_domain text,
  employer_brand_verified boolean not null default false,
  venue_brand text,
  venue_name text,
  venue_store_id text,
  venue_note text,
  location text,
  city text,
  state text,
  role text,
  hours text,
  type text,
  opportunity_type text,
  practice_type text,
  employment_type text,
  salary text,
  tag_ids text[] not null default '{}',
  status text not null default 'active',
  featured boolean not null default false,
  source text,
  seed_batch text,
  is_archived boolean not null default false,
  posted_at timestamptz not null default now(),
  first_activated_at timestamptz,
  last_activated_at timestamptz,
  archived_at timestamptz,
  total_active_seconds integer not null default 0,
  views integer not null default 0,
  saves integer not null default 0,
  applies integer not null default 0,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'submitted',
  resume_url text,
  cover_letter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.hidden_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.recruiter_domains (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  domain text not null,
  status text not null default 'pending',
  verification_token text,
  token_expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manual_overrides (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  role text,
  company text not null,
  company_website text,
  justification text,
  proof_urls text[] not null default '{}',
  requester_ip inet,
  captcha_score numeric,
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_entitlements (
  profile_id text primary key references public.profiles(id) on delete cascade,
  plan text not null default 'recruiter_basic',
  status text not null default 'inactive',
  max_active_jobs integer not null default 0,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_entitlements (
  profile_id text primary key references public.profiles(id) on delete cascade,
  plan text not null default 'candidate_free',
  status text not null default 'inactive',
  apply_cap_per_day integer not null default 0,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

drop trigger if exists set_job_applications_updated_at on public.job_applications;
create trigger set_job_applications_updated_at
  before update on public.job_applications
  for each row execute function public.set_updated_at();

drop trigger if exists set_recruiter_domains_updated_at on public.recruiter_domains;
create trigger set_recruiter_domains_updated_at
  before update on public.recruiter_domains
  for each row execute function public.set_updated_at();

drop trigger if exists set_manual_overrides_updated_at on public.manual_overrides;
create trigger set_manual_overrides_updated_at
  before update on public.manual_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists set_recruiter_entitlements_updated_at on public.recruiter_entitlements;
create trigger set_recruiter_entitlements_updated_at
  before update on public.recruiter_entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists set_candidate_entitlements_updated_at on public.candidate_entitlements;
create trigger set_candidate_entitlements_updated_at
  before update on public.candidate_entitlements
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'recruiter', 'candidate'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_failed_attempts_nonnegative') then
    alter table public.profiles
      add constraint profiles_failed_attempts_nonnegative
      check (failed_attempts >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_status_check') then
    alter table public.jobs
      add constraint jobs_status_check
      check (status in ('active', 'pending_domain', 'archived', 'draft', 'rejected', 'expired'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_counters_nonnegative') then
    alter table public.jobs
      add constraint jobs_counters_nonnegative
      check (
        total_active_seconds >= 0
        and views >= 0
        and saves >= 0
        and applies >= 0
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_applications_status_check') then
    alter table public.job_applications
      add constraint job_applications_status_check
      check (status in ('submitted', 'reviewed', 'accepted', 'rejected', 'withdrawn'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'recruiter_domains_status_check') then
    alter table public.recruiter_domains
      add constraint recruiter_domains_status_check
      check (status in ('pending', 'verified', 'rejected'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'recruiter_domains_domain_lower_check') then
    alter table public.recruiter_domains
      add constraint recruiter_domains_domain_lower_check
      check (domain = lower(domain) and domain !~ '^https?://');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'manual_overrides_status_check') then
    alter table public.manual_overrides
      add constraint manual_overrides_status_check
      check (status in ('pending', 'approved', 'denied'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'recruiter_entitlements_status_check') then
    alter table public.recruiter_entitlements
      add constraint recruiter_entitlements_status_check
      check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'recruiter_entitlements_max_jobs_nonnegative') then
    alter table public.recruiter_entitlements
      add constraint recruiter_entitlements_max_jobs_nonnegative
      check (max_active_jobs >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'candidate_entitlements_status_check') then
    alter table public.candidate_entitlements
      add constraint candidate_entitlements_status_check
      check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'candidate_entitlements_apply_cap_nonnegative') then
    alter table public.candidate_entitlements
      add constraint candidate_entitlements_apply_cap_nonnegative
      check (apply_cap_per_day >= 0);
  end if;
end $$;

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email))
  where email is not null;

create unique index if not exists profiles_stripe_customer_id_unique
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

create index if not exists profiles_search_trgm_idx
  on public.profiles using gin (
    (coalesce(email, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company, '')) gin_trgm_ops
  );

create index if not exists jobs_public_visibility_idx
  on public.jobs (status, is_archived, posted_at desc)
  where status = 'active' and is_archived = false;

create index if not exists jobs_recruiter_status_idx
  on public.jobs (recruiter_id, status, is_archived, posted_at desc);

create index if not exists jobs_posted_by_idx
  on public.jobs (posted_by);

create index if not exists jobs_city_state_idx
  on public.jobs (city, state);

create index if not exists jobs_role_idx
  on public.jobs (role);

create index if not exists jobs_type_idx
  on public.jobs (type);

create index if not exists jobs_opportunity_type_idx
  on public.jobs (opportunity_type);

create index if not exists jobs_practice_type_idx
  on public.jobs (practice_type);

create index if not exists jobs_employment_type_idx
  on public.jobs (employment_type);

create index if not exists jobs_employer_brand_idx
  on public.jobs (employer_brand);

create index if not exists jobs_employer_domain_idx
  on public.jobs (employer_domain);

create index if not exists jobs_tag_ids_gin_idx
  on public.jobs using gin (tag_ids);

create index if not exists jobs_title_trgm_idx
  on public.jobs using gin (title gin_trgm_ops);

create index if not exists jobs_employer_name_trgm_idx
  on public.jobs using gin (employer_name gin_trgm_ops);

create unique index if not exists job_applications_user_job_unique
  on public.job_applications (user_id, job_id);

create index if not exists job_applications_user_created_idx
  on public.job_applications (user_id, created_at desc);

create index if not exists job_applications_job_created_idx
  on public.job_applications (job_id, created_at desc);

create index if not exists job_applications_status_idx
  on public.job_applications (status);

create unique index if not exists job_favorites_user_job_unique
  on public.job_favorites (user_id, job_id);

create index if not exists job_favorites_user_created_idx
  on public.job_favorites (user_id, created_at desc);

create index if not exists job_favorites_job_idx
  on public.job_favorites (job_id);

create unique index if not exists hidden_jobs_user_job_unique
  on public.hidden_jobs (user_id, job_id);

create index if not exists hidden_jobs_user_created_idx
  on public.hidden_jobs (user_id, created_at desc);

create index if not exists hidden_jobs_job_idx
  on public.hidden_jobs (job_id);

create unique index if not exists recruiter_domains_user_domain_unique
  on public.recruiter_domains (user_id, domain);

create unique index if not exists recruiter_domains_verification_token_unique
  on public.recruiter_domains (verification_token)
  where verification_token is not null;

create index if not exists recruiter_domains_user_status_idx
  on public.recruiter_domains (user_id, status);

create index if not exists recruiter_domains_domain_lower_idx
  on public.recruiter_domains (lower(domain));

create index if not exists manual_overrides_status_created_idx
  on public.manual_overrides (status, created_at desc);

create index if not exists manual_overrides_email_lower_idx
  on public.manual_overrides (lower(email));

create index if not exists recruiter_entitlements_status_idx
  on public.recruiter_entitlements (status);

create unique index if not exists recruiter_entitlements_stripe_subscription_unique
  on public.recruiter_entitlements (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists candidate_entitlements_status_idx
  on public.candidate_entitlements (status);

create unique index if not exists candidate_entitlements_stripe_subscription_unique
  on public.candidate_entitlements (stripe_subscription_id)
  where stripe_subscription_id is not null;

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
