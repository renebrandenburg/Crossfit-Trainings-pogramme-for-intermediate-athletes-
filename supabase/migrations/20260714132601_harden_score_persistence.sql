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
  competition_proof jsonb,
  notes text,
  mobility_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.workout_logs
  add column if not exists timer_result jsonb;

alter table public.workout_logs
  add column if not exists competition_proof jsonb;

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_logs_required_text_nonempty'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint workout_logs_required_text_nonempty
      check (
        btrim(id) <> ''
        and btrim(date) <> ''
        and btrim(day_id) <> ''
        and btrim(day_title) <> ''
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_logs_timer_result_object'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint workout_logs_timer_result_object
      check (timer_result is null or jsonb_typeof(timer_result) = 'object') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_logs_competition_proof_object'
      and conrelid = 'public.workout_logs'::regclass
  ) then
    alter table public.workout_logs
      add constraint workout_logs_competition_proof_object
      check (
        competition_proof is null
        or jsonb_typeof(competition_proof) = 'object'
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pr_attempts_required_text_nonempty'
      and conrelid = 'public.pr_attempts'::regclass
  ) then
    alter table public.pr_attempts
      add constraint pr_attempts_required_text_nonempty
      check (
        btrim(id) <> ''
        and btrim(metric_id) <> ''
        and btrim(metric_name) <> ''
        and btrim(display) <> ''
        and btrim(date) <> ''
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pr_attempts_value_positive'
      and conrelid = 'public.pr_attempts'::regclass
  ) then
    alter table public.pr_attempts
      add constraint pr_attempts_value_positive
      check (value > 0 and value <> 'NaN'::numeric) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_records_required_text_nonempty'
      and conrelid = 'public.personal_records'::regclass
  ) then
    alter table public.personal_records
      add constraint personal_records_required_text_nonempty
      check (
        btrim(metric_id) <> ''
        and btrim(display) <> ''
        and btrim(date) <> ''
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'personal_records_value_nonnegative'
      and conrelid = 'public.personal_records'::regclass
  ) then
    alter table public.personal_records
      add constraint personal_records_value_nonnegative
      check (value >= 0 and value <> 'NaN'::numeric) not valid;
  end if;
end
$$;

alter table public.workout_logs
  validate constraint workout_logs_required_text_nonempty;
alter table public.workout_logs
  validate constraint workout_logs_timer_result_object;
alter table public.workout_logs
  validate constraint workout_logs_competition_proof_object;
alter table public.pr_attempts
  validate constraint pr_attempts_required_text_nonempty;
alter table public.pr_attempts
  validate constraint pr_attempts_value_positive;
alter table public.personal_records
  validate constraint personal_records_required_text_nonempty;
alter table public.personal_records
  validate constraint personal_records_value_nonnegative;

create index if not exists workout_logs_user_created_id_idx
  on public.workout_logs (user_id, created_at desc, id);

create index if not exists pr_attempts_user_created_id_idx
  on public.pr_attempts (user_id, created_at desc, id);

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
  using ((select auth.uid()) = user_id);

create policy "Users can insert their workout logs"
  on public.workout_logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their workout logs"
  on public.workout_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their workout logs"
  on public.workout_logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their PR attempts"
  on public.pr_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their PR attempts"
  on public.pr_attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their PR attempts"
  on public.pr_attempts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their PR attempts"
  on public.pr_attempts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their personal records"
  on public.personal_records for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their personal records"
  on public.personal_records for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their personal records"
  on public.personal_records for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their personal records"
  on public.personal_records for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.workout_logs from public, anon;
revoke all on table public.pr_attempts from public, anon;
revoke all on table public.personal_records from public, anon;

grant select, insert, update, delete on table public.workout_logs to authenticated;
grant select, insert, update, delete on table public.pr_attempts to authenticated;
grant select, insert, update, delete on table public.personal_records to authenticated;

