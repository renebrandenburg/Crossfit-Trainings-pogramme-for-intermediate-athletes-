begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'rls-user-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-user-two@example.test');

insert into public.workout_logs (
  id, user_id, date, week, day_id, day_title, readiness
)
values
  ('workout-one', '11111111-1111-4111-8111-111111111111', '2026-07-14', 1, 'day-1', 'Owner one', 'green'),
  ('workout-two', '22222222-2222-4222-8222-222222222222', '2026-07-14', 1, 'day-1', 'Owner two', 'green');

insert into public.pr_attempts (
  id, user_id, metric_id, metric_name, value, display, date
)
values
  ('attempt-one', '11111111-1111-4111-8111-111111111111', 'back_squat', 'Back squat', 100, '100 kg', '2026-07-14'),
  ('attempt-two', '22222222-2222-4222-8222-222222222222', 'snatch', 'Snatch', 70, '70 kg', '2026-07-14');

insert into public.personal_records (
  user_id, metric_id, value, display, date
)
values
  ('11111111-1111-4111-8111-111111111111', 'back_squat', 100, '100 kg', '2026-07-14'),
  ('22222222-2222-4222-8222-222222222222', 'snatch', 70, '70 kg', '2026-07-14');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.workout_logs), 1, 'user one selects only their workout logs');
select lives_ok(
  $$insert into public.workout_logs (id, user_id, date, week, day_id, day_title, readiness)
    values ('workout-own-insert', '11111111-1111-4111-8111-111111111111', '2026-07-15', 2, 'day-2', 'Own insert', 'amber')$$,
  'user one inserts their workout log'
);
select throws_ok(
  $$insert into public.workout_logs (id, user_id, date, week, day_id, day_title, readiness)
    values ('workout-spoof', '22222222-2222-4222-8222-222222222222', '2026-07-15', 2, 'day-2', 'Spoof', 'amber')$$,
  null,
  null,
  'user one cannot spoof workout ownership on insert'
);
select results_eq(
  $$update public.workout_logs set notes = 'mine' where id = 'workout-one' returning 1$$,
  $$values (1)$$,
  'user one updates their workout log'
);
select is_empty(
  $$update public.workout_logs set notes = 'stolen' where id = 'workout-two' returning 1$$,
  'user one cannot update another workout log'
);
select throws_ok(
  $$update public.workout_logs set user_id = '22222222-2222-4222-8222-222222222222' where id = 'workout-one'$$,
  null,
  null,
  'user one cannot transfer workout ownership'
);
select is_empty(
  $$delete from public.workout_logs where id = 'workout-two' returning 1$$,
  'user one cannot delete another workout log'
);
select results_eq(
  $$delete from public.workout_logs where id = 'workout-own-insert' returning 1$$,
  $$values (1)$$,
  'user one deletes their workout log'
);

select is((select count(*)::integer from public.pr_attempts), 1, 'user one selects only their PR attempts');
select lives_ok(
  $$insert into public.pr_attempts (id, user_id, metric_id, metric_name, value, display, date)
    values ('attempt-own-insert', '11111111-1111-4111-8111-111111111111', 'deadlift', 'Deadlift', 150, '150 kg', '2026-07-15')$$,
  'user one inserts their PR attempt'
);
select throws_ok(
  $$insert into public.pr_attempts (id, user_id, metric_id, metric_name, value, display, date)
    values ('attempt-spoof', '22222222-2222-4222-8222-222222222222', 'deadlift', 'Deadlift', 150, '150 kg', '2026-07-15')$$,
  null,
  null,
  'user one cannot spoof PR-attempt ownership on insert'
);
select results_eq(
  $$update public.pr_attempts set notes = 'mine' where id = 'attempt-one' returning 1$$,
  $$values (1)$$,
  'user one updates their PR attempt'
);
select is_empty(
  $$update public.pr_attempts set notes = 'stolen' where id = 'attempt-two' returning 1$$,
  'user one cannot update another PR attempt'
);
select throws_ok(
  $$update public.pr_attempts set user_id = '22222222-2222-4222-8222-222222222222' where id = 'attempt-one'$$,
  null,
  null,
  'user one cannot transfer PR-attempt ownership'
);
select is_empty(
  $$delete from public.pr_attempts where id = 'attempt-two' returning 1$$,
  'user one cannot delete another PR attempt'
);
select results_eq(
  $$delete from public.pr_attempts where id = 'attempt-own-insert' returning 1$$,
  $$values (1)$$,
  'user one deletes their PR attempt'
);

