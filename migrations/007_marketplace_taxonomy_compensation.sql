alter table public.jobs
  add column if not exists opportunity_types text[] not null default '{}',
  add column if not exists employment_types text[] not null default '{}',
  add column if not exists work_arrangements text[] not null default '{}',
  add column if not exists compensation_type text,
  add column if not exists salary_min numeric(12,2),
  add column if not exists salary_max numeric(12,2),
  add column if not exists hourly_min numeric(10,2),
  add column if not exists hourly_max numeric(10,2),
  add column if not exists daily_rate numeric(10,2),
  add column if not exists compensation_notes text;

update public.jobs
set role = case
  when role in ('ophthalmic technician', 'ophthalmic_technician', 'tech', 'technician') then 'ophthalmic_technician'
  when role in ('practice manager', 'practice_manager', 'manager') then 'practice_manager'
  when role in ('optical lab', 'optical_lab') then 'optical_lab'
  when role in ('front desk', 'front_desk') then 'front_desk'
  when role in ('optometrist', 'optician', 'other') then role
  else role
end;

update public.jobs
set opportunity_type = case opportunity_type
  when 'associate_position' then 'associate_w2'
  when 'lease_opportunity' then 'corporate_lease'
  when 'ownership_track' then 'partnership_opportunity'
  when 'buy_in_opportunity' then 'partnership_opportunity'
  else opportunity_type
end;

update public.jobs
set work_arrangement = case
  when work_arrangement = 'onsite' then 'on_site'
  when work_arrangement in ('on_site', 'hybrid', 'remote') then work_arrangement
  when employment_type = 'remote' or type = 'remote' then 'remote'
  else work_arrangement
end;

update public.jobs
set employment_type = case
  when employment_type = 'remote' then 'full_time'
  else employment_type
end,
type = case
  when type = 'remote' then 'full_time'
  else type
end;

update public.jobs
set opportunity_types = case
  when role = 'optometrist' and opportunity_type is not null and opportunity_type <> '' then array[opportunity_type]
  else '{}'
end;

update public.jobs
set opportunity_type = null
where role <> 'optometrist';

update public.jobs
set employment_types = case
  when employment_type is not null and employment_type <> '' then array[employment_type]
  when type is not null and type <> '' then array[type]
  else '{}'
end;

update public.jobs
set work_arrangements = case
  when work_arrangement is not null and work_arrangement <> '' then array[work_arrangement]
  else '{}'
end;

update public.jobs
set employment_type = employment_types[1],
    type = employment_types[1]
where cardinality(employment_types) > 0;

update public.jobs
set work_arrangement = work_arrangements[1]
where cardinality(work_arrangements) > 0;

create index if not exists jobs_opportunity_types_gin_idx
  on public.jobs using gin (opportunity_types);

create index if not exists jobs_employment_types_gin_idx
  on public.jobs using gin (employment_types);

create index if not exists jobs_work_arrangements_gin_idx
  on public.jobs using gin (work_arrangements);

create index if not exists jobs_compensation_type_idx
  on public.jobs (compensation_type);
