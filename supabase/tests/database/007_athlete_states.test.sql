begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

select has_table('public', 'athlete_states', 'athlete_states exists');
select has_column('public', 'athlete_states', 'user_id', 'athlete_states has user_id');
select has_column('public', 'athlete_states', 'schema_version', 'athlete_states has schema_version');
select has_column('public', 'athlete_states', 'state', 'athlete_states has state');
select has_column('public', 'athlete_states', 'updated_at', 'athlete_states has updated_at');
select col_type_is('public', 'athlete_states', 'schema_version', 'integer', 'schema_version is integer');
select col_type_is('public', 'athlete_states', 'state', 'jsonb', 'state is jsonb');
select col_type_is('public', 'athlete_states', 'updated_at', 'timestamp with time zone', 'updated_at is timestamptz');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.athlete_states'::regclass),
  'athlete_states has RLS enabled'
);
select policies_are(
  'public',
  'athlete_states',
  array[
    'Users can read their athlete state',
    'Users can insert their athlete state',
    'Users can update their athlete state'
  ],
  'athlete_states has exactly three owner policies'
);
select ok(
  has_table_privilege('authenticated', 'public.athlete_states', 'select, insert, update'),
  'authenticated can read and save athlete state'
);
select ok(
  not has_table_privilege('authenticated', 'public.athlete_states', 'delete'),
  'authenticated cannot delete athlete state'
);
select ok(not has_table_privilege('anon', 'public.athlete_states', 'select'), 'anon cannot select athlete state');
select ok(not has_table_privilege('anon', 'public.athlete_states', 'insert'), 'anon cannot insert athlete state');
select ok(not has_table_privilege('anon', 'public.athlete_states', 'update'), 'anon cannot update athlete state');
select ok(not has_table_privilege('anon', 'public.athlete_states', 'delete'), 'anon cannot delete athlete state');
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'athlete_states_schema_version_valid'
      and conrelid = 'public.athlete_states'::regclass
      and convalidated
  ),
  'athlete-state schema-version constraint is validated'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'athlete_states_state_valid'
      and conrelid = 'public.athlete_states'::regclass
      and convalidated
  ),
  'athlete-state document constraint is validated'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'athlete_states_state_size_valid'
      and conrelid = 'public.athlete_states'::regclass
      and convalidated
  ),
  'athlete-state size constraint is validated'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conname = 'athlete_states_updated_at_finite'
      and conrelid = 'public.athlete_states'::regclass
      and convalidated
  ),
  'athlete-state timestamp constraint is validated'
);
select has_trigger(
  'public',
  'athlete_states',
  'athlete_states_guard_update',
  'athlete state has its update guard'
);
select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'guard_athlete_state_update'
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ),
  0,
  'athlete-state trigger function has no direct API execution grants'
);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'state-user-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'state-user-two@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'state-user-three@example.test');

insert into public.athlete_states (user_id, state)
values (
  '22222222-2222-4222-8222-222222222222',
  '{"profile":{},"plans":[],"activePlanId":null,"selectedWeek":1,"planSchemaVersion":3}'::jsonb
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.athlete_states), 0, 'user one cannot see another athlete state');
select lives_ok(
  $$insert into public.athlete_states (user_id, state)
    values (
      '11111111-1111-4111-8111-111111111111',
      '{"profile":{},"plans":[],"activePlanId":null,"selectedWeek":1,"planSchemaVersion":3}'::jsonb
    )$$,
  'user one inserts their athlete state'
);
select throws_ok(
  $$insert into public.athlete_states (user_id, state)
    values (
      '33333333-3333-4333-8333-333333333333',
      '{"profile":{},"plans":[],"activePlanId":null,"selectedWeek":1,"planSchemaVersion":3}'::jsonb
    )$$,
  null,
  null,
  'user one cannot spoof athlete-state ownership'
);
select is((select count(*)::integer from public.athlete_states), 1, 'user one sees only their athlete state');
select results_eq(
  $$update public.athlete_states
    set state = jsonb_set(state, '{selectedWeek}', '2'::jsonb)
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning 1$$,
  $$values (1)$$,
  'user one updates their athlete state'
);
select is_empty(
  $$update public.athlete_states
    set state = jsonb_set(state, '{selectedWeek}', '2'::jsonb)
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning 1$$,
  'user one cannot update another athlete state'
);
select throws_ok(
  $$update public.athlete_states
    set user_id = '33333333-3333-4333-8333-333333333333'
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  null,
  null,
  'user one cannot transfer athlete-state ownership'
);
select throws_ok(
  $$delete from public.athlete_states
    where user_id = '11111111-1111-4111-8111-111111111111'$$,
  null,
  null,
  'authenticated users cannot delete athlete state'
);
select ok(
  (
    select updated_at > '-infinity'::timestamptz
    from public.athlete_states
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'server stores a finite update timestamp'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';

select throws_ok($$select * from public.athlete_states$$, null, null, 'anon select is rejected');
select throws_ok(
  $$insert into public.athlete_states (user_id, state)
    values (
      '33333333-3333-4333-8333-333333333333',
      '{"profile":{},"plans":[],"activePlanId":null,"selectedWeek":1,"planSchemaVersion":3}'::jsonb
    )$$,
  null,
  null,
  'anon insert is rejected'
);
select throws_ok($$update public.athlete_states set schema_version = 2$$, null, null, 'anon update is rejected');
select throws_ok($$delete from public.athlete_states$$, null, null, 'anon delete is rejected');

reset role;
select * from finish();
rollback;
