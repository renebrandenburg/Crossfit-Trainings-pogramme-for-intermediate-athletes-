alter table public.workout_logs
  add column if not exists workout_source text not null default 'app',
  add column if not exists difficulty smallint,
  add column if not exists movement_patterns text[] not null default '{}',
  add column if not exists duration_minutes integer;

alter table public.workout_logs
  alter column readiness drop not null;

alter table public.workout_logs
  drop constraint if exists workout_logs_readiness_check;

alter table public.workout_logs
  add constraint workout_logs_source_valid
  check (workout_source in ('app', 'box', 'custom')) not valid,
  add constraint workout_logs_readiness_valid
  check (
    (workout_source = 'box' and (readiness is null or readiness in ('green', 'amber', 'red')))
    or (workout_source in ('app', 'custom') and readiness in ('green', 'amber', 'red'))
  ) not valid,
  add constraint workout_logs_difficulty_valid
  check (difficulty is null or difficulty between 1 and 5) not valid,
  add constraint workout_logs_movement_patterns_valid
  check (
    movement_patterns <@ array[
      'squat',
      'hinge',
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
      'olympic_lifting',
      'gymnastics',
      'short_conditioning',
      'medium_conditioning',
      'long_conditioning',
      'aerobic',
      'sprint'
    ]::text[]
  ) not valid,
  add constraint workout_logs_duration_minutes_valid
  check (duration_minutes is null or duration_minutes between 1 and 300) not valid;

alter table public.workout_logs
  validate constraint workout_logs_source_valid;
alter table public.workout_logs
  validate constraint workout_logs_readiness_valid;
alter table public.workout_logs
  validate constraint workout_logs_difficulty_valid;
alter table public.workout_logs
  validate constraint workout_logs_movement_patterns_valid;
alter table public.workout_logs
  validate constraint workout_logs_duration_minutes_valid;
