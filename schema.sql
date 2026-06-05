-- jobs.vision consolidated schema inventory
-- Tables referenced by live frontend/backend Supabase code:
-- profiles, jobs, job_applications, job_favorites, recruiter_domains,
-- manual_overrides, recruiter_entitlements, candidate_entitlements.
-- Supabase storage buckets referenced: override_docs.
--
-- Applyable migration sources:
--   migrations/001_tables.sql
--   migrations/002_indexes_constraints.sql

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
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'candidate',
  first_name text,
  last_name text,
  company text,
  phone text,
  company_website text,
  company_description text,
  company_logo_url text,
  company_location text,
  application_use_account_email boolean not null default true,
  application_email text,
  application_phone text,
  application_website text,
  application_instructions text,
  email_notifications boolean not null default true,
  sms_notifications boolean not null default false,
  lead_notifications boolean not null default true,
  weekly_summary_emails boolean not null default true,
  saved_search_alerts boolean not null default false,
  specialty_interests text[] not null default '{}',
  locked boolean not null default false,
  locked_at timestamptz,
  failed_attempts integer not null default 0,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid references public.profiles(id) on delete set null,
  posted_by uuid references public.profiles(id) on delete set null,
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
  opportunity_types text[] not null default '{}',
  practice_type text,
  employment_type text,
  employment_types text[] not null default '{}',
  work_arrangement text,
  work_arrangements text[] not null default '{}',
  compensation_type text,
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  hourly_min numeric(10,2),
  hourly_max numeric(10,2),
  daily_rate numeric(10,2),
  compensation_notes text,
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
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'submitted',
  resume_url text,
  cover_letter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.recruiter_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'recruiter_basic',
  status text not null default 'inactive',
  max_active_jobs integer not null default 0,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_entitlements (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'candidate_free',
  status text not null default 'inactive',
  apply_cap_per_day integer not null default 0,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'candidate'),
    nullif(new.raw_user_meta_data->>'firstName', ''),
    nullif(new.raw_user_meta_data->>'lastName', ''),
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        role = coalesce(public.profiles.role, excluded.role),
        first_name = coalesce(public.profiles.first_name, excluded.first_name),
        last_name = coalesce(public.profiles.last_name, excluded.last_name),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

drop trigger if exists set_job_applications_updated_at on public.job_applications;
create trigger set_job_applications_updated_at before update on public.job_applications
  for each row execute function public.set_updated_at();

drop trigger if exists set_recruiter_domains_updated_at on public.recruiter_domains;
create trigger set_recruiter_domains_updated_at before update on public.recruiter_domains
  for each row execute function public.set_updated_at();

drop trigger if exists set_manual_overrides_updated_at on public.manual_overrides;
create trigger set_manual_overrides_updated_at before update on public.manual_overrides
  for each row execute function public.set_updated_at();

