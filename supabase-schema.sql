create table if not exists public.workout_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  week integer not null check (week between 1 and 8),
  day_id text not null,
  day_title text not null,
  workout_source text not null default 'app'
    check (workout_source in ('app', 'box', 'custom')),
  readiness text,
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  movement_patterns text[] not null default '{}'
    check (
      movement_patterns <@ array[
        'squat', 'hinge', 'horizontal_push', 'vertical_push',
        'horizontal_pull', 'vertical_pull', 'olympic_lifting', 'gymnastics',
        'short_conditioning', 'medium_conditioning', 'long_conditioning',
        'aerobic', 'sprint'
      ]::text[]
    ),
  duration_minutes integer
    check (duration_minutes is null or duration_minutes between 1 and 300),
  rpe text,
  strength_result text,
  wod_score text,
  timer_result jsonb,
  competition_proof jsonb,
  notes text,
  mobility_done boolean not null default false,
  created_at timestamptz not null default now(),
  constraint workout_logs_readiness_valid check (
    (workout_source = 'box' and (readiness is null or readiness in ('green', 'amber', 'red')))
    or (workout_source in ('app', 'custom') and readiness in ('green', 'amber', 'red'))
  )
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

end
$$;

alter table public.pr_attempts
  drop constraint if exists pr_attempts_value_positive;
alter table public.pr_attempts
  add constraint pr_attempts_value_positive
  check (value > 0 and value < 'Infinity'::numeric) not valid;

alter table public.personal_records
  drop constraint if exists personal_records_value_nonnegative;
alter table public.personal_records
  add constraint personal_records_value_nonnegative
  check (value >= 0 and value < 'Infinity'::numeric) not valid;

alter table public.workout_logs
  drop constraint if exists workout_logs_created_at_finite;
alter table public.workout_logs
  add constraint workout_logs_created_at_finite
  check (isfinite(created_at)) not valid;

alter table public.pr_attempts
  drop constraint if exists pr_attempts_created_at_finite;
alter table public.pr_attempts
  add constraint pr_attempts_created_at_finite
  check (isfinite(created_at)) not valid;

alter table public.personal_records
  drop constraint if exists personal_records_updated_at_finite;
alter table public.personal_records
  add constraint personal_records_updated_at_finite
  check (isfinite(updated_at)) not valid;

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
alter table public.workout_logs
  validate constraint workout_logs_created_at_finite;
alter table public.pr_attempts
  validate constraint pr_attempts_created_at_finite;
alter table public.personal_records
  validate constraint personal_records_updated_at_finite;

drop index if exists public.workout_logs_user_created_id_idx;
create index workout_logs_user_created_id_idx
  on public.workout_logs (user_id, created_at desc, id desc);

drop index if exists public.pr_attempts_user_created_id_idx;
create index pr_attempts_user_created_id_idx
  on public.pr_attempts (user_id, created_at desc, id desc);

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
revoke all on table public.workout_logs from authenticated;
revoke all on table public.pr_attempts from authenticated;
revoke all on table public.personal_records from authenticated;

grant select, insert, update, delete on table public.workout_logs to authenticated;
grant select, insert, update, delete on table public.pr_attempts to authenticated;
grant select, insert, update, delete on table public.personal_records to authenticated;

create or replace function public.guard_personal_record_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id
    or new.metric_id is distinct from old.metric_id
  then
    raise exception using
      errcode = '22023',
      message = 'Personal-record ownership and metric identity cannot change.';
  end if;

  if new.value is null
    or new.value < 0
    or new.value >= 'Infinity'::numeric
    or new.value = 'NaN'::numeric
    or new.updated_at is null
    or not isfinite(new.updated_at)
  then
    raise exception using
      errcode = '22023',
      message = 'Personal record value and updated_at must be valid.';
  end if;

  if old.value = 0 then
    if new.value > 0
      or (
        new.value = 0
        and new.updated_at >= old.updated_at
      )
    then
      return new;
    end if;
    return old;
  end if;

  if new.value = 0 then
    return old;
  end if;

  if new.metric_id in ('row1k', 'row2k', 'run5k', 'murph') then
    if new.value < old.value then
      return new;
    end if;
  elsif new.value > old.value then
    return new;
  end if;

  if new.value = old.value
    and new.updated_at >= old.updated_at
  then
    return new;
  end if;

  return old;
