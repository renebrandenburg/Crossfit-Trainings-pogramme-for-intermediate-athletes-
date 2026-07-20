begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'trigger-user-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'trigger-user-two@example.test');

insert into public.personal_records (
  user_id, metric_id, value, display, date, updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'deadlift',
    100,
    '100 kg',
    '2026-07-14',
    '2026-07-14T08:00:00Z'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'run5k',
    1500,
    '25:00',
    '2026-07-14',
    '2026-07-14T08:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'deadlift',
    200,
    '200 kg',
    '2026-07-14',
    '2026-07-14T08:00:00Z'
  );

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select lives_ok(
  $$update public.personal_records
    set value = 120, display = '120 kg', updated_at = '2026-07-14T10:00:00Z'
    where metric_id = 'deadlift'$$,
  'direct clients can advance a higher-is-better record'
);
select is(
  (select value from public.personal_records where metric_id = 'deadlift'),
  120::numeric,
  'the direct higher-is-better improvement is canonical'
);
select lives_ok(
  $$update public.personal_records
    set value = 110, display = '110 kg', updated_at = '2026-07-14T12:00:00Z'
    where metric_id = 'deadlift'$$,
  'a direct stale higher-is-better downgrade becomes a no-op'
);
select is(
  (select value from public.personal_records where metric_id = 'deadlift'),
  120::numeric,
  'the trigger blocks a direct higher-is-better downgrade'
);

select lives_ok(
  $$update public.personal_records
    set value = 1400, display = '23:20', updated_at = '2026-07-14T10:00:00Z'
    where metric_id = 'run5k'$$,
  'direct clients can advance a lower-is-better record'
);
select is(
  (select value from public.personal_records where metric_id = 'run5k'),
  1400::numeric,
  'the direct lower-is-better improvement is canonical'
);
select lives_ok(
  $$update public.personal_records
    set value = 1450, display = '24:10', updated_at = '2026-07-14T12:00:00Z'
    where metric_id = 'run5k'$$,
  'a direct stale lower-is-better downgrade becomes a no-op'
);
select is(
  (select value from public.personal_records where metric_id = 'run5k'),
  1400::numeric,
  'the trigger blocks a direct lower-is-better downgrade'
);
select lives_ok(
  $$update public.personal_records
    set value = 0, display = 'Not tested', updated_at = '2026-07-14T14:00:00Z'
    where metric_id = 'run5k'$$,
  'a direct zero baseline after a tested lower result becomes a no-op'
);
select is(
  (select value from public.personal_records where metric_id = 'run5k'),
  1400::numeric,
  'the trigger prevents zero from erasing a tested lower-is-better result'
);
select lives_ok(
  $$update public.personal_records
    set value = 0, display = 'Not tested', updated_at = '2026-07-14T14:00:00Z'
    where metric_id = 'deadlift'$$,
  'a direct zero baseline after a tested higher result becomes a no-op'
);
select is(
  (select value from public.personal_records where metric_id = 'deadlift'),
  120::numeric,
  'the trigger prevents zero from erasing a tested higher-is-better result'
);
select throws_ok(
  $$update public.personal_records
    set updated_at = 'infinity'::timestamptz
    where metric_id = 'deadlift'$$,
  null,
  null,
  'the trigger rejects an infinite direct update timestamp'
);

select throws_ok(
  $$update public.personal_records
    set metric_id = 'renamed_metric'
    where metric_id = 'deadlift'$$,
  null,
  null,
  'the trigger rejects metric identity changes'
);
select throws_ok(
  $$update public.personal_records
    set user_id = '22222222-2222-4222-8222-222222222222'
    where metric_id = 'deadlift'$$,
  null,
  null,
  'the trigger rejects ownership changes'
);
select is_empty(
  $$update public.personal_records
    set value = 999
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning 1$$,
  'RLS still hides another user record before the trigger can run'
);

reset role;
select * from finish();
rollback;