drop trigger if exists set_recruiter_entitlements_updated_at on public.recruiter_entitlements;
create trigger set_recruiter_entitlements_updated_at before update on public.recruiter_entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists set_candidate_entitlements_updated_at on public.candidate_entitlements;
create trigger set_candidate_entitlements_updated_at before update on public.candidate_entitlements
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'override_docs',
  'override_docs',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'recruiter', 'candidate'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_failed_attempts_nonnegative') then
    alter table public.profiles add constraint profiles_failed_attempts_nonnegative check (failed_attempts >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_status_check') then
    alter table public.jobs add constraint jobs_status_check check (status in ('active', 'pending_domain', 'archived', 'draft', 'rejected', 'expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_counters_nonnegative') then
    alter table public.jobs add constraint jobs_counters_nonnegative check (total_active_seconds >= 0 and views >= 0 and saves >= 0 and applies >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_applications_status_check') then
    alter table public.job_applications add constraint job_applications_status_check check (status in ('submitted', 'reviewed', 'accepted', 'rejected', 'withdrawn'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recruiter_domains_status_check') then
    alter table public.recruiter_domains add constraint recruiter_domains_status_check check (status in ('pending', 'verified', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recruiter_domains_domain_lower_check') then
    alter table public.recruiter_domains add constraint recruiter_domains_domain_lower_check check (domain = lower(domain) and domain !~ '^https?://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'manual_overrides_status_check') then
    alter table public.manual_overrides add constraint manual_overrides_status_check check (status in ('pending', 'approved', 'denied'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recruiter_entitlements_status_check') then
    alter table public.recruiter_entitlements add constraint recruiter_entitlements_status_check check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recruiter_entitlements_max_jobs_nonnegative') then
    alter table public.recruiter_entitlements add constraint recruiter_entitlements_max_jobs_nonnegative check (max_active_jobs >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'candidate_entitlements_status_check') then
    alter table public.candidate_entitlements add constraint candidate_entitlements_status_check check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'candidate_entitlements_apply_cap_nonnegative') then
    alter table public.candidate_entitlements add constraint candidate_entitlements_apply_cap_nonnegative check (apply_cap_per_day >= 0);
  end if;
end $$;

create unique index if not exists profiles_email_lower_unique on public.profiles (lower(email)) where email is not null;
create unique index if not exists profiles_stripe_customer_id_unique on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_search_trgm_idx on public.profiles using gin ((coalesce(email, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(company, '')) gin_trgm_ops);

create index if not exists jobs_public_visibility_idx on public.jobs (status, is_archived, posted_at desc) where status = 'active' and is_archived = false;
create index if not exists jobs_recruiter_status_idx on public.jobs (recruiter_id, status, is_archived, posted_at desc);
create index if not exists jobs_posted_by_idx on public.jobs (posted_by);
create index if not exists jobs_city_state_idx on public.jobs (city, state);
create index if not exists jobs_role_idx on public.jobs (role);
create index if not exists jobs_type_idx on public.jobs (type);
create index if not exists jobs_opportunity_type_idx on public.jobs (opportunity_type);
create index if not exists jobs_practice_type_idx on public.jobs (practice_type);
create index if not exists jobs_employment_type_idx on public.jobs (employment_type);
create index if not exists jobs_work_arrangement_idx on public.jobs (work_arrangement);
create index if not exists jobs_opportunity_types_gin_idx on public.jobs using gin (opportunity_types);
create index if not exists jobs_employment_types_gin_idx on public.jobs using gin (employment_types);
create index if not exists jobs_work_arrangements_gin_idx on public.jobs using gin (work_arrangements);
create index if not exists jobs_compensation_type_idx on public.jobs (compensation_type);
create index if not exists jobs_employer_brand_idx on public.jobs (employer_brand);
create index if not exists jobs_employer_domain_idx on public.jobs (employer_domain);
create index if not exists jobs_tag_ids_gin_idx on public.jobs using gin (tag_ids);
create index if not exists jobs_title_trgm_idx on public.jobs using gin (title gin_trgm_ops);
create index if not exists jobs_employer_name_trgm_idx on public.jobs using gin (employer_name gin_trgm_ops);

create unique index if not exists job_applications_user_job_unique on public.job_applications (user_id, job_id);
create index if not exists job_applications_user_created_idx on public.job_applications (user_id, created_at desc);
create index if not exists job_applications_job_created_idx on public.job_applications (job_id, created_at desc);
create index if not exists job_applications_status_idx on public.job_applications (status);

create unique index if not exists job_favorites_user_job_unique on public.job_favorites (user_id, job_id);
create index if not exists job_favorites_user_created_idx on public.job_favorites (user_id, created_at desc);
create index if not exists job_favorites_job_idx on public.job_favorites (job_id);

create unique index if not exists recruiter_domains_user_domain_unique on public.recruiter_domains (user_id, domain);
create unique index if not exists recruiter_domains_verification_token_unique on public.recruiter_domains (verification_token) where verification_token is not null;
create index if not exists recruiter_domains_user_status_idx on public.recruiter_domains (user_id, status);
create index if not exists recruiter_domains_domain_lower_idx on public.recruiter_domains (lower(domain));

create index if not exists manual_overrides_status_created_idx on public.manual_overrides (status, created_at desc);
create index if not exists manual_overrides_email_lower_idx on public.manual_overrides (lower(email));

create index if not exists recruiter_entitlements_status_idx on public.recruiter_entitlements (status);
create unique index if not exists recruiter_entitlements_stripe_subscription_unique on public.recruiter_entitlements (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists candidate_entitlements_status_idx on public.candidate_entitlements (status);
create unique index if not exists candidate_entitlements_stripe_subscription_unique on public.candidate_entitlements (stripe_subscription_id) where stripe_subscription_id is not null;
