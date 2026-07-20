begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'rpc-user-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rpc-user-two@example.test');

insert into public.pr_attempts (
  id, user_id, metric_id, metric_name, value, display, date
)
values (
  'other-users-attempt',
  '22222222-2222-4222-8222-222222222222',
  'snatch',
  'Snatch',
  70,
  '70 kg',
  '2026-07-14'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-non-pr","user_id":"22222222-2222-4222-8222-222222222222","metric_id":"deadlift","metric_name":"Deadlift","value":150,"display":"150 kg","date":"2026-07-14","is_pr":false}'::jsonb,
    null
  )$$,
  'an authenticated user atomically saves a non-PR attempt'
);
select is(
  (select user_id from public.pr_attempts where id = 'rpc-non-pr'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the RPC ignores a spoofed attempt user_id'
);

select lives_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-pr","metric_id":"back_squat","metric_name":"Back squat","value":120,"display":"120 kg","date":"2026-07-14","is_pr":true}'::jsonb,
    '{"user_id":"22222222-2222-4222-8222-222222222222","metric_id":"back_squat","value":120,"display":"120 kg","date":"2026-07-14"}'::jsonb
  )$$,
  'an authenticated user atomically saves a PR attempt and current record'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-pr'),
  1,
  'the atomic RPC writes the PR attempt'
);
select is(
  (select user_id from public.personal_records where metric_id = 'back_squat'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the RPC derives personal-record ownership from auth.uid'
);

select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-rollback","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":true}'::jsonb,
    '{"metric_id":"snatch","value":100,"display":"100 kg","date":"2026-07-14"}'::jsonb
  )$$,
  null,
  null,
  'mismatched PR payloads are rejected'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-rollback'),
  0,
  'a failed current-record write rolls back its attempt'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-value-mismatch","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":true}'::jsonb,
    '{"metric_id":"clean","value":99,"display":"99 kg","date":"2026-07-14"}'::jsonb
  )$$,
  null,
  null,
  'a supplied current record must value-match its PR attempt'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-value-mismatch'),
  0,
  'a value-mismatched current record rolls back its attempt'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"other-users-attempt","metric_id":"snatch","metric_name":"Snatch","value":75,"display":"75 kg","date":"2026-07-14","is_pr":false}'::jsonb,
    null
  )$$,
  null,
  null,
  'the atomic RPC cannot overwrite another user attempt by ID'
);
select is(
  public.save_pr_attempt(
    '{"id":"rpc-missing-record","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":true}'::jsonb,
    null
  ),
  null::jsonb,
  'a history-only PR attempt returns null when no current record exists'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-missing-record'),
  1,
  'the history-only PR attempt is persisted'
);
select is(
  (select count(*)::integer from public.personal_records where metric_id = 'clean'),
  0,
  'the history-only PR attempt does not invent a current record'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-extra-record","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":false}'::jsonb,
    '{"metric_id":"clean","value":100,"display":"100 kg","date":"2026-07-14"}'::jsonb
  )$$,
  null,
  null,
  'a non-PR attempt rejects a current-record payload'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-invalid-value","metric_id":"clean","metric_name":"Clean","value":0,"display":"0 kg","date":"2026-07-14","is_pr":false}'::jsonb,
    null
  )$$,
  null,
  null,
  'the atomic RPC rejects a non-positive value'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-invalid-value'),
  0,
  'an invalid attempt is not persisted'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-nan-value","metric_id":"clean","metric_name":"Clean","value":"NaN","display":"NaN kg","date":"2026-07-14","is_pr":false}'::jsonb,
    null
  )$$,
  null,
  null,
  'the atomic RPC rejects a NaN value'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-nan-value'),
  0,
  'a NaN attempt is not persisted'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-infinite-value","metric_id":"clean","metric_name":"Clean","value":"Infinity","display":"Infinity kg","date":"2026-07-14","is_pr":false}'::jsonb,
    null
  )$$,
  null,
  null,
  'the atomic RPC rejects an infinite value'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-infinite-value'),
  0,
  'an infinite attempt is not persisted'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-infinite-created-at","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":false,"created_at":"infinity"}'::jsonb,
    null
  )$$,
  null,
  null,
  'the atomic RPC rejects an infinite attempt timestamp'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-infinite-created-at'),
  0,
  'an attempt with an infinite timestamp is not persisted'
);
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-infinite-updated-at","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":true,"created_at":"2026-07-14T12:00:00Z"}'::jsonb,
    '{"metric_id":"clean","value":100,"display":"100 kg","date":"2026-07-14","updated_at":"infinity"}'::jsonb
  )$$,
  null,
  null,
  'the atomic RPC rejects an infinite current-record timestamp'
);
select is(
  (select count(*)::integer from public.pr_attempts where id = 'rpc-infinite-updated-at'),
  0,
  'an infinite current-record timestamp rolls back its attempt'
);

select lives_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-higher-best","metric_id":"strictPress","metric_name":"Strict press","value":120,"display":"120 kg","date":"2026-07-14","is_pr":true,"created_at":"2026-07-14T12:00:00Z"}'::jsonb,
    '{"metric_id":"strictPress","value":120,"display":"120 kg","date":"2026-07-14","updated_at":"2026-07-14T12:00:00Z"}'::jsonb
  )$$,
  'a higher-is-better current record is saved'
);
select is(
  (
    public.save_pr_attempt(
      '{"id":"rpc-higher-stale","metric_id":"strictPress","metric_name":"Strict press","value":110,"display":"110 kg","date":"2026-07-13","is_pr":true,"created_at":"2026-07-14T10:00:00Z"}'::jsonb,
      '{"metric_id":"strictPress","value":110,"display":"110 kg","date":"2026-07-13","updated_at":"2026-07-14T10:00:00Z"}'::jsonb
    ) ->> 'value'
  )::numeric,
  120::numeric,
  'a stale 110 write returns the canonical 120 higher-is-better record'
);
select is(
  (select value from public.personal_records where metric_id = 'strictPress'),
  120::numeric,
  'a stale higher-is-better write cannot downgrade the current record'
);

select lives_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-lower-best","metric_id":"row2k","metric_name":"2 km row","value":360,"display":"6:00","date":"2026-07-14","is_pr":true,"created_at":"2026-07-14T12:00:00Z"}'::jsonb,
    '{"metric_id":"row2k","value":360,"display":"6:00","date":"2026-07-14","updated_at":"2026-07-14T12:00:00Z"}'::jsonb
  )$$,
  'a lower-is-better current record is saved'
);
select is(
  (
    public.save_pr_attempt(
      '{"id":"rpc-lower-stale","metric_id":"row2k","metric_name":"2 km row","value":400,"display":"6:40","date":"2026-07-13","is_pr":true,"created_at":"2026-07-14T10:00:00Z"}'::jsonb,
      '{"metric_id":"row2k","value":400,"display":"6:40","date":"2026-07-13","updated_at":"2026-07-14T10:00:00Z"}'::jsonb
    ) ->> 'value'
  )::numeric,
  360::numeric,
  'a stale lower-is-better write returns the canonical record'
);
select is(
  (select value from public.personal_records where metric_id = 'row2k'),
  360::numeric,
  'a stale lower-is-better write cannot downgrade the current record'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';
select throws_ok(
  $$select public.save_pr_attempt(
    '{"id":"rpc-anon","metric_id":"clean","metric_name":"Clean","value":100,"display":"100 kg","date":"2026-07-14","is_pr":false}'::jsonb,
    null
  )$$,
  null,
  null,
  'anon cannot execute the atomic PR RPC'
);

reset role;
select * from finish();
rollback;
