begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(40);

select has_table('public', 'training_events', 'training_events exists');
select has_table('public', 'readiness_checks', 'readiness_checks exists');
select has_column('public', 'workout_logs', 'training_event_id', 'workout logs link to training events');
select has_column('public', 'workout_logs', 'readiness_check_id', 'workout logs link to readiness checks');
select has_column('public', 'workout_logs', 'structured_score', 'workout logs store structured scores');
select has_column('public', 'workout_logs', 'recommendation_snapshot', 'workout logs preserve recommendations');
select has_column('public', 'workout_logs', 'rx_status', 'workout logs store Rx status');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.training_events'::regclass),
  'training_events has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.readiness_checks'::regclass),
  'readiness_checks has RLS enabled'
);
select policies_are(
  'public',
  'training_events',
  array[
    'Users can read their training events',
    'Users can insert their training events',
    'Users can update their training events',
    'Users can delete their training events'
  ],
  'training_events has four owner policies'
);
select policies_are(
  'public',
  'readiness_checks',
  array[
    'Users can read their readiness checks',
    'Users can insert their readiness checks',
    'Users can update their readiness checks',
    'Users can delete their readiness checks'
  ],
  'readiness_checks has four owner policies'
);
select ok(
  has_table_privilege('authenticated', 'public.training_events', 'select, insert, update, delete'),
  'authenticated has the required training_events privileges'
);
select ok(
  has_table_privilege('authenticated', 'public.readiness_checks', 'select, insert, update, delete'),
  'authenticated has the required readiness_checks privileges'
);
select ok(not has_table_privilege('anon', 'public.training_events', 'select'), 'anon cannot select training_events');
select ok(not has_table_privilege('anon', 'public.readiness_checks', 'select'), 'anon cannot select readiness_checks');

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'coach-one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'coach-two@example.test');

insert into public.training_events (
  id, user_id, date, kind, status, title, stimuli
)
values
  ('event-one', '11111111-1111-4111-8111-111111111111', '2026-07-31', 'app', 'planned', 'Owner one session', array['squat']),
  ('event-two', '22222222-2222-4222-8222-222222222222', '2026-07-31', 'box', 'planned', 'Owner two box WOD', array['vertical_pull']);

insert into public.readiness_checks (
  id, user_id, date, energy, soreness, pain, available_minutes
)
values
  ('check-one', '11111111-1111-4111-8111-111111111111', '2026-07-31', 4, 'manageable', false, 60),
  ('check-two', '22222222-2222-4222-8222-222222222222', '2026-07-31', 3, 'none', false, 45);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is((select count(*)::integer from public.training_events), 1, 'an athlete sees only their training events');
