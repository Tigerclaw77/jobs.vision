-- Marketplace listing metadata for imported, paid, featured, sponsor, and future opportunity listings.
-- Additive only: no drops, no renames, no automatic publishing.

alter table public.jobs
  add column if not exists listing_source text not null default 'employer_submitted',
  add column if not exists listing_tier text not null default 'standard_paid',
  add column if not exists listing_opportunity_type text not null default 'job',
  add column if not exists location_precision text not null default 'unknown';

alter table public.job_imports
  add column if not exists listing_source text not null default 'imported',
  add column if not exists listing_tier text not null default 'imported',
  add column if not exists listing_opportunity_type text not null default 'job',
  add column if not exists location_precision text not null default 'unknown';

update public.jobs
set
  listing_source = case
    when source in ('discovery', 'import', 'imported') or external_apply_url is not null then 'imported'
    else coalesce(nullif(listing_source, ''), 'employer_submitted')
  end,
  listing_tier = case
    when featured = true then 'featured'
    when source in ('discovery', 'import', 'imported') or external_apply_url is not null then 'imported'
    else coalesce(nullif(listing_tier, ''), 'standard_paid')
  end,
  listing_opportunity_type = coalesce(nullif(listing_opportunity_type, ''), 'job'),
  location_precision = case
    when location_precision is not null and location_precision <> '' then location_precision
    when latitude is not null and longitude is not null then 'city'
    when city is not null or location is not null then 'city'
    when state is not null then 'state'
    else 'unknown'
  end;

update public.job_imports
set
  listing_source = 'imported',
  listing_tier = coalesce(nullif(listing_tier, ''), 'imported'),
  listing_opportunity_type = coalesce(nullif(listing_opportunity_type, ''), 'job'),
  location_precision = case
    when location_precision is not null and location_precision <> '' then location_precision
    when normalized_location is not null or raw_location is not null then 'city'
    else 'unknown'
  end;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_listing_source_check') then
    alter table public.jobs
      add constraint jobs_listing_source_check
      check (listing_source in ('imported', 'employer_submitted'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_listing_tier_check') then
    alter table public.jobs
      add constraint jobs_listing_tier_check
      check (listing_tier in ('imported', 'standard_paid', 'featured', 'sponsor'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_listing_opportunity_type_check') then
    alter table public.jobs
      add constraint jobs_listing_opportunity_type_check
      check (listing_opportunity_type in ('job', 'practice_sale', 'partnership', 'lease'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_location_precision_check') then
    alter table public.jobs
      add constraint jobs_location_precision_check
      check (location_precision in ('exact', 'facility', 'city', 'metro', 'state', 'remote', 'multiple', 'unknown'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_listing_source_check') then
    alter table public.job_imports
      add constraint job_imports_listing_source_check
      check (listing_source in ('imported', 'employer_submitted'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_listing_tier_check') then
    alter table public.job_imports
      add constraint job_imports_listing_tier_check
      check (listing_tier in ('imported', 'standard_paid', 'featured', 'sponsor'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_listing_opportunity_type_check') then
    alter table public.job_imports
      add constraint job_imports_listing_opportunity_type_check
      check (listing_opportunity_type in ('job', 'practice_sale', 'partnership', 'lease'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'job_imports_location_precision_check') then
    alter table public.job_imports
      add constraint job_imports_location_precision_check
      check (location_precision in ('exact', 'facility', 'city', 'metro', 'state', 'remote', 'multiple', 'unknown'));
  end if;
end $$;

create index if not exists jobs_public_listing_rank_idx
  on public.jobs (status, is_archived, listing_tier, posted_at desc)
  where status = 'active' and is_archived = false;

create index if not exists jobs_listing_source_idx
  on public.jobs (listing_source);

create index if not exists jobs_listing_tier_idx
  on public.jobs (listing_tier);

create index if not exists jobs_listing_opportunity_type_idx
  on public.jobs (listing_opportunity_type);

create index if not exists jobs_location_precision_idx
  on public.jobs (location_precision);

create index if not exists job_imports_listing_filters_idx
  on public.job_imports (status, listing_tier, listing_opportunity_type, discovered_at desc);
