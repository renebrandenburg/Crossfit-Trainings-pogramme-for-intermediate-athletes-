create table if not exists public.training_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  kind text not null check (kind in ('app', 'box', 'rest')),
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'skipped')),
  session_id text,
  title text not null,
  raw_box_text text,
  movement_ids text[] not null default '{}',
  stimuli text[] not null default '{}'
    check (
      stimuli <@ array[
        'squat', 'hinge', 'horizontal_push', 'vertical_push',
        'horizontal_pull', 'vertical_pull', 'olympic_lifting', 'gymnastics',
        'short_conditioning', 'medium_conditioning', 'long_conditioning',
        'aerobic', 'sprint'
      ]::text[]
    ),
  recommendation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_events_required_text_nonempty check (
    btrim(id) <> ''
    and btrim(date) <> ''
    and btrim(title) <> ''
  ),
  constraint training_events_date_valid check (
    date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  constraint training_events_recommendation_object check (
    recommendation is null or jsonb_typeof(recommendation) = 'object'
  ),
  constraint training_events_times_finite check (
    isfinite(created_at) and isfinite(updated_at)
  )
);

create table if not exists public.readiness_checks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  energy smallint not null check (energy between 1 and 5),
  soreness text not null check (soreness in ('none', 'manageable', 'high')),
  pain boolean not null default false,
  available_minutes integer not null
    check (available_minutes between 15 and 180),
  created_at timestamptz not null default now(),
  constraint readiness_checks_required_text_nonempty check (
    btrim(id) <> '' and btrim(date) <> ''
  ),
  constraint readiness_checks_date_valid check (
    date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  constraint readiness_checks_created_at_finite check (isfinite(created_at))
);

alter table public.workout_logs
  add column if not exists training_event_id text;
alter table public.workout_logs
  add column if not exists readiness_check_id text;
alter table public.workout_logs
  add column if not exists structured_score jsonb;
alter table public.workout_logs
  add column if not exists recommendation_snapshot jsonb;
alter table public.workout_logs
  add column if not exists rx_status text;

alter table public.workout_logs
  drop constraint if exists workout_logs_structured_score_object;
alter table public.workout_logs
  add constraint workout_logs_structured_score_object check (
    structured_score is null or jsonb_typeof(structured_score) = 'object'
  );
alter table public.workout_logs
  drop constraint if exists workout_logs_recommendation_snapshot_object;
alter table public.workout_logs
  add constraint workout_logs_recommendation_snapshot_object check (
    recommendation_snapshot is null
    or jsonb_typeof(recommendation_snapshot) = 'object'
  );
alter table public.workout_logs
  drop constraint if exists workout_logs_rx_status_valid;
alter table public.workout_logs
  add constraint workout_logs_rx_status_valid check (
    rx_status is null or rx_status in ('rx', 'scaled', 'not_applicable')
  );

alter table public.athlete_states
  drop constraint if exists athlete_states_state_valid;
alter table public.athlete_states
  add constraint athlete_states_state_valid check (
    jsonb_typeof(state) = 'object'
    and state ?& array[
      'profile',
      'plans',
      'activePlanId',
      'selectedWeek',
      'planSchemaVersion'
    ]
    and jsonb_typeof(state -> 'profile') = 'object'
    and jsonb_typeof(state -> 'plans') = 'array'
    and (
      state -> 'activePlanId' = 'null'::jsonb
      or jsonb_typeof(state -> 'activePlanId') = 'string'
    )
    and jsonb_typeof(state -> 'selectedWeek') = 'number'
    and (state ->> 'selectedWeek') ~ '^[1-8]$'
    and jsonb_typeof(state -> 'planSchemaVersion') = 'number'
    and (
      not (state ? 'cycleStartDate')
      or state -> 'cycleStartDate' = 'null'::jsonb
      or (
        jsonb_typeof(state -> 'cycleStartDate') = 'string'
        and (state ->> 'cycleStartDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      )
    )
  );

create index if not exists training_events_user_date_id_idx
  on public.training_events (user_id, date desc, id desc);
create index if not exists readiness_checks_user_date_id_idx
  on public.readiness_checks (user_id, date desc, id desc);
create index if not exists workout_logs_training_event_idx
  on public.workout_logs (user_id, training_event_id)
  where training_event_id is not null;

alter table public.training_events enable row level security;
alter table public.readiness_checks enable row level security;

drop policy if exists "Users can read their training events"
  on public.training_events;
drop policy if exists "Users can insert their training events"
  on public.training_events;
drop policy if exists "Users can update their training events"
  on public.training_events;
drop policy if exists "Users can delete their training events"
  on public.training_events;

create policy "Users can read their training events"
  on public.training_events for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their training events"
  on public.training_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their training events"
  on public.training_events for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their training events"
  on public.training_events for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their readiness checks"
  on public.readiness_checks;
drop policy if exists "Users can insert their readiness checks"
  on public.readiness_checks;
drop policy if exists "Users can update their readiness checks"
  on public.readiness_checks;
drop policy if exists "Users can delete their readiness checks"
  on public.readiness_checks;

create policy "Users can read their readiness checks"
  on public.readiness_checks for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their readiness checks"
  on public.readiness_checks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their readiness checks"
  on public.readiness_checks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their readiness checks"
  on public.readiness_checks for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.training_events
  from public, anon, authenticated;
revoke all on table public.readiness_checks
  from public, anon, authenticated;
grant select, insert, update, delete on table public.training_events
  to authenticated;
grant select, insert, update, delete on table public.readiness_checks
  to authenticated;
