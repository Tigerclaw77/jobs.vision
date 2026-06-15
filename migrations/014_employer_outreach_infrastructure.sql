-- Employer outreach tracking on discovery-source employer records.
-- Infrastructure only: no email sending, CRM, or automation.

alter table public.job_discovery_sources
  add column if not exists contact_email text,
  add column if not exists contact_status text not null default 'not_contacted';

update public.job_discovery_sources
set contact_status = coalesce(nullif(contact_status, ''), 'not_contacted');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_discovery_sources_contact_status_check') then
    alter table public.job_discovery_sources
      add constraint job_discovery_sources_contact_status_check
      check (contact_status in ('not_contacted', 'contacted', 'responded', 'claimed', 'declined'));
  end if;
end $$;

create index if not exists job_discovery_sources_contact_status_idx
  on public.job_discovery_sources (contact_status, employer_name);
