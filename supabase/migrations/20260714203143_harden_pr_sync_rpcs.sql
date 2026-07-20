alter table public.workout_logs
  drop constraint if exists workout_logs_created_at_finite;
alter table public.workout_logs
  add constraint workout_logs_created_at_finite
  check (isfinite(created_at)) not valid;
alter table public.workout_logs
  validate constraint workout_logs_created_at_finite;

alter table public.pr_attempts
  drop constraint if exists pr_attempts_created_at_finite;
alter table public.pr_attempts
  add constraint pr_attempts_created_at_finite
  check (isfinite(created_at)) not valid;
alter table public.pr_attempts
  validate constraint pr_attempts_created_at_finite;

alter table public.personal_records
  drop constraint if exists personal_records_updated_at_finite;
alter table public.personal_records
  add constraint personal_records_updated_at_finite
  check (isfinite(updated_at)) not valid;
alter table public.personal_records
  validate constraint personal_records_updated_at_finite;

drop index if exists public.workout_logs_user_created_id_idx;
create index workout_logs_user_created_id_idx
  on public.workout_logs (user_id, created_at desc, id desc);

drop index if exists public.pr_attempts_user_created_id_idx;
create index pr_attempts_user_created_id_idx
  on public.pr_attempts (user_id, created_at desc, id desc);

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
