alter table public.training_blocks
  add column if not exists ends_with_test boolean not null default false,
  add column if not exists planned_test_movement_ids text[] not null default '{}',
  add column if not exists test_week_number integer,
  add column if not exists test_strategy text not null default 'none'
    check (test_strategy in ('none', 'true_1rm', 'technical_1rm', 'rep_max', 'estimated_1rm'));

alter table public.training_sessions
  drop constraint if exists training_sessions_week_number_check;

alter table public.training_sessions
  add constraint training_sessions_week_number_check
    check (week_number between 1 and 8),
  add column if not exists session_type text not null default 'normal'
    check (session_type in ('normal', 'deload', 'max_test', 'benchmark', 'recovery')),
  add column if not exists max_test_prescription_id uuid;

create table if not exists public.athlete_movement_maxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_id text not null references public.movements(id),
  tested_one_rep_max_kg numeric check (tested_one_rep_max_kg is null or tested_one_rep_max_kg > 0),
  technical_one_rep_max_kg numeric check (technical_one_rep_max_kg is null or technical_one_rep_max_kg > 0),
  estimated_one_rep_max_kg numeric check (estimated_one_rep_max_kg is null or estimated_one_rep_max_kg > 0),
  training_max_kg numeric check (training_max_kg is null or training_max_kg > 0),
  source text not null check (source in ('true_1rm_test', 'technical_1rm_test', 'estimated_1rm', 'manual_entry')),
  tested_at timestamptz,
  updated_at timestamptz not null check (isfinite(updated_at)),
  unique (user_id, movement_id)
);

create table if not exists public.v2_personal_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_id text not null references public.movements(id),
  record_type text not null check (record_type in ('true_1rm', 'technical_1rm', 'estimated_1rm', '3rm', '5rm')),
  load_kg numeric not null check (load_kg > 0),
  achieved_at timestamptz not null check (isfinite(achieved_at)),
  session_id uuid,
  previous_record_kg numeric check (previous_record_kg is null or previous_record_kg > 0),
  unique (user_id, id)
);

create table if not exists public.max_test_prescriptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  movement_id text not null references public.movements(id),
  test_type text not null check (test_type in ('true_1rm', 'technical_1rm', 'estimated_1rm', 'rep_max', 'heavy_single')),
  eligibility jsonb not null check (jsonb_typeof(eligibility) = 'object'),
  warmup_sets jsonb not null default '[]' check (jsonb_typeof(warmup_sets) = 'array'),
  planned_attempts jsonb not null default '[]' check (jsonb_typeof(planned_attempts) = 'array'),
  attempt_results jsonb not null default '[]' check (jsonb_typeof(attempt_results) = 'array'),
  stopping_rules jsonb not null default '[]' check (jsonb_typeof(stopping_rules) = 'array'),
  technical_standards jsonb,
  max_update jsonb,
  estimated_duration_minutes numeric not null check (estimated_duration_minutes > 0 and estimated_duration_minutes <= 65),
  unique (user_id, id)
);

alter table public.training_sessions
  add constraint training_sessions_max_test_fk
  foreign key (max_test_prescription_id)
  references public.max_test_prescriptions(id)
  deferrable initially deferred;

alter table public.athlete_movement_maxes enable row level security;
alter table public.v2_personal_records enable row level security;
alter table public.max_test_prescriptions enable row level security;

create policy "athlete movement maxes are owner scoped"
  on public.athlete_movement_maxes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "v2 personal records are owner scoped"
  on public.v2_personal_records for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "max test prescriptions are owner scoped"
  on public.max_test_prescriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.athlete_movement_maxes from anon;
revoke all on table public.v2_personal_records from anon;
revoke all on table public.max_test_prescriptions from anon;
grant select, insert, update, delete on table public.athlete_movement_maxes to authenticated;
grant select, insert, update, delete on table public.v2_personal_records to authenticated;
grant select, insert, update, delete on table public.max_test_prescriptions to authenticated;

create or replace function public.save_programming_engine_v2_testing(
  p_program jsonb,
  p_expected_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_existing_revision integer;
  v_revision integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_program is null
    or p_program ->> 'engineVersion' is distinct from 'v2'
    or coalesce((p_program #>> '{validation,valid}')::boolean, false) is not true
    or exists (
      select 1 from jsonb_array_elements(coalesce(p_program #> '{validation,issues}', '[]'::jsonb)) issue
      where issue ->> 'severity' = 'error'
    )
  then
    raise exception using errcode = '22023', message = 'A validated V2 testing programme is required.';
  end if;
  select revision into v_existing_revision
  from public.training_programs
  where id = (p_program ->> 'id')::uuid and user_id = v_user_id
  for update;
  if p_expected_revision is not null and coalesce(v_existing_revision, 0) <> p_expected_revision then
    raise exception using errcode = '40001', message = 'V2 programme revision conflict.';
  end if;
  v_revision := coalesce(v_existing_revision, 0) + 1;
  insert into public.training_programs (
    id, user_id, engine_version, schema_version, template_version,
    catalog_version, validator_version, name, status,
    active_training_block_id, revision, validated_snapshot, created_at, updated_at
  ) values (
    (p_program ->> 'id')::uuid,
    v_user_id,
    'v2',
    2,
    p_program ->> 'templateVersion',
    (p_program ->> 'catalogVersion')::integer,
    (p_program ->> 'validatorVersion')::integer,
    p_program ->> 'name',
    p_program ->> 'status',
    null,
    v_revision,
    p_program,
    (p_program ->> 'createdAt')::timestamptz,
    (p_program ->> 'updatedAt')::timestamptz
  )
  on conflict (id, user_id) do update set
    name = excluded.name,
    status = excluded.status,
    active_training_block_id = null,
    revision = excluded.revision,
    validated_snapshot = excluded.validated_snapshot,
    updated_at = excluded.updated_at;
  return jsonb_build_object(
    'programId', p_program ->> 'id',
    'revision', v_revision,
    'updatedAt', p_program ->> 'updatedAt'
  );
end;
$function$;

revoke all on function public.save_programming_engine_v2_testing(jsonb, integer) from public, anon;
grant execute on function public.save_programming_engine_v2_testing(jsonb, integer) to authenticated;
