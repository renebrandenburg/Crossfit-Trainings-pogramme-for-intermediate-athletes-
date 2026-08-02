begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

select has_table('public', 'movement_families', 'movement_families exists');
select has_table('public', 'movements', 'movements exists');
select has_table('public', 'training_programs', 'training_programs exists');
select has_table('public', 'training_blocks', 'training_blocks exists');
select has_table('public', 'progression_tracks', 'progression_tracks exists');
select has_table('public', 'progression_steps', 'progression_steps exists');
select has_table('public', 'training_weeks', 'training_weeks exists');
select has_table('public', 'training_sessions', 'training_sessions exists');
select has_table('public', 'exercise_prescriptions', 'exercise_prescriptions exists');
select has_table('public', 'conditioning_prescriptions', 'conditioning_prescriptions exists');
select has_table('public', 'warmup_prescriptions', 'warmup_prescriptions exists');
select has_table('public', 'session_feedback', 'session_feedback exists');
select has_table('public', 'exercise_results', 'exercise_results exists');
select has_table('public', 'program_validation_results', 'program_validation_results exists');
select has_table('public', 'programming_engine_flags', 'programming_engine_flags exists');
select has_table('public', 'athlete_movement_restrictions', 'athlete_movement_restrictions exists');

select has_function('public', 'save_programming_engine_v2', array['jsonb', 'integer'], 'atomic V2 save RPC exists');
select has_function('public', 'load_programming_engine_v2', array['uuid'], 'V2 load RPC exists');
select has_function('public', 'load_active_programming_engine_v2', array[]::text[], 'active V2 load RPC exists');
select has_function('public', 'replace_athlete_movement_restrictions', array['jsonb'], 'restriction replacement RPC exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.training_programs'::regclass),
  'training_programs has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.exercise_prescriptions'::regclass),
  'exercise_prescriptions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.programming_engine_flags'::regclass),
  'programming_engine_flags has RLS enabled'
);
select ok(
  has_table_privilege('authenticated', 'public.training_programs', 'select'),
  'authenticated athletes can select their V2 programmes'
);
select ok(
  not has_table_privilege('authenticated', 'public.training_programs', 'insert'),
  'authenticated athletes cannot bypass the atomic V2 save RPC'
);
select ok(
  not has_table_privilege('anon', 'public.training_programs', 'select'),
  'anonymous clients cannot read V2 programmes'
);
select ok(
  has_table_privilege('authenticated', 'public.movements', 'select'),
  'authenticated athletes can read the movement catalog'
);
select cmp_ok((select count(*) from public.movement_families), '>=', 24::bigint, 'movement families are seeded');
select cmp_ok((select count(*) from public.movements), '>=', 35::bigint, 'movements are seeded');

insert into auth.users (id, email)
values
  ('33333333-3333-4333-8333-333333333333', 'v2-one@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'v2-two@example.test');

insert into public.programming_engine_flags (user_id, v2_enabled, rollout_group)
values
  ('33333333-3333-4333-8333-333333333333', true, 'selected_users'),
  ('44444444-4444-4444-8444-444444444444', false, 'disabled');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}';
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select is((select count(*)::integer from public.programming_engine_flags), 1, 'athlete reads only their feature flag');
select is((select v2_enabled from public.programming_engine_flags), true, 'selected athlete sees V2 enabled');
select lives_ok(
  $$select public.replace_athlete_movement_restrictions('[{"movement_id":"box_step_up","movement_family_id":null,"guidance":"Pain-free range"}]'::jsonb)$$,
  'athlete atomically stores an owned movement restriction'
);
select is((select count(*)::integer from public.athlete_movement_restrictions), 1, 'athlete reads the stored restriction');
select throws_ok(
  $$insert into public.athlete_movement_restrictions (user_id, movement_id) values ('44444444-4444-4444-8444-444444444444', 'burpee')$$,
  null,
  null,
  'athlete cannot spoof restriction ownership'
);
select throws_ok(
  $$insert into public.training_programs (id, user_id, schema_version, template_version, catalog_version, validator_version, name, status, validated_snapshot, created_at, updated_at) values ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 2, 'test', 1, 1, 'Bypass', 'active', '{}'::jsonb, now(), now())$$,
  null,
  null,
  'athlete cannot bypass the V2 save RPC'
);
select throws_ok(
  $$select public.save_programming_engine_v2('{"id":"55555555-5555-4555-8555-555555555555","engineVersion":"v2","schemaVersion":2,"validation":{"valid":false,"issues":[{"severity":"error","code":"MISSING_LOAD"}]}}'::jsonb, null)$$,
  null,
  null,
  'invalid V2 payload is rejected before persistence'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';

select throws_ok($$select * from public.training_programs$$, null, null, 'anonymous client cannot select V2 programmes');
select throws_ok(
  $$select public.save_programming_engine_v2('{}'::jsonb, null)$$,
  null,
  null,
  'anonymous client cannot execute the V2 save RPC'
);

reset role;
select * from finish();
rollback;
