begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(70);

select has_table('public', 'workout_logs', 'workout_logs exists');
select has_table('public', 'pr_attempts', 'pr_attempts exists');
select has_table('public', 'personal_records', 'personal_records exists');

select has_column(
  'public',
  'workout_logs',
  'timer_result',
  'workout_logs has timer_result'
);
select has_column(
  'public',
  'workout_logs',
  'competition_proof',
  'workout_logs has competition_proof'
);
select col_type_is(
  'public',
  'workout_logs',
  'timer_result',
  'jsonb',
  'timer_result is jsonb'
);
select col_type_is(
  'public',
  'workout_logs',
  'competition_proof',
  'jsonb',
  'competition_proof is jsonb'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.workout_logs'::regclass),
  'workout_logs has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.pr_attempts'::regclass),
  'pr_attempts has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.personal_records'::regclass),
  'personal_records has RLS enabled'
);

select policies_are(
  'public',
  'workout_logs',
  array[
    'Users can read their workout logs',
    'Users can insert their workout logs',
    'Users can update their workout logs',
    'Users can delete their workout logs'
  ],
  'workout_logs has exactly four operation-specific policies'
);
select policies_are(
  'public',
  'pr_attempts',
  array[
    'Users can read their PR attempts',
    'Users can insert their PR attempts',
    'Users can update their PR attempts',
    'Users can delete their PR attempts'
  ],
  'pr_attempts has exactly four operation-specific policies'
);
select policies_are(
  'public',
  'personal_records',
  array[
    'Users can read their personal records',
    'Users can insert their personal records',
    'Users can update their personal records',
    'Users can delete their personal records'
  ],
  'personal_records has exactly four operation-specific policies'
);

select ok(
  has_table_privilege(
    'authenticated',
    'public.workout_logs',
    'select, insert, update, delete'
  ),
  'authenticated has required workout_logs privileges'
);
select ok(
  has_table_privilege(
    'authenticated',
    'public.pr_attempts',
    'select, insert, update, delete'
  ),
  'authenticated has required pr_attempts privileges'
);
select ok(
  has_table_privilege(
    'authenticated',
    'public.personal_records',
    'select, insert, update, delete'
  ),
  'authenticated has required personal_records privileges'
);
select is(
  (
    select string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'workout_logs'
      and grantee = 'authenticated'
  ),
  'DELETE,INSERT,SELECT,UPDATE',
  'authenticated has only required workout_logs privileges'
);
select is(
  (
    select string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'pr_attempts'
      and grantee = 'authenticated'
  ),
  'DELETE,INSERT,SELECT,UPDATE',
  'authenticated has only required pr_attempts privileges'
);
select is(
  (
    select string_agg(privilege_type, ',' order by privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'personal_records'
      and grantee = 'authenticated'
  ),
  'DELETE,INSERT,SELECT,UPDATE',
  'authenticated has only required personal_records privileges'
);

select ok(not has_table_privilege('anon', 'public.workout_logs', 'select'), 'anon cannot select workout_logs');
select ok(not has_table_privilege('anon', 'public.workout_logs', 'insert'), 'anon cannot insert workout_logs');
select ok(not has_table_privilege('anon', 'public.workout_logs', 'update'), 'anon cannot update workout_logs');
select ok(not has_table_privilege('anon', 'public.workout_logs', 'delete'), 'anon cannot delete workout_logs');
select ok(not has_table_privilege('anon', 'public.pr_attempts', 'select'), 'anon cannot select pr_attempts');
select ok(not has_table_privilege('anon', 'public.pr_attempts', 'insert'), 'anon cannot insert pr_attempts');
select ok(not has_table_privilege('anon', 'public.pr_attempts', 'update'), 'anon cannot update pr_attempts');
select ok(not has_table_privilege('anon', 'public.pr_attempts', 'delete'), 'anon cannot delete pr_attempts');
select ok(not has_table_privilege('anon', 'public.personal_records', 'select'), 'anon cannot select personal_records');
select ok(not has_table_privilege('anon', 'public.personal_records', 'insert'), 'anon cannot insert personal_records');
select ok(not has_table_privilege('anon', 'public.personal_records', 'update'), 'anon cannot update personal_records');
select ok(not has_table_privilege('anon', 'public.personal_records', 'delete'), 'anon cannot delete personal_records');

select has_index(
  'public',
  'workout_logs',
  'workout_logs_user_created_id_idx',
  'workout_logs has its owner and recency index'
);
select has_index(
  'public',
  'pr_attempts',
  'pr_attempts_user_created_id_idx',
  'pr_attempts has its owner and recency index'
);
select matches(
  pg_get_indexdef('public.workout_logs_user_created_id_idx'::regclass),
  'created_at DESC, id DESC',
  'workout_logs pagination index has deterministic descending order'
);
select matches(
  pg_get_indexdef('public.pr_attempts_user_created_id_idx'::regclass),
  'created_at DESC, id DESC',
  'pr_attempts pagination index has deterministic descending order'
);

select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'workout_logs_required_text_nonempty'
      and conrelid = 'public.workout_logs'::regclass
      and convalidated
  ),
  'workout_logs required-text constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'workout_logs_timer_result_object'
      and conrelid = 'public.workout_logs'::regclass
      and convalidated
  ),
  'workout_logs timer-result shape constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'workout_logs_competition_proof_object'
      and conrelid = 'public.workout_logs'::regclass
      and convalidated
  ),
  'workout_logs competition-proof shape constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'pr_attempts_required_text_nonempty'
      and conrelid = 'public.pr_attempts'::regclass
      and convalidated
  ),
  'pr_attempts required-text constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'pr_attempts_value_positive'
      and conrelid = 'public.pr_attempts'::regclass
      and convalidated
  ),
  'pr_attempts positive-value constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'personal_records_required_text_nonempty'
      and conrelid = 'public.personal_records'::regclass
      and convalidated
  ),
  'personal_records required-text constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'personal_records_value_nonnegative'
      and conrelid = 'public.personal_records'::regclass
      and convalidated
  ),
  'personal_records nonnegative-value constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'workout_logs_created_at_finite'
      and conrelid = 'public.workout_logs'::regclass
      and convalidated
  ),
  'workout_logs creation timestamp constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'pr_attempts_created_at_finite'
      and conrelid = 'public.pr_attempts'::regclass
      and convalidated
  ),
  'pr_attempts creation timestamp constraint is validated'
);
select ok(
  exists(
    select 1
    from pg_constraint
    where conname = 'personal_records_updated_at_finite'
      and conrelid = 'public.personal_records'::regclass
      and convalidated
  ),
  'personal_records update timestamp constraint is validated'
);
select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'pr_attempts_value_positive'
      and conrelid = 'public.pr_attempts'::regclass
  ),
  'value >.*Infinity',
  'pr_attempts requires positive finite values'
);
select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conname = 'personal_records_value_nonnegative'
      and conrelid = 'public.personal_records'::regclass
  ),
  'value >=.*Infinity',
  'personal_records allows zero and rejects negative or non-finite values'
);

