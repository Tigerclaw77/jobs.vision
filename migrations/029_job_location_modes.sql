alter table public.jobs
  add column if not exists location_mode text not null default 'single',
  add column if not exists additional_locations text[] not null default '{}';

update public.jobs
set location_mode = case
  when location_precision = 'remote' then 'remote'
  when location_precision = 'multiple' then 'multiple'
  else coalesce(nullif(location_mode, ''), 'single')
end
where location_mode is null
  or location_mode = ''
  or location_mode = 'single';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_location_mode_check') then
    alter table public.jobs
      add constraint jobs_location_mode_check
      check (location_mode in ('single', 'multiple', 'remote'));
  end if;
end $$;

create index if not exists jobs_location_mode_idx
  on public.jobs (location_mode);

create index if not exists jobs_additional_locations_gin_idx
  on public.jobs using gin (additional_locations);
