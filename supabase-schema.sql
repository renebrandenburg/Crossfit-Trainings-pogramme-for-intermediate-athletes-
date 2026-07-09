create table if not exists public.workout_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  week integer not null check (week between 1 and 8),
  day_id text not null,
  day_title text not null,
  readiness text not null check (readiness in ('green', 'amber', 'red')),
  rpe text,
  strength_result text,
  wod_score text,
  timer_result jsonb,
  notes text,
  mobility_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.workout_logs
  add column if not exists timer_result jsonb;

create table if not exists public.pr_attempts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_id text not null,
  metric_name text not null,
  value numeric not null,
  display text not null,
  date text not null,
  notes text,
  is_pr boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.personal_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_id text not null,
  value numeric not null,
  display text not null,
  date text not null,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, metric_id)
);

alter table public.workout_logs enable row level security;
alter table public.pr_attempts enable row level security;
alter table public.personal_records enable row level security;

drop policy if exists "Users can read their workout logs" on public.workout_logs;
drop policy if exists "Users can insert their workout logs" on public.workout_logs;
drop policy if exists "Users can update their workout logs" on public.workout_logs;
drop policy if exists "Users can delete their workout logs" on public.workout_logs;
drop policy if exists "Users can read their PR attempts" on public.pr_attempts;
drop policy if exists "Users can insert their PR attempts" on public.pr_attempts;
drop policy if exists "Users can update their PR attempts" on public.pr_attempts;
drop policy if exists "Users can delete their PR attempts" on public.pr_attempts;
drop policy if exists "Users can read their personal records" on public.personal_records;
drop policy if exists "Users can insert their personal records" on public.personal_records;
drop policy if exists "Users can update their personal records" on public.personal_records;
drop policy if exists "Users can delete their personal records" on public.personal_records;

create policy "Users can read their workout logs"
  on public.workout_logs for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert their workout logs"
  on public.workout_logs for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their workout logs"
  on public.workout_logs for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete their workout logs"
  on public.workout_logs for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can read their PR attempts"
  on public.pr_attempts for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert their PR attempts"
  on public.pr_attempts for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their PR attempts"
  on public.pr_attempts for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete their PR attempts"
  on public.pr_attempts for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can read their personal records"
  on public.personal_records for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert their personal records"
  on public.personal_records for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their personal records"
  on public.personal_records for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete their personal records"
  on public.personal_records for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);
