-- Allow classifier output for front-desk patient care roles and explicitly unrelated roles.
-- Existing import rows are preserved; this only broadens the role_badge constraint.

alter table public.job_imports
  drop constraint if exists job_imports_role_badge_check;

alter table public.job_imports
  add constraint job_imports_role_badge_check
  check (
    role_badge is null
    or role_badge in (
      'OD',
      'OPTICIAN',
      'TECH',
      'MANAGER',
      'OPTICAL',
      'FRONT_DESK',
      'OMD',
      'OTHER',
      'UNKNOWN'
    )
  );
