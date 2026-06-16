create table if not exists public.recruiter_posting_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  role text not null,
  required_plan_key text not null,
  db_plan text not null,
  status text not null default 'incomplete',
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_lookup_key text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recruiter_posting_payments_plan_check') then
    alter table public.recruiter_posting_payments
      add constraint recruiter_posting_payments_plan_check
      check (
        required_plan_key in ('staff', 'manager', 'doctor')
        and db_plan in ('recruiter_staff', 'recruiter_manager', 'recruiter_doctor')
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'recruiter_posting_payments_status_check') then
    alter table public.recruiter_posting_payments
      add constraint recruiter_posting_payments_status_check
      check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'));
  end if;
end $$;

create unique index if not exists recruiter_posting_payments_job_unique
  on public.recruiter_posting_payments (job_id);

create index if not exists recruiter_posting_payments_profile_status_idx
  on public.recruiter_posting_payments (profile_id, status, updated_at desc);

create index if not exists recruiter_posting_payments_job_status_idx
  on public.recruiter_posting_payments (job_id, status);

create unique index if not exists recruiter_posting_payments_checkout_session_unique
  on public.recruiter_posting_payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists recruiter_posting_payments_subscription_unique
  on public.recruiter_posting_payments (stripe_subscription_id)
  where stripe_subscription_id is not null;

drop trigger if exists set_recruiter_posting_payments_updated_at on public.recruiter_posting_payments;
create trigger set_recruiter_posting_payments_updated_at
  before update on public.recruiter_posting_payments
  for each row execute function public.set_updated_at();

alter table public.recruiter_posting_payments enable row level security;

drop policy if exists recruiter_posting_payments_select_own_or_admin on public.recruiter_posting_payments;
create policy recruiter_posting_payments_select_own_or_admin
  on public.recruiter_posting_payments
  for select
  using (profile_id = public.current_auth_user_id() or public.is_admin());

drop policy if exists recruiter_posting_payments_admin_all on public.recruiter_posting_payments;
create policy recruiter_posting_payments_admin_all
  on public.recruiter_posting_payments
  for all
  using (public.is_admin())
  with check (public.is_admin());
