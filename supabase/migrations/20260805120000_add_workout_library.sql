alter table public.workout_logs
  add column if not exists library_category_id text,
  add column if not exists library_item_id text,
  add column if not exists library_snapshot jsonb;

alter table public.workout_logs
  drop constraint if exists workout_logs_source_valid;
alter table public.workout_logs
  add constraint workout_logs_source_valid
  check (workout_source in ('app', 'box', 'custom', 'library')) not valid;

alter table public.workout_logs
  drop constraint if exists workout_logs_readiness_valid;
alter table public.workout_logs
  add constraint workout_logs_readiness_valid check (
    (workout_source in ('box', 'library') and (readiness is null or readiness in ('green', 'amber', 'red')))
    or (workout_source in ('app', 'custom') and readiness in ('green', 'amber', 'red'))
  ) not valid;

alter table public.workout_logs
  drop constraint if exists workout_logs_library_snapshot_object;
alter table public.workout_logs
  add constraint workout_logs_library_snapshot_object
  check (library_snapshot is null or jsonb_typeof(library_snapshot) = 'object') not valid;

create index if not exists workout_logs_library_item_idx
  on public.workout_logs (user_id, library_item_id, date desc)
  where library_item_id is not null;

alter table public.workout_logs validate constraint workout_logs_source_valid;
alter table public.workout_logs validate constraint workout_logs_readiness_valid;
alter table public.workout_logs validate constraint workout_logs_library_snapshot_object;