select has_function(
  'public',
  'save_pr_attempt',
  array['jsonb', 'jsonb'],
  'atomic PR persistence function exists'
);
select function_returns(
  'public',
  'save_pr_attempt',
  array['jsonb', 'jsonb'],
  'jsonb',
  'atomic PR persistence returns the canonical personal record'
);
select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = 'public.save_pr_attempt(jsonb,jsonb)'::regprocedure
  ),
  'atomic PR persistence function is security invoker'
);
select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = 'public.save_pr_attempt(jsonb,jsonb)'::regprocedure
  ),
  'search_path=""',
  'atomic PR persistence has an empty search path'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_pr_attempt(jsonb,jsonb)',
    'execute'
  ),
  'authenticated can execute atomic PR persistence'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_pr_attempt(jsonb,jsonb)',
    'execute'
  ),
  'anon cannot execute atomic PR persistence'
);
select is(
  (
    select string_agg(
      coalesce(grantee.rolname, 'PUBLIC'),
      ',' order by coalesce(grantee.rolname, 'PUBLIC')
    )
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where p.oid = 'public.save_pr_attempt(jsonb,jsonb)'::regprocedure
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee <> p.proowner
  ),
  'authenticated',
  'only authenticated receives non-owner execute access to atomic PR persistence'
);

select has_function(
  'public',
  'save_personal_record',
  array['jsonb'],
  'ownership-safe personal-record persistence function exists'
);
select function_returns(
  'public',
  'save_personal_record',
  array['jsonb'],
  'void',
  'personal-record persistence function returns void'
);
select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = 'public.save_personal_record(jsonb)'::regprocedure
  ),
  'personal-record persistence function is security invoker'
);
select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = 'public.save_personal_record(jsonb)'::regprocedure
  ),
  'search_path=""',
  'personal-record persistence has an empty search path'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_personal_record(jsonb)',
    'execute'
  ),
  'authenticated can execute personal-record persistence'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_personal_record(jsonb)',
    'execute'
  ),
  'anon cannot execute personal-record persistence'
);
select is(
  (
    select string_agg(
      coalesce(grantee.rolname, 'PUBLIC'),
      ',' order by coalesce(grantee.rolname, 'PUBLIC')
    )
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where p.oid = 'public.save_personal_record(jsonb)'::regprocedure
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee <> p.proowner
  ),
  'authenticated',
  'only authenticated receives non-owner execute access to personal-record persistence'
);

select has_trigger(
  'public',
  'personal_records',
  'personal_records_monotonic_update',
  'personal_records has its monotonic update trigger'
);
select has_function(
  'public',
  'guard_personal_record_update',
  array[]::text[],
  'personal-record monotonic trigger function exists'
);
select function_returns(
  'public',
  'guard_personal_record_update',
  array[]::text[],
  'trigger',
  'personal-record monotonic function returns trigger'
);
select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = 'public.guard_personal_record_update()'::regprocedure
  ),
  'personal-record monotonic trigger is security invoker'
);
select is(
  (
    select array_to_string(proconfig, ',')
    from pg_proc
    where oid = 'public.guard_personal_record_update()'::regprocedure
  ),
  'search_path=""',
  'personal-record monotonic trigger has an empty search path'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.guard_personal_record_update()',
    'execute'
  ),
  'authenticated cannot call the trigger function directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.guard_personal_record_update()',
    'execute'
  ),
  'anon cannot call the trigger function directly'
);
select is(
  (
    select string_agg(
      coalesce(grantee.rolname, 'PUBLIC'),
      ',' order by coalesce(grantee.rolname, 'PUBLIC')
    )
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) acl
    left join pg_roles grantee on grantee.oid = acl.grantee
    where p.oid = 'public.guard_personal_record_update()'::regprocedure
      and acl.privilege_type = 'EXECUTE'
      and acl.grantee <> p.proowner
  ),
  null::text,
  'the trigger function grants no non-owner execute access'
);
select is(
  (
    select tgfoid
    from pg_trigger
    where tgrelid = 'public.personal_records'::regclass
      and tgname = 'personal_records_monotonic_update'
      and not tgisinternal
  ),
  'public.guard_personal_record_update()'::regprocedure::oid,
  'the monotonic trigger invokes the guarded function'
);

select * from finish();
rollback;
