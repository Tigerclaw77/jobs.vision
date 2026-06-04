-- jobs.vision Neon PostgreSQL 17 migration
-- 002_indexes_constraints.sql

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

create index if not exists jobs_work_arrangement_idx
  on public.jobs (work_arrangement);

create index if not exists jobs_opportunity_types_gin_idx
  on public.jobs using gin (opportunity_types);

create index if not exists jobs_employment_types_gin_idx
  on public.jobs using gin (employment_types);

create index if not exists jobs_work_arrangements_gin_idx
  on public.jobs using gin (work_arrangements);

create index if not exists jobs_compensation_type_idx
  on public.jobs (compensation_type);

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
