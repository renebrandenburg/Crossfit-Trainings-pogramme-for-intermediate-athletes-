begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_function(
  'public',
  'save_programming_engine_v2_profile',
  array['jsonb', 'integer'],
  'profile-aware V2 save RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_programming_engine_v2_profile(jsonb,integer)',
    'execute'
  ),
  'authenticated athletes can execute the profile save RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_programming_engine_v2_profile(jsonb,integer)',
    'execute'
  ),
  'anonymous clients cannot execute the profile save RPC'
);

insert into auth.users (id, email)
values ('77777777-7777-4777-8777-777777777777', 'profile-v2@example.test');

create temporary table profile_program_fixture (payload jsonb not null);
insert into profile_program_fixture (payload)
select jsonb_build_object(
  'id', '88888888-8888-4888-8888-888888888888',
  'ownerId', '77777777-7777-4777-8777-777777777777',
  'engineVersion', 'v2',
  'schemaVersion', 2,
  'templateVersion', '2.0.0',
  'catalogVersion', 1,
  'validatorVersion', 1,
  'generatorVersion', '2.0.0',
  'name', 'General CrossFit with gymnastics capacity',
  'status', 'active',
  'activeTrainingBlockId', '99999999-9999-4999-8999-999999999999',
  'createdAt', '2026-08-10T08:00:00.000Z',
  'updatedAt', '2026-08-10T08:00:00.000Z',
  'validation', jsonb_build_object('valid', true, 'issues', '[]'::jsonb),
  'programmeProfile', jsonb_build_object(
    'primaryGoal', 'general_crossfit',
    'trainingBlock', 'gymnastics_capacity'
  ),
  'generationSummary', jsonb_build_object(
    'identityValidation', jsonb_build_object('valid', true, 'problems', '[]'::jsonb)
  ),
  'generationRequest', jsonb_build_object(
    'programmeType', 'mixed_strength_6w',
    'programmeVersion', '2.0.0',
    'trainingBlock', 'gymnastics_capacity',
    'athleteGoals', jsonb_build_array('general_crossfit'),
    'cycleLengthWeeks', 6,
    'sessionsPerWeek', 2
  ),
  'trainingBlocks', jsonb_build_array(jsonb_build_object(
    'id', '99999999-9999-4999-8999-999999999999',
    'templateId', 'mixed_strength_6w',
    'blockType', 'gymnastics_capacity',
    'durationWeeks', 6,
    'plannedSessionCount', 2,
    'trainingWeeks', (
      select jsonb_agg(jsonb_build_object(
        'weekNumber', week_number,
        'sessions', jsonb_build_array(
          jsonb_build_object('sessionNumber', 1),
          jsonb_build_object('sessionNumber', 2)
        )
      ) order by week_number)
      from generate_series(1, 6) week_number
    )
  ))
);
grant select on profile_program_fixture to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"77777777-7777-4777-8777-777777777777"}';
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';

select throws_ok(
  $$select public.save_programming_engine_v2_profile(jsonb_set((select payload from profile_program_fixture), '{validation,valid}', 'false'::jsonb), null)$$,
  null,
  null,
  'REG-003 invalid profile programmes are rejected before persistence'
);
select throws_ok(
  $$select public.save_programming_engine_v2_profile(jsonb_set((select payload from profile_program_fixture), '{trainingBlocks,0,blockType}', '"olympic_lifting_development"'::jsonb), null)$$,
  null,
  null,
  'REG-004 profile and block identity mismatches are rejected'
);
select throws_ok(
  $$select public.save_programming_engine_v2_profile(jsonb_set((select payload from profile_program_fixture), '{generationRequest,programmeVersion}', '"stale-template"'::jsonb), null)$$,
  null,
  null,
  'REG-004 stale generator/template versions are rejected'
);
select lives_ok(
  $$select public.save_programming_engine_v2_profile((select payload from profile_program_fixture), null)$$,
  'a consistent profile programme is saved atomically'
);
select is(
  (select count(*)::integer from public.training_programs),
  1,
  'one owned profile programme is persisted'
);
select is(
  (
    select validated_snapshot #>> '{programmeProfile,trainingBlock}'
    from public.training_programs
  ),
  'gymnastics_capacity',
  'the selected training block survives persistence'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select throws_ok(
  $$select public.save_programming_engine_v2_profile((select payload from profile_program_fixture), null)$$,
  null,
  null,
  'anonymous clients cannot call the profile save RPC'
);

reset role;
select * from finish();
rollback;