end;
$function$;

drop trigger if exists personal_records_monotonic_update
  on public.personal_records;
create trigger personal_records_monotonic_update
before update on public.personal_records
for each row
execute function public.guard_personal_record_update();

drop function if exists public.save_pr_attempt(jsonb, jsonb);
create function public.save_pr_attempt(
  p_attempt jsonb,
  p_personal_record jsonb default null
)
returns jsonb
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
  v_canonical_record jsonb;
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
      or invalid_datetime_format
      or numeric_value_out_of_range
      or datetime_field_overflow
    then
      raise exception using
        errcode = '22023',
        message = 'PR attempt value, is_pr, or created_at has an invalid type.';
  end;

  if v_attempt_value is null
    or v_attempt_value <= 0
    or v_attempt_value >= 'Infinity'::numeric
    or v_attempt_value = 'NaN'::numeric
    or not isfinite(v_attempt_created_at)
  then
    raise exception using
      errcode = '22023',
      message = 'PR attempt value must be positive and finite, and created_at must be finite.';
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

  if v_attempt_is_pr
    and p_personal_record is not null
    and p_personal_record <> 'null'::jsonb
  then
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
        v_attempt_created_at
      );
    exception
      when invalid_text_representation
        or invalid_datetime_format
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
      or v_record_value >= 'Infinity'::numeric
      or v_record_value = 'NaN'::numeric
      or not isfinite(v_record_updated_at)
    then
      raise exception using
        errcode = '22023',
        message = 'Personal record value must be positive and finite, and updated_at must be finite.';
    end if;

    if v_record_value <> v_attempt_value then
      raise exception using
        errcode = '22023',
        message = 'The personal record value must match the PR attempt.';
    end if;

    insert into public.personal_records as current_record (
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

  select to_jsonb(canonical_record)
  into v_canonical_record
  from public.personal_records as canonical_record
  where canonical_record.user_id = v_user_id
    and canonical_record.metric_id = v_metric_id;

  return v_canonical_record;
end;
$function$;

create or replace function public.save_personal_record(
  p_personal_record jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_metric_id text;
  v_value numeric;
  v_display text;
  v_date text;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to save a personal record.';
  end if;

  if p_personal_record is null
    or jsonb_typeof(p_personal_record) is distinct from 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'p_personal_record must be a JSON object.';
  end if;

  v_metric_id := nullif(btrim(p_personal_record ->> 'metric_id'), '');
  v_display := nullif(btrim(p_personal_record ->> 'display'), '');
  v_date := nullif(btrim(p_personal_record ->> 'date'), '');

  if v_metric_id is null or v_display is null or v_date is null then
    raise exception using
      errcode = '22023',
      message = 'Personal record metric_id, display, and date are required.';
  end if;

  begin
    v_value := (p_personal_record ->> 'value')::numeric;
    v_updated_at := coalesce(
      nullif(p_personal_record ->> 'updated_at', '')::timestamptz,
      now()
    );
  exception
    when invalid_text_representation
      or invalid_datetime_format
      or numeric_value_out_of_range
      or datetime_field_overflow
    then
      raise exception using
        errcode = '22023',
        message = 'Personal record value or updated_at has an invalid type.';
  end;

  if v_value is null
    or v_value < 0
    or v_value >= 'Infinity'::numeric
    or v_value = 'NaN'::numeric
    or not isfinite(v_updated_at)
  then
    raise exception using
      errcode = '22023',
      message = 'Personal record value must be nonnegative and finite, and updated_at must be finite.';
  end if;

  insert into public.personal_records as current_record (
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
    v_metric_id,
    v_value,
    v_display,
    v_date,
    nullif(p_personal_record ->> 'notes', ''),
    v_updated_at
  )
  on conflict (user_id, metric_id) do update
  set value = excluded.value,
      display = excluded.display,
      date = excluded.date,
      notes = excluded.notes,
      updated_at = excluded.updated_at;
end;
$function$;

revoke all on function public.save_pr_attempt(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_pr_attempt(jsonb, jsonb) to authenticated;

revoke all on function public.save_personal_record(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_personal_record(jsonb) to authenticated;

revoke all on function public.guard_personal_record_update()
  from public, anon, authenticated, service_role;

create table if not exists public.athlete_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint athlete_states_schema_version_valid
    check (schema_version between 1 and 100),
  constraint athlete_states_state_valid
    check (
      jsonb_typeof(state) = 'object'
      and state ?& array[
        'profile',
        'plans',
        'activePlanId',
        'selectedWeek',
        'planSchemaVersion'
      ]
      and jsonb_typeof(state -> 'profile') = 'object'
      and jsonb_typeof(state -> 'plans') = 'array'
      and (
        state -> 'activePlanId' = 'null'::jsonb
        or jsonb_typeof(state -> 'activePlanId') = 'string'
      )
      and jsonb_typeof(state -> 'selectedWeek') = 'number'
      and (state ->> 'selectedWeek') ~ '^[1-8]$'
      and jsonb_typeof(state -> 'planSchemaVersion') = 'number'
    ),
  constraint athlete_states_state_size_valid
    check (octet_length(state::text) <= 5242880),
  constraint athlete_states_updated_at_finite
    check (isfinite(updated_at))
);

alter table public.athlete_states enable row level security;

drop policy if exists "Users can read their athlete state"
  on public.athlete_states;
drop policy if exists "Users can insert their athlete state"
  on public.athlete_states;
drop policy if exists "Users can update their athlete state"
  on public.athlete_states;

create policy "Users can read their athlete state"
  on public.athlete_states for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their athlete state"
  on public.athlete_states for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their athlete state"
  on public.athlete_states for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.athlete_states
  from public, anon, authenticated;
grant select, insert, update on table public.athlete_states
  to authenticated;

create or replace function public.guard_athlete_state_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '22023',
      message = 'Athlete-state ownership cannot change.';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists athlete_states_guard_update
  on public.athlete_states;
create trigger athlete_states_guard_update
before update on public.athlete_states
for each row
execute function public.guard_athlete_state_update();

revoke all on function public.guard_athlete_state_update()
  from public, anon, authenticated, service_role;

-- Box-aware coach calendar, readiness, and structured workout results.
create table if not exists public.training_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  kind text not null check (kind in ('app', 'box', 'rest')),
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'skipped')),
  session_id text,
  title text not null,
  raw_box_text text,
  movement_ids text[] not null default '{}',
  stimuli text[] not null default '{}'
    check (
      stimuli <@ array[
        'squat', 'hinge', 'horizontal_push', 'vertical_push',
        'horizontal_pull', 'vertical_pull', 'olympic_lifting', 'gymnastics',
        'short_conditioning', 'medium_conditioning', 'long_conditioning',
        'aerobic', 'sprint'
      ]::text[]
    ),
  recommendation jsonb check (
    recommendation is null or jsonb_typeof(recommendation) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_events_required_text_nonempty check (
    btrim(id) <> '' and btrim(date) <> '' and btrim(title) <> ''
  ),
  constraint training_events_times_finite check (
    isfinite(created_at) and isfinite(updated_at)
  )
);

create table if not exists public.readiness_checks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  energy smallint not null check (energy between 1 and 5),
  soreness text not null check (soreness in ('none', 'manageable', 'high')),
  pain boolean not null default false,
  available_minutes integer not null check (available_minutes between 15 and 180),
  created_at timestamptz not null default now(),
  constraint readiness_checks_required_text_nonempty check (
    btrim(id) <> '' and btrim(date) <> ''
  ),
  constraint readiness_checks_created_at_finite check (isfinite(created_at))
);

