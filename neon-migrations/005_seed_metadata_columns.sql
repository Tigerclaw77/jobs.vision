alter table public.jobs
  add column if not exists source text,
  add column if not exists seed_batch text;