select is((select count(*)::integer from public.personal_records), 1, 'user one selects only their personal records');
select lives_ok(
  $$insert into public.personal_records (user_id, metric_id, value, display, date)
    values ('11111111-1111-4111-8111-111111111111', 'deadlift', 150, '150 kg', '2026-07-15')$$,
  'user one inserts their personal record'
);
select throws_ok(
  $$insert into public.personal_records (user_id, metric_id, value, display, date)
    values ('22222222-2222-4222-8222-222222222222', 'deadlift', 150, '150 kg', '2026-07-15')$$,
  null,
  null,
  'user one cannot spoof personal-record ownership on insert'
);
select results_eq(
  $$update public.personal_records set notes = 'mine' where metric_id = 'back_squat' returning 1$$,
  $$values (1)$$,
  'user one updates their personal record'
);
select is_empty(
  $$update public.personal_records set notes = 'stolen' where metric_id = 'snatch' returning 1$$,
  'user one cannot update another personal record'
);
select throws_ok(
  $$update public.personal_records set user_id = '22222222-2222-4222-8222-222222222222' where metric_id = 'back_squat'$$,
  null,
  null,
  'user one cannot transfer personal-record ownership'
);
select is_empty(
  $$delete from public.personal_records where metric_id = 'snatch' returning 1$$,
  'user one cannot delete another personal record'
);
select results_eq(
  $$delete from public.personal_records where metric_id = 'deadlift' returning 1$$,
  $$values (1)$$,
  'user one deletes their personal record'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';

select throws_ok($$select * from public.workout_logs$$, null, null, 'anon cannot select workout_logs');
select throws_ok(
  $$insert into public.workout_logs (id, user_id, date, week, day_id, day_title, readiness)
    values ('anon-workout', '11111111-1111-4111-8111-111111111111', '2026-07-15', 2, 'day-2', 'Anon', 'green')$$,
  null,
  null,
  'anon cannot insert workout_logs'
);
select throws_ok($$update public.workout_logs set notes = 'anon'$$, null, null, 'anon cannot update workout_logs');
select throws_ok($$delete from public.workout_logs$$, null, null, 'anon cannot delete workout_logs');
select throws_ok($$select * from public.pr_attempts$$, null, null, 'anon cannot select pr_attempts');
select throws_ok(
  $$insert into public.pr_attempts (id, user_id, metric_id, metric_name, value, display, date)
    values ('anon-attempt', '11111111-1111-4111-8111-111111111111', 'deadlift', 'Deadlift', 150, '150 kg', '2026-07-15')$$,
  null,
  null,
  'anon cannot insert pr_attempts'
);
select throws_ok($$update public.pr_attempts set notes = 'anon'$$, null, null, 'anon cannot update pr_attempts');
select throws_ok($$delete from public.pr_attempts$$, null, null, 'anon cannot delete pr_attempts');
select throws_ok($$select * from public.personal_records$$, null, null, 'anon cannot select personal_records');
select throws_ok(
  $$insert into public.personal_records (user_id, metric_id, value, display, date)
    values ('11111111-1111-4111-8111-111111111111', 'deadlift', 150, '150 kg', '2026-07-15')$$,
  null,
  null,
  'anon cannot insert personal_records'
);
select throws_ok($$update public.personal_records set notes = 'anon'$$, null, null, 'anon cannot update personal_records');
select throws_ok($$delete from public.personal_records$$, null, null, 'anon cannot delete personal_records');

reset role;
select * from finish();
rollback;