select is((select count(*)::integer from public.readiness_checks), 1, 'an athlete sees only their readiness checks');
select lives_ok(
  $$insert into public.training_events (id, user_id, date, kind, status, title)
    values ('event-own', '11111111-1111-4111-8111-111111111111', '2026-08-01', 'rest', 'planned', 'Rest day')$$,
  'an athlete inserts their own training event'
);
select throws_ok(
  $$insert into public.training_events (id, user_id, date, kind, status, title)
    values ('event-spoof', '22222222-2222-4222-8222-222222222222', '2026-08-01', 'rest', 'planned', 'Spoofed rest')$$,
  null, null, 'an athlete cannot spoof training-event ownership'
);
select lives_ok(
  $$insert into public.readiness_checks (id, user_id, date, energy, soreness, pain, available_minutes)
    values ('check-own', '11111111-1111-4111-8111-111111111111', '2026-08-01', 5, 'none', false, 75)$$,
  'an athlete inserts their own readiness check'
);
select throws_ok(
  $$insert into public.readiness_checks (id, user_id, date, energy, soreness, pain, available_minutes)
    values ('check-spoof', '22222222-2222-4222-8222-222222222222', '2026-08-01', 5, 'none', false, 75)$$,
  null, null, 'an athlete cannot spoof readiness ownership'
);
select is_empty(
  $$update public.training_events set title = 'Stolen' where id = 'event-two' returning 1$$,
  'an athlete cannot update another athlete training event'
);
select is_empty(
  $$delete from public.readiness_checks where id = 'check-two' returning 1$$,
  'an athlete cannot delete another athlete readiness check'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
set local request.jwt.claim.sub = '';

select throws_ok($$select * from public.training_events$$, null, null, 'anon cannot read training events');
select throws_ok(
  $$insert into public.training_events (id, user_id, date, kind, title)
    values ('anon-event', '11111111-1111-4111-8111-111111111111', '2026-08-01', 'rest', 'Anon rest')$$,
  null, null, 'anon cannot insert training events'
);
select throws_ok($$update public.training_events set title = 'Anon'$$, null, null, 'anon cannot update training events');
select throws_ok($$delete from public.training_events$$, null, null, 'anon cannot delete training events');
select throws_ok($$select * from public.readiness_checks$$, null, null, 'anon cannot read readiness checks');
select throws_ok(
  $$insert into public.readiness_checks (id, user_id, date, energy, soreness, available_minutes)
    values ('anon-check', '11111111-1111-4111-8111-111111111111', '2026-08-01', 3, 'none', 60)$$,
  null, null, 'anon cannot insert readiness checks'
);
select throws_ok($$update public.readiness_checks set energy = 1$$, null, null, 'anon cannot update readiness checks');
select throws_ok($$delete from public.readiness_checks$$, null, null, 'anon cannot delete readiness checks');

reset role;

select throws_ok(
  $$insert into public.training_events (id, user_id, date, kind, title)
    values ('bad-kind', '11111111-1111-4111-8111-111111111111', '2026-08-01', 'social', 'Bad kind')$$,
  null, null, 'invalid event kinds are rejected'
);
select throws_ok(
  $$insert into public.training_events (id, user_id, date, kind, title, stimuli)
    values ('bad-stimulus', '11111111-1111-4111-8111-111111111111', '2026-08-01', 'box', 'Bad stimulus', array['chaos'])$$,
  null, null, 'invalid training stimuli are rejected'
);
select throws_ok(
  $$insert into public.training_events (id, user_id, date, kind, title, recommendation)
    values ('bad-recommendation', '11111111-1111-4111-8111-111111111111', '2026-08-01', 'box', 'Bad recommendation', '[]'::jsonb)$$,
  null, null, 'non-object recommendations are rejected'
);
select throws_ok(
  $$insert into public.readiness_checks (id, user_id, date, energy, soreness, available_minutes)
    values ('bad-energy', '11111111-1111-4111-8111-111111111111', '2026-08-01', 6, 'none', 60)$$,
  null, null, 'readiness energy outside one to five is rejected'
);
select throws_ok(
  $$insert into public.readiness_checks (id, user_id, date, energy, soreness, available_minutes)
    values ('bad-soreness', '11111111-1111-4111-8111-111111111111', '2026-08-01', 3, 'extreme', 60)$$,
  null, null, 'unknown soreness values are rejected'
);
select throws_ok(
  $$insert into public.readiness_checks (id, user_id, date, energy, soreness, available_minutes)
    values ('bad-time', '11111111-1111-4111-8111-111111111111', '2026-08-01', 3, 'none', 5)$$,
  null, null, 'unsafe available-minute values are rejected'
);
select throws_ok(
  $$insert into public.workout_logs (id, user_id, date, week, day_id, day_title, readiness, structured_score)
    values ('bad-score', '11111111-1111-4111-8111-111111111111', '2026-08-01', 1, 'day-1', 'Bad score', 'green', '[]'::jsonb)$$,
  null, null, 'non-object structured scores are rejected'
);
select throws_ok(
  $$insert into public.workout_logs (id, user_id, date, week, day_id, day_title, readiness, recommendation_snapshot)
    values ('bad-snapshot', '11111111-1111-4111-8111-111111111111', '2026-08-01', 1, 'day-1', 'Bad snapshot', 'green', 'true'::jsonb)$$,
  null, null, 'non-object recommendation snapshots are rejected'
);
select throws_ok(
  $$insert into public.workout_logs (id, user_id, date, week, day_id, day_title, readiness, rx_status)
    values ('bad-rx', '11111111-1111-4111-8111-111111111111', '2026-08-01', 1, 'day-1', 'Bad Rx', 'green', 'almost-rx')$$,
  null, null, 'invalid Rx status is rejected'
);

select * from finish();
rollback;