alter table public.workout_logs
  add column if not exists training_event_id text;
alter table public.workout_logs
  add column if not exists readiness_check_id text;
alter table public.workout_logs
  add column if not exists structured_score jsonb;
alter table public.workout_logs
  add column if not exists recommendation_snapshot jsonb;
alter table public.workout_logs
  add column if not exists rx_status text;

alter table public.workout_logs
  drop constraint if exists workout_logs_structured_score_object;
alter table public.workout_logs
  add constraint workout_logs_structured_score_object check (
    structured_score is null or jsonb_typeof(structured_score) = 'object'
  );
alter table public.workout_logs
  drop constraint if exists workout_logs_recommendation_snapshot_object;
alter table public.workout_logs
  add constraint workout_logs_recommendation_snapshot_object check (
    recommendation_snapshot is null
    or jsonb_typeof(recommendation_snapshot) = 'object'
  );
alter table public.workout_logs
  drop constraint if exists workout_logs_rx_status_valid;
alter table public.workout_logs
  add constraint workout_logs_rx_status_valid check (
    rx_status is null or rx_status in ('rx', 'scaled', 'not_applicable')
  );

alter table public.athlete_states
  drop constraint if exists athlete_states_state_valid;
alter table public.athlete_states
  add constraint athlete_states_state_valid check (
    jsonb_typeof(state) = 'object'
    and state ?& array[
      'profile', 'plans', 'activePlanId', 'selectedWeek', 'planSchemaVersion'
    ]
    and jsonb_typeof(state -> 'profile') = 'object'
    and jsonb_typeof(state -> 'plans') = 'array'
    and (
      state -> 'activePlanId' = 'null'::jsonb
      or jsonb_typeof(state -> 'activePlanId') = 'string'
    )
    and jsonb_typeof(state -> 'selectedWeek') = 'number'
    and (state ->> 'selectedWeek') ~ '^[1-8]$'
    and jsonb_typeof(state -> 'planSchemaVersion') = 'number'
    and (
      not (state ? 'cycleStartDate')
      or state -> 'cycleStartDate' = 'null'::jsonb
      or (
        jsonb_typeof(state -> 'cycleStartDate') = 'string'
        and (state ->> 'cycleStartDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      )
    )
  );

create index if not exists training_events_user_date_id_idx
  on public.training_events (user_id, date desc, id desc);
create index if not exists readiness_checks_user_date_id_idx
  on public.readiness_checks (user_id, date desc, id desc);
create index if not exists workout_logs_training_event_idx
  on public.workout_logs (user_id, training_event_id)
  where training_event_id is not null;

alter table public.training_events enable row level security;
alter table public.readiness_checks enable row level security;

drop policy if exists "Users can read their training events"
  on public.training_events;
drop policy if exists "Users can insert their training events"
  on public.training_events;
drop policy if exists "Users can update their training events"
  on public.training_events;
drop policy if exists "Users can delete their training events"
  on public.training_events;
drop policy if exists "Users can read their readiness checks"
  on public.readiness_checks;
drop policy if exists "Users can insert their readiness checks"
  on public.readiness_checks;
drop policy if exists "Users can update their readiness checks"
  on public.readiness_checks;
drop policy if exists "Users can delete their readiness checks"
  on public.readiness_checks;

create policy "Users can read their training events"
  on public.training_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their training events"
  on public.training_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their training events"
  on public.training_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their training events"
  on public.training_events for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their readiness checks"
  on public.readiness_checks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their readiness checks"
  on public.readiness_checks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their readiness checks"
  on public.readiness_checks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their readiness checks"
  on public.readiness_checks for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.training_events
  from public, anon, authenticated;
revoke all on table public.readiness_checks
  from public, anon, authenticated;
grant select, insert, update, delete on table public.training_events
  to authenticated;
grant select, insert, update, delete on table public.readiness_checks
  to authenticated;
