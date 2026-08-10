create or replace function public.save_programming_engine_v2_profile(
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
  v_block jsonb;
  v_profile jsonb;
  v_request jsonb;
  v_existing_revision integer;
  v_revision integer;
  v_duration integer;
  v_sessions_per_week integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_program is null
    or jsonb_typeof(p_program) <> 'object'
    or p_program ->> 'engineVersion' is distinct from 'v2'
    or (p_program ->> 'schemaVersion')::integer is distinct from 2
    or coalesce((p_program #>> '{validation,valid}')::boolean, false) is not true
    or exists (
      select 1
      from jsonb_array_elements(coalesce(p_program #> '{validation,issues}', '[]'::jsonb)) issue
      where issue ->> 'severity' = 'error'
    )
  then
    raise exception using errcode = '22023', message = 'A validated V2 profile programme is required.';
  end if;

  v_profile := p_program -> 'programmeProfile';
  v_request := p_program -> 'generationRequest';
  if jsonb_typeof(v_profile) is distinct from 'object'
    or jsonb_typeof(v_request) is distinct from 'object'
    or jsonb_typeof(p_program -> 'trainingBlocks') is distinct from 'array'
    or jsonb_array_length(p_program -> 'trainingBlocks') <> 1
    or coalesce((p_program #>> '{generationSummary,identityValidation,valid}')::boolean, false) is not true
  then
    raise exception using errcode = '22023', message = 'V2 programme identity metadata is invalid.';
  end if;

  v_block := p_program #> '{trainingBlocks,0}';
  v_duration := (v_block ->> 'durationWeeks')::integer;
  v_sessions_per_week := (v_block ->> 'plannedSessionCount')::integer;
  if nullif(btrim(p_program ->> 'id'), '') is null
    or nullif(btrim(p_program ->> 'templateVersion'), '') is null
    or nullif(btrim(p_program ->> 'generatorVersion'), '') is null
    or nullif(btrim(p_program ->> 'name'), '') is null
    or nullif(btrim(v_profile ->> 'primaryGoal'), '') is null
    or nullif(btrim(v_profile ->> 'trainingBlock'), '') is null
    or nullif(btrim(v_request ->> 'programmeType'), '') is null
    or p_program ->> 'templateVersion' is distinct from p_program ->> 'generatorVersion'
    or v_request ->> 'programmeVersion' is distinct from p_program ->> 'templateVersion'
    or p_program ->> 'activeTrainingBlockId' is distinct from v_block ->> 'id'
    or v_request ->> 'programmeType' is distinct from v_block ->> 'templateId'
    or v_request ->> 'trainingBlock' is distinct from v_profile ->> 'trainingBlock'
    or v_block ->> 'blockType' is distinct from v_profile ->> 'trainingBlock'
    or v_request #>> '{athleteGoals,0}' is distinct from v_profile ->> 'primaryGoal'
    or (v_request ->> 'cycleLengthWeeks')::integer is distinct from v_duration
    or (v_request ->> 'sessionsPerWeek')::integer is distinct from v_sessions_per_week
    or v_duration not in (6, 8)
    or v_sessions_per_week not between 2 and 4
    or jsonb_typeof(v_block -> 'trainingWeeks') is distinct from 'array'
    or jsonb_array_length(v_block -> 'trainingWeeks') <> v_duration
    or exists (
      select 1
      from jsonb_array_elements(v_block -> 'trainingWeeks') week
      where jsonb_typeof(week -> 'sessions') is distinct from 'array'
        or jsonb_array_length(week -> 'sessions') <> v_sessions_per_week
    )
    or (
      p_program ->> 'ownerId' is not null
      and (p_program ->> 'ownerId')::uuid <> v_user_id
    )
  then
    raise exception using errcode = '22023', message = 'V2 programme profile, duration, or frequency is inconsistent.';
  end if;

  select revision into v_existing_revision
  from public.training_programs
  where id = (p_program ->> 'id')::uuid and user_id = v_user_id
  for update;
  if p_expected_revision is not null
    and coalesce(v_existing_revision, 0) <> p_expected_revision
  then
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
    template_version = excluded.template_version,
    catalog_version = excluded.catalog_version,
    validator_version = excluded.validator_version,
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

revoke all on function public.save_programming_engine_v2_profile(jsonb, integer) from public, anon;
grant execute on function public.save_programming_engine_v2_profile(jsonb, integer) to authenticated;
