begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'record-user-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'record-user-two@example.test');

insert into public.personal_records (
  user_id, metric_id, value, display, date, updated_at
)
values (
  '22222222-2222-4222-8222-222222222222',
  'shared_metric',
  999,
  '999 kg',
  '2026-07-14',
  '2026-07-14T08:00:00Z'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select public.save_personal_record(
    '{"user_id":"22222222-2222-4222-8222-222222222222","metric_id":"backSquat","value":0,"display":"Not tested","date":"Baseline","updated_at":"2026-07-14T08:00:00Z"}'::jsonb
  )$$,
  'an authenticated user saves an untested baseline'
);
select is(
  (select user_id from public.personal_records where metric_id = 'backSquat'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'standalone persistence ignores a spoofed user_id'
);
select is(
  (select value from public.personal_records where metric_id = 'backSquat'),
  0::numeric,
  'zero remains the untested baseline sentinel'
);
select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"backSquat","value":100,"display":"100 kg","date":"2026-07-14","updated_at":"2026-07-14T10:00:00Z"}'::jsonb
  )$$,
  'a positive result replaces an untested higher-is-better baseline'
);
select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"backSquat","value":90,"display":"90 kg","date":"2026-07-15","updated_at":"2026-07-14T12:00:00Z"}'::jsonb
  )$$,
  'a newer but worse higher-is-better value is accepted as a no-op'
);
select is(
  (select value from public.personal_records where metric_id = 'backSquat'),
  100::numeric,
  'standalone persistence cannot downgrade a higher-is-better record'
);

select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"row1k","value":0,"display":"Not tested","date":"Baseline","updated_at":"2026-07-14T08:00:00Z"}'::jsonb
  )$$,
  'an untested lower-is-better baseline is saved'
);
select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"row1k","value":240,"display":"4:00","date":"2026-07-14","updated_at":"2026-07-14T10:00:00Z"}'::jsonb
  )$$,
  'a positive result replaces an untested lower-is-better baseline'
);
select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"row1k","value":260,"display":"4:20","date":"2026-07-15","updated_at":"2026-07-14T12:00:00Z"}'::jsonb
  )$$,
  'a newer but worse lower-is-better value is accepted as a no-op'
);
select is(
  (select value from public.personal_records where metric_id = 'row1k'),
  240::numeric,
  'standalone persistence cannot downgrade a lower-is-better record'
);
select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"row1k","value":220,"display":"3:40","date":"2026-07-13","updated_at":"2026-07-14T09:00:00Z"}'::jsonb
  )$$,
  'a better lower-is-better value wins even when its request is stale'
);
select is(
  (select value from public.personal_records where metric_id = 'row1k'),
  220::numeric,
  'best value, not request completion order, remains canonical'
);
select lives_ok(
  $$select public.save_personal_record(
    '{"metric_id":"row1k","value":0,"display":"Not tested","date":"Baseline","updated_at":"2026-07-14T14:00:00Z"}'::jsonb
  )$$,
  'a stale zero baseline is accepted as a no-op after a tested result'
);
select is(
  (select value from public.personal_records where metric_id = 'row1k'),
  220::numeric,
  'a stale zero baseline cannot erase a tested lower-is-better record'
);

select lives_ok(
  $$select public.save_personal_record(
    '{"user_id":"22222222-2222-4222-8222-222222222222","metric_id":"shared_metric","value":100,"display":"100 kg","date":"2026-07-14"}'::jsonb
  )$$,
  'the same metric name creates an owner-scoped record'
);
select throws_ok(
  $$select public.save_personal_record(
    '{"metric_id":"negative_metric","value":-1,"display":"-1 kg","date":"2026-07-14"}'::jsonb
  )$$,
  null,
  null,
  'standalone persistence rejects negative values'
);
select throws_ok(
  $$select public.save_personal_record(
    '{"metric_id":"infinite_metric","value":"Infinity","display":"Infinity kg","date":"2026-07-14"}'::jsonb
  )$$,
  null,
  null,
  'standalone persistence rejects infinite values'
);
select throws_ok(
  $$select public.save_personal_record(
    '{"metric_id":"infinite_time_metric","value":1,"display":"1 kg","date":"2026-07-14","updated_at":"infinity"}'::jsonb
  )$$,
  null,
  null,
  'standalone persistence rejects infinite update timestamps'
);

reset role;
select is(
  (
    select value
    from public.personal_records
    where user_id = '22222222-2222-4222-8222-222222222222'
      and metric_id = 'shared_metric'
  ),
  999::numeric,
  'standalone persistence cannot overwrite another user record'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select throws_ok(
  $$select public.save_personal_record(
    '{"metric_id":"anon_metric","value":1,"display":"1 kg","date":"2026-07-14"}'::jsonb
  )$$,
  null,
  null,
  'anon cannot execute standalone personal-record persistence'
);

reset role;
select * from finish();
rollback;
