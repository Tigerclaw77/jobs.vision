-- jobs.vision Neon PostgreSQL 17 migration
-- 008_profile_system_expansion.sql
-- Adds account-management fields for candidate, recruiter, and admin profiles.
-- Safe to run on an existing database; does not alter jobs, applications, billing, or auth.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists company_website text,
  add column if not exists company_description text,
  add column if not exists company_logo_url text,
  add column if not exists company_location text,
  add column if not exists application_use_account_email boolean not null default true,
  add column if not exists application_email text,
  add column if not exists application_phone text,
  add column if not exists application_website text,
  add column if not exists application_instructions text,
  add column if not exists email_notifications boolean not null default true,
  add column if not exists sms_notifications boolean not null default false,
  add column if not exists lead_notifications boolean not null default true,
  add column if not exists weekly_summary_emails boolean not null default true,
  add column if not exists saved_search_alerts boolean not null default false,
  add column if not exists specialty_interests text[] not null default '{}';
