-- jobs.vision database inventory migration
-- 001_tables.sql
-- Generated from frontend/backend Supabase references. Do not apply blindly without reviewing
-- against the existing production Supabase project.

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
  salary text,
  tag_ids text[] not null default '{}',
  status text not null default 'active',
  featured boolean not null default false,
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
  insert into public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    created_at,
    updated_at
  )
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
