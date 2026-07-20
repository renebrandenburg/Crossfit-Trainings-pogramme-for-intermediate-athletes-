begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, email)
values ('11111111-1111-4111-8111-111111111111', 'constraint-user@example.test');

select lives_ok(
  $$insert into public.workout_logs (
      id, user_id, date, week, day_id, day_title, readiness, timer_result, competition_proof
    ) values (
      'valid-workout',
      '11111111-1111-4111-8111-111111111111',
      '2026-07-14',
      1,
      'day-1',
      'Valid workout',
      'green',
      '{"elapsedSeconds":60}'::jsonb,
      '{"note":"Verified"}'::jsonb
    )$$,
  'valid object metadata is accepted'
);
select throws_ok(
  $$insert into public.workout_logs (
      id, user_id, date, week, day_id, day_title, readiness, timer_result
    ) values (
      'invalid-timer',
      '11111111-1111-4111-8111-111111111111',
      '2026-07-14',
      1,
      'day-1',
      'Invalid timer',
      'green',
      '[]'::jsonb
    )$$,
  null,
  null,
  'non-object timer metadata is rejected'
);
select throws_ok(
  $$insert into public.workout_logs (
      id, user_id, date, week, day_id, day_title, readiness, competition_proof
    ) values (
      'invalid-proof',
      '11111111-1111-4111-8111-111111111111',
      '2026-07-14',
      1,
      'day-1',
      'Invalid proof',
      'green',
      'true'::jsonb
    )$$,
  null,
  null,
  'non-object competition proof is rejected'
);
select throws_ok(
  $$insert into public.workout_logs (
      id, user_id, date, week, day_id, day_title, readiness
    ) values (
      'blank-workout',
      '11111111-1111-4111-8111-111111111111',
      '2026-07-14',
      1,
      '   ',
      'Blank day',
      'green'
    )$$,
  null,
  null,
  'blank required workout text is rejected'
);
select throws_ok(
  $$insert into public.workout_logs (
      id, user_id, date, week, day_id, day_title, readiness, created_at
    ) values (
      'infinite-workout-time',
      '11111111-1111-4111-8111-111111111111',
      '2026-07-14',
      1,
      'day-1',
      'Infinite time',
      'green',
      'infinity'::timestamptz
    )$$,
  null,
  null,
  'infinite workout creation timestamps are rejected'
);

select lives_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date
    ) values (
      'valid-attempt',
      '11111111-1111-4111-8111-111111111111',
      'back_squat',
      'Back squat',
      1,
      '1 kg',
      '2026-07-14'
    )$$,
  'positive PR-attempt values are accepted'
);
select throws_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date
    ) values (
      'zero-attempt',
      '11111111-1111-4111-8111-111111111111',
      'back_squat',
      'Back squat',
      0,
      '0 kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'zero PR-attempt values are rejected'
);
select throws_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date
    ) values (
      'negative-attempt',
      '11111111-1111-4111-8111-111111111111',
      'back_squat',
      'Back squat',
      -1,
      '-1 kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'negative PR-attempt values are rejected'
);
select throws_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date
    ) values (
      'nan-attempt',
      '11111111-1111-4111-8111-111111111111',
      'back_squat',
      'Back squat',
      'NaN'::numeric,
      'NaN kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'NaN PR-attempt values are rejected'
);
select throws_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date
    ) values (
      'infinite-attempt',
      '11111111-1111-4111-8111-111111111111',
      'back_squat',
      'Back squat',
      'Infinity'::numeric,
      'Infinity kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'infinite PR-attempt values are rejected'
);
select throws_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date, created_at
    ) values (
      'infinite-attempt-time',
      '11111111-1111-4111-8111-111111111111',
      'back_squat',
      'Back squat',
      1,
      '1 kg',
      '2026-07-14',
      'infinity'::timestamptz
    )$$,
  null,
  null,
  'infinite PR-attempt creation timestamps are rejected'
);
select throws_ok(
  $$insert into public.pr_attempts (
      id, user_id, metric_id, metric_name, value, display, date
    ) values (
      'blank-attempt',
      '11111111-1111-4111-8111-111111111111',
      '',
      'Back squat',
      1,
      '1 kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'blank required PR-attempt text is rejected'
);

select lives_ok(
  $$insert into public.personal_records (
      user_id, metric_id, value, display, date
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'baseline_metric',
      0,
      'Not tested',
      'Baseline'
    )$$,
  'zero-valued baseline personal records remain valid'
);
select throws_ok(
  $$insert into public.personal_records (
      user_id, metric_id, value, display, date
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'negative_metric',
      -1,
      '-1 kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'negative personal-record values are rejected'
);
select throws_ok(
  $$insert into public.personal_records (
      user_id, metric_id, value, display, date
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'nan_metric',
      'NaN'::numeric,
      'NaN kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'NaN personal-record values are rejected'
);
select throws_ok(
  $$insert into public.personal_records (
      user_id, metric_id, value, display, date
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'infinite_metric',
      'Infinity'::numeric,
      'Infinity kg',
      '2026-07-14'
    )$$,
  null,
  null,
  'infinite personal-record values are rejected'
);
select throws_ok(
  $$insert into public.personal_records (
      user_id, metric_id, value, display, date, updated_at
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'infinite_record_time',
      1,
      '1 kg',
      '2026-07-14',
      'infinity'::timestamptz
    )$$,
  null,
  null,
  'infinite personal-record update timestamps are rejected'
);
select throws_ok(
  $$insert into public.personal_records (
      user_id, metric_id, value, display, date
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'blank_metric',
      1,
      '   ',
      '2026-07-14'
    )$$,
  null,
  null,
  'blank required personal-record text is rejected'
);

select * from finish();
rollback;
