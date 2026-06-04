alter table public.jobs
  add column if not exists work_arrangement text;

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
end;

update public.jobs
set type = employment_type
where employment_type is not null;

create index if not exists jobs_work_arrangement_idx
  on public.jobs (work_arrangement);