create or replace function public.save_pr_attempt(
  p_attempt jsonb,
  p_personal_record jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_attempt_id text;
  v_metric_id text;
  v_metric_name text;
  v_attempt_value numeric;
  v_attempt_display text;
  v_attempt_date text;
  v_attempt_is_pr boolean;
  v_attempt_created_at timestamptz;
  v_record_metric_id text;
  v_record_value numeric;
  v_record_display text;
  v_record_date text;
  v_record_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to save a PR attempt.';
  end if;

  if p_attempt is null or jsonb_typeof(p_attempt) is distinct from 'object' then
    raise exception using
      errcode = '22023',
      message = 'p_attempt must be a JSON object.';
  end if;

  v_attempt_id := nullif(btrim(p_attempt ->> 'id'), '');
  v_metric_id := nullif(btrim(p_attempt ->> 'metric_id'), '');
  v_metric_name := nullif(btrim(p_attempt ->> 'metric_name'), '');
  v_attempt_display := nullif(btrim(p_attempt ->> 'display'), '');
  v_attempt_date := nullif(btrim(p_attempt ->> 'date'), '');

  if v_attempt_id is null
    or v_metric_id is null
    or v_metric_name is null
    or v_attempt_display is null
    or v_attempt_date is null
  then
    raise exception using
      errcode = '22023',
      message = 'PR attempt id, metric_id, metric_name, display, and date are required.';
  end if;

  begin
    v_attempt_value := (p_attempt ->> 'value')::numeric;
    v_attempt_is_pr := coalesce((p_attempt ->> 'is_pr')::boolean, false);
    v_attempt_created_at := coalesce(
      nullif(p_attempt ->> 'created_at', '')::timestamptz,
      now()
    );
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
      or datetime_field_overflow
    then
      raise exception using
        errcode = '22023',
        message = 'PR attempt value, is_pr, or created_at has an invalid type.';
  end;

  if v_attempt_value is null
    or v_attempt_value <= 0
    or v_attempt_value = 'NaN'::numeric
  then
    raise exception using
      errcode = '22023',
      message = 'PR attempt value must be greater than zero.';
  end if;

  if v_attempt_is_pr
    and (p_personal_record is null or p_personal_record = 'null'::jsonb)
  then
    raise exception using
      errcode = '22023',
      message = 'A personal record payload is required for a PR attempt.';
  end if;

  if not v_attempt_is_pr
    and p_personal_record is not null
    and p_personal_record <> 'null'::jsonb
  then
    raise exception using
      errcode = '22023',
      message = 'A non-PR attempt cannot include a personal record payload.';
  end if;

  insert into public.pr_attempts (
    id,
    user_id,
    metric_id,
    metric_name,
    value,
    display,
    date,
    notes,
    is_pr,
    created_at
  )
  values (
    v_attempt_id,
    v_user_id,
    v_metric_id,
    v_metric_name,
    v_attempt_value,
    v_attempt_display,
    v_attempt_date,
    nullif(p_attempt ->> 'notes', ''),
    v_attempt_is_pr,
    v_attempt_created_at
  )
  on conflict (id) do update
  set user_id = excluded.user_id,
      metric_id = excluded.metric_id,
      metric_name = excluded.metric_name,
      value = excluded.value,
      display = excluded.display,
      date = excluded.date,
      notes = excluded.notes,
      is_pr = excluded.is_pr,
      created_at = excluded.created_at;

  if v_attempt_is_pr then
    if jsonb_typeof(p_personal_record) is distinct from 'object' then
      raise exception using
        errcode = '22023',
        message = 'p_personal_record must be a JSON object.';
    end if;

    v_record_metric_id := nullif(btrim(p_personal_record ->> 'metric_id'), '');
    v_record_display := nullif(btrim(p_personal_record ->> 'display'), '');
    v_record_date := nullif(btrim(p_personal_record ->> 'date'), '');

    if v_record_metric_id is null
      or v_record_display is null
      or v_record_date is null
    then
      raise exception using
        errcode = '22023',
        message = 'Personal record metric_id, display, and date are required.';
    end if;

    begin
      v_record_value := (p_personal_record ->> 'value')::numeric;
      v_record_updated_at := coalesce(
        nullif(p_personal_record ->> 'updated_at', '')::timestamptz,
        now()
      );
    exception
      when invalid_text_representation
        or numeric_value_out_of_range
        or datetime_field_overflow
      then
        raise exception using
          errcode = '22023',
          message = 'Personal record value or updated_at has an invalid type.';
    end;

    if v_record_metric_id <> v_metric_id then
      raise exception using
        errcode = '22023',
        message = 'The personal record metric_id must match the PR attempt.';
    end if;

    if v_record_value is null
      or v_record_value <= 0
      or v_record_value = 'NaN'::numeric
    then
      raise exception using
        errcode = '22023',
        message = 'Personal record value must be greater than zero.';
    end if;

    if v_record_value <> v_attempt_value then
      raise exception using
        errcode = '22023',
        message = 'The personal record value must match the PR attempt.';
    end if;

    insert into public.personal_records (
      user_id,
      metric_id,
      value,
      display,
      date,
      notes,
      updated_at
    )
    values (
      v_user_id,
      v_record_metric_id,
      v_record_value,
      v_record_display,
      v_record_date,
      nullif(p_personal_record ->> 'notes', ''),
      v_record_updated_at
    )
    on conflict (user_id, metric_id) do update
    set value = excluded.value,
        display = excluded.display,
        date = excluded.date,
        notes = excluded.notes,
        updated_at = excluded.updated_at;
  end if;
end;
$function$;

revoke all on function public.save_pr_attempt(jsonb, jsonb) from public, anon;
grant execute on function public.save_pr_attempt(jsonb, jsonb) to authenticated;
