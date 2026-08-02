create schema if not exists private;

create table public.movement_families (
  id text primary key,
  name text not null check (btrim(name) <> ''),
  catalog_version integer not null default 1 check (catalog_version > 0),
  created_at timestamptz not null default now() check (isfinite(created_at))
);

create table public.movements (
  id text primary key,
  family_id text not null references public.movement_families(id),
  name text not null check (btrim(name) <> ''),
  category text not null check (category in ('strength', 'olympic_lifting', 'gymnastics', 'conditioning', 'accessory')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  purposes text[] not null default '{}',
  prerequisites text[] not null default '{}',
  allowed_contexts text[] not null check (cardinality(allowed_contexts) > 0),
  unilateral boolean not null default false,
  loadable boolean not null default false,
  requires_percentage_reference boolean not null default false,
  equipment text[] not null default '{}',
  seconds_per_rep numeric not null default 4 check (seconds_per_rep > 0 and seconds_per_rep <= 60),
  is_technique_drill boolean not null default false,
  is_isometric boolean not null default false,
  catalog_version integer not null default 1 check (catalog_version > 0),
  created_at timestamptz not null default now() check (isfinite(created_at))
);

create table public.training_programs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  engine_version text not null default 'v2' check (engine_version = 'v2'),
  schema_version integer not null check (schema_version = 2),
  template_version text not null check (btrim(template_version) <> ''),
  catalog_version integer not null check (catalog_version > 0),
  validator_version integer not null check (validator_version > 0),
  name text not null check (btrim(name) <> ''),
  status text not null check (status in ('planned', 'active', 'completed')),
  active_training_block_id uuid,
  revision integer not null default 1 check (revision > 0),
  validated_snapshot jsonb not null check (jsonb_typeof(validated_snapshot) = 'object'),
  created_at timestamptz not null check (isfinite(created_at)),
  updated_at timestamptz not null check (isfinite(updated_at)),
  unique (id, user_id)
);

create table public.training_blocks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.training_programs(id) on delete cascade,
  block_type text not null check (block_type in ('mixed_strength', 'front_squat_accumulation', 'back_squat_strength', 'olympic_lifting_development', 'snatch_development', 'clean_and_jerk_development', 'gymnastics_capacity', 'aerobic_capacity', 'competition_preparation', 'deload')),
  name text not null check (btrim(name) <> ''),
  goal text not null check (btrim(goal) <> ''),
  duration_weeks integer not null check (duration_weeks between 1 and 52),
  current_week integer not null check (current_week between 1 and duration_weeks),
  status text not null check (status in ('planned', 'active', 'completed')),
  deload_week integer check (deload_week is null or deload_week between 1 and duration_weeks),
  started_at timestamptz check (started_at is null or isfinite(started_at)),
  completed_at timestamptz check (completed_at is null or isfinite(completed_at)),
  created_at timestamptz not null check (isfinite(created_at)),
  updated_at timestamptz not null check (isfinite(updated_at)),
  unique (program_id, id),
  unique (id, user_id)
);

alter table public.training_programs
  add constraint training_programs_active_block_fk
  foreign key (active_training_block_id)
  references public.training_blocks(id)
  deferrable initially deferred;

create table public.progression_tracks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  training_block_id uuid not null references public.training_blocks(id) on delete cascade,
  track_type text not null check (track_type in ('front_squat', 'back_squat', 'snatch', 'clean_and_jerk', 'upper_body_press', 'strict_pull', 'gymnastics_skill', 'engine')),
  movement_family_id text not null references public.movement_families(id),
  current_step integer not null check (current_step > 0),
  total_steps integer not null check (total_steps > 0 and current_step <= total_steps),
  status text not null check (status in ('active', 'completed', 'paused')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null check (isfinite(created_at)),
  updated_at timestamptz not null check (isfinite(updated_at)),
  unique (training_block_id, track_type),
  unique (id, user_id)
);

create table public.progression_steps (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  progression_track_id uuid not null references public.progression_tracks(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  week_number integer not null check (week_number > 0),
  movement_id text references public.movements(id),
  movement_family_id text not null references public.movement_families(id),
  sets integer check (sets is null or sets > 0),
  reps integer check (reps is null or reps > 0),
  rep_range_min integer check (rep_range_min is null or rep_range_min > 0),
  rep_range_max integer check (rep_range_max is null or rep_range_max >= rep_range_min),
  intensity_method text not null check (intensity_method in ('percentage_1rm', 'percentage_training_max', 'rpe', 'rir', 'fixed_load', 'bodyweight', 'quality', 'none')),
  intensity_min numeric,
  intensity_max numeric check (intensity_max is null or intensity_min is null or intensity_max >= intensity_min),
  rest_seconds integer check (rest_seconds is null or rest_seconds >= 0),
  tempo text,
  pause_description text,
  technical_intent text not null check (btrim(technical_intent) <> ''),
  estimated_duration_minutes numeric not null check (estimated_duration_minutes > 0),
  unique (progression_track_id, step_number),
  unique (id, user_id)
);

create table public.training_weeks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  training_block_id uuid not null references public.training_blocks(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  theme text not null check (btrim(theme) <> ''),
  status text not null check (status in ('planned', 'active', 'completed')),
  unique (training_block_id, week_number),
  unique (id, user_id)
);

create table public.training_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  training_week_id uuid not null references public.training_weeks(id) on delete cascade,
  session_number integer not null check (session_number in (1, 2)),
  week_number integer not null check (week_number between 1 and 6),
  objective text not null check (btrim(objective) <> ''),
  intended_stimulus text not null check (btrim(intended_stimulus) <> ''),
  expected_fatigue text not null check (expected_fatigue in ('low', 'moderate', 'high')),
  fatigue_focus text not null check (fatigue_focus in ('lower_body', 'upper_body', 'grip', 'mixed', 'recovery')),
  community_workout_advice text not null check (btrim(community_workout_advice) <> ''),
  duration_target_minutes integer not null check (duration_target_minutes between 30 and 65),
  estimated_duration_minutes numeric not null check (estimated_duration_minutes > 0 and estimated_duration_minutes <= 65),
  duration_validation_status text not null check (duration_validation_status in ('within_target', 'warning_short', 'warning_long', 'invalid_too_long')),
  provisional boolean not null default true,
  status text not null check (status in ('planned', 'completed', 'skipped', 'blocked')),
  revision integer not null check (revision > 0),
  stress jsonb not null check (jsonb_typeof(stress) = 'object'),
  created_at timestamptz not null check (isfinite(created_at)),
  updated_at timestamptz not null check (isfinite(updated_at)),
  unique (training_week_id, session_number),
  unique (id, user_id)
);

create table public.session_progression_tracks (
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  progression_track_id uuid not null references public.progression_tracks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progression_step_number integer not null check (progression_step_number > 0),
  role text not null check (role in ('primary', 'secondary')),
  primary key (session_id, progression_track_id)
);

create table public.session_sections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  section text not null check (section in ('warmup', 'primary', 'secondary', 'conditioning', 'accessory', 'cooldown', 'transition')),
  section_order integer not null check (section_order > 0),
  estimated_duration_minutes numeric not null check (estimated_duration_minutes >= 0),
  unique (session_id, section_order),
  unique (id, user_id)
);

create table public.exercise_prescriptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  progression_track_id uuid references public.progression_tracks(id) on delete set null,
  progression_step_number integer check (progression_step_number is null or progression_step_number > 0),
  group_id uuid,
  section text not null check (section in ('warmup', 'primary', 'secondary', 'skill', 'conditioning', 'accessory', 'cooldown')),
  movement_id text not null references public.movements(id),
  movement_name text not null check (btrim(movement_name) <> ''),
  movement_family_id text not null references public.movement_families(id),
  sets integer not null check (sets > 0),
  reps integer check (reps is null or reps > 0),
  rep_range_min integer check (rep_range_min is null or rep_range_min > 0),
  rep_range_max integer check (rep_range_max is null or rep_range_max >= rep_range_min),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  distance_meters integer check (distance_meters is null or distance_meters > 0),
  calories integer check (calories is null or calories > 0),
  intensity_method text not null check (intensity_method in ('percentage_1rm', 'percentage_training_max', 'rpe', 'rir', 'fixed_load', 'bodyweight', 'quality')),
  intensity_value numeric,
  intensity_max numeric check (intensity_max is null or intensity_value is null or intensity_max >= intensity_value),
  load_kg numeric check (load_kg is null or load_kg > 0),
  reference_max_kg numeric check (reference_max_kg is null or reference_max_kg > 0),
  reference_lift text,
  rest_seconds integer not null check (rest_seconds >= 0),
  tempo text,
  pause_description text,
  technical_intent text not null check (btrim(technical_intent) <> ''),
  progression_objective text,
  stopping_rule text,
  coaching_cues jsonb not null default '[]' check (jsonb_typeof(coaching_cues) = 'array'),
  scaling_options jsonb not null default '[]' check (jsonb_typeof(scaling_options) = 'array'),
  equipment text[] not null default '{}',
  warmup_set_count integer not null default 0 check (warmup_set_count >= 0),
  setup_minutes numeric not null default 0 check (setup_minutes >= 0),
  estimated_duration_minutes numeric not null check (estimated_duration_minutes > 0),
  check (reps is not null or (rep_range_min is not null and rep_range_max is not null) or duration_seconds is not null or distance_meters is not null or calories is not null),
  unique (id, user_id)
);

create table public.conditioning_prescriptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique references public.training_sessions(id) on delete cascade,
  format text not null check (format in ('for_time', 'amrap', 'emom', 'intervals', 'rounds_for_quality', 'zone_2')),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  rounds integer check (rounds is null or rounds > 0),
  time_cap_minutes integer check (time_cap_minutes is null or time_cap_minutes > 0),
  work_seconds integer check (work_seconds is null or work_seconds > 0),
  rest_seconds integer check (rest_seconds is null or rest_seconds > 0),
  intended_stimulus text not null check (btrim(intended_stimulus) <> ''),
  target_duration_min integer,
  target_duration_max integer check (target_duration_max is null or target_duration_min is null or target_duration_max >= target_duration_min),
  target_rpe numeric check (target_rpe is null or target_rpe between 1 and 10),
  scaling_options jsonb not null check (jsonb_typeof(scaling_options) = 'array' and jsonb_array_length(scaling_options) > 0),
  estimated_duration_minutes numeric not null check (estimated_duration_minutes > 0),
  check (format <> 'intervals' or rest_seconds is not null),
  check (format not in ('amrap', 'emom', 'zone_2') or duration_minutes is not null),
  check (format <> 'for_time' or time_cap_minutes is not null or (target_duration_min is not null and target_duration_max is not null)),
  unique (id, user_id)
);

create table public.conditioning_movements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conditioning_id uuid not null references public.conditioning_prescriptions(id) on delete cascade,
  movement_order integer not null check (movement_order > 0),
  movement_id text not null references public.movements(id),
  movement_name text not null check (btrim(movement_name) <> ''),
  movement_family_id text not null references public.movement_families(id),
  reps integer check (reps is null or reps > 0),
  calories integer check (calories is null or calories > 0),
  distance_meters integer check (distance_meters is null or distance_meters > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  load_kg numeric check (load_kg is null or load_kg > 0),
  percentage_reference numeric check (percentage_reference is null or percentage_reference between 1 and 100),
  equipment text[] not null default '{}',
  check (reps is not null or calories is not null or distance_meters is not null or duration_seconds is not null),
  unique (conditioning_id, movement_order)
);

create table public.warmup_prescriptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique references public.training_sessions(id) on delete cascade,
  duration_minutes integer not null check (duration_minutes between 1 and 15),
  rounds integer check (rounds is null or rounds > 0),
  purpose text not null check (btrim(purpose) <> ''),
  unique (id, user_id)
);

create table public.warmup_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  warmup_id uuid not null references public.warmup_prescriptions(id) on delete cascade,
  exercise_order integer not null check (exercise_order > 0),
  movement_id text not null references public.movements(id),
  movement_name text not null check (btrim(movement_name) <> ''),
  reps integer check (reps is null or reps > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  distance_meters integer check (distance_meters is null or distance_meters > 0),
  equipment text[] not null default '{}',
  check (reps is not null or duration_seconds is not null or distance_meters is not null),
  unique (warmup_id, exercise_order)
);

create table public.equipment_transitions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  transition_order integer not null check (transition_order > 0),
  from_equipment text[] not null default '{}',
  to_equipment text[] not null default '{}',
  estimated_minutes numeric not null check (estimated_minutes >= 0),
  unique (session_id, transition_order)
);

create table public.session_feedback (
  session_id uuid primary key references public.training_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean not null,
  session_rpe numeric check (session_rpe is null or session_rpe between 1 and 10),
  fatigue numeric check (fatigue is null or fatigue between 1 and 10),
  pain_reported boolean not null default false,
  duration_minutes_actual integer check (duration_minutes_actual is null or duration_minutes_actual > 0),
  notes text,
  completed_at timestamptz not null check (isfinite(completed_at))
);

create table public.exercise_results (
  prescription_id uuid primary key references public.exercise_prescriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progression_track_id uuid not null references public.progression_tracks(id) on delete cascade,
  completed_sets integer not null check (completed_sets >= 0),
  completed_reps integer not null check (completed_reps >= 0),
  load_kg numeric check (load_kg is null or load_kg >= 0),
  achieved_rpe numeric check (achieved_rpe is null or achieved_rpe between 1 and 10),
  successful boolean not null,
  pain_reported boolean not null default false
);

create table public.program_validation_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.training_programs(id) on delete cascade,
  validator_version integer not null check (validator_version > 0),
  code text not null check (btrim(code) <> ''),
  severity text not null check (severity in ('error', 'warning')),
  issue_path text not null,
  message text not null check (btrim(message) <> ''),
  created_at timestamptz not null default now() check (isfinite(created_at))
);

create table public.athlete_movement_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_id text references public.movements(id),
  movement_family_id text references public.movement_families(id),
  guidance text,
  created_at timestamptz not null default now() check (isfinite(created_at)),
  updated_at timestamptz not null default now() check (isfinite(updated_at)),
  check ((movement_id is not null) <> (movement_family_id is not null)),
  unique nulls not distinct (user_id, movement_id, movement_family_id)
);

create table public.programming_engine_flags (
  user_id uuid primary key references auth.users(id) on delete cascade,
  v2_enabled boolean not null default false,
  rollout_group text not null default 'disabled' check (btrim(rollout_group) <> ''),
  updated_at timestamptz not null default now() check (isfinite(updated_at))
);

create index training_programs_user_status_idx on public.training_programs (user_id, status, updated_at desc);
create index training_blocks_program_status_idx on public.training_blocks (program_id, status);
create index progression_tracks_block_status_idx on public.progression_tracks (training_block_id, status);
create index progression_steps_track_week_idx on public.progression_steps (progression_track_id, week_number, step_number);
create index training_weeks_block_week_idx on public.training_weeks (training_block_id, week_number);
create index training_sessions_week_number_idx on public.training_sessions (training_week_id, session_number);
create index exercise_prescriptions_session_section_idx on public.exercise_prescriptions (session_id, section);
create index program_validation_results_program_idx on public.program_validation_results (program_id, severity, created_at desc);
create index athlete_restrictions_user_idx on public.athlete_movement_restrictions (user_id);

-- PostgreSQL does not index foreign keys automatically. These indexes cover
-- both cascade paths and the owner predicate used by every graph-table RLS
-- policy. Keep user_id first in owner indexes so auth-scoped reads do not scan
-- another athlete's programme graph.
create index movements_family_idx on public.movements (family_id);
create index training_programs_active_block_idx on public.training_programs (active_training_block_id);
create index training_blocks_user_idx on public.training_blocks (user_id);
create index progression_tracks_user_idx on public.progression_tracks (user_id);
create index progression_tracks_family_idx on public.progression_tracks (movement_family_id);
create index progression_steps_user_idx on public.progression_steps (user_id);
create index progression_steps_movement_idx on public.progression_steps (movement_id);
create index progression_steps_family_idx on public.progression_steps (movement_family_id);
create index training_weeks_user_idx on public.training_weeks (user_id);
create index training_sessions_user_idx on public.training_sessions (user_id);
create index session_progression_tracks_user_idx on public.session_progression_tracks (user_id);
create index session_progression_tracks_track_idx on public.session_progression_tracks (progression_track_id);
create index session_sections_user_idx on public.session_sections (user_id);
create index exercise_prescriptions_user_idx on public.exercise_prescriptions (user_id);
create index exercise_prescriptions_track_idx on public.exercise_prescriptions (progression_track_id);
create index exercise_prescriptions_movement_idx on public.exercise_prescriptions (movement_id);
create index exercise_prescriptions_family_idx on public.exercise_prescriptions (movement_family_id);
create index conditioning_prescriptions_user_idx on public.conditioning_prescriptions (user_id);
create index conditioning_movements_user_idx on public.conditioning_movements (user_id);
create index conditioning_movements_movement_idx on public.conditioning_movements (movement_id);
create index conditioning_movements_family_idx on public.conditioning_movements (movement_family_id);
create index warmup_prescriptions_user_idx on public.warmup_prescriptions (user_id);
create index warmup_exercises_user_idx on public.warmup_exercises (user_id);
create index warmup_exercises_movement_idx on public.warmup_exercises (movement_id);
create index equipment_transitions_user_idx on public.equipment_transitions (user_id);
create index session_feedback_user_idx on public.session_feedback (user_id);
create index exercise_results_user_idx on public.exercise_results (user_id);
create index exercise_results_track_idx on public.exercise_results (progression_track_id);
create index program_validation_results_user_idx on public.program_validation_results (user_id);

insert into public.movement_families (id, name)
values
  ('front_squat', 'Front squat'),
  ('back_squat', 'Back squat'),
  ('hinge', 'Hinge'),
  ('horizontal_press', 'Horizontal press'),
  ('vertical_press', 'Vertical press'),
  ('strict_pull', 'Strict pull'),
  ('kipping_pull', 'Kipping pull'),
  ('toes_to_bar', 'Toes to bar'),
  ('bar_muscle_up', 'Bar muscle-up'),
  ('ring_muscle_up', 'Ring muscle-up'),
  ('handstand', 'Handstand'),
  ('snatch', 'Snatch'),
  ('clean', 'Clean'),
  ('jerk', 'Jerk'),
  ('clean_and_jerk', 'Clean and jerk'),
  ('running', 'Running'),
  ('rowing', 'Rowing'),
  ('bike', 'Bike'),
  ('ski', 'Ski'),
  ('carry', 'Carry'),
  ('core', 'Core'),
  ('jumping', 'Jumping'),
  ('burpee', 'Burpee'),
  ('accessory', 'Accessory');

insert into public.movements (
  id, family_id, name, category, difficulty, allowed_contexts,
  unilateral, loadable, requires_percentage_reference, equipment,
  seconds_per_rep, is_technique_drill, is_isometric
)
values
  ('front_squat', 'front_squat', 'Front squat', 'strength', 'intermediate', array['primary','secondary'], false, true, true, array['barbell','rack'], 4, false, false),
  ('back_squat', 'back_squat', 'Back squat', 'strength', 'intermediate', array['primary','secondary'], false, true, true, array['barbell','rack'], 4, false, false),
  ('muscle_snatch', 'snatch', 'Muscle snatch', 'olympic_lifting', 'intermediate', array['warmup','secondary','skill'], false, true, true, array['barbell'], 6, true, false),
  ('hang_power_snatch', 'snatch', 'Hang power snatch', 'olympic_lifting', 'intermediate', array['primary','secondary','skill'], false, true, true, array['barbell'], 7, false, false),
  ('hang_squat_snatch', 'snatch', 'Hang squat snatch', 'olympic_lifting', 'advanced', array['primary','secondary','skill'], false, true, true, array['barbell'], 8, false, false),
  ('squat_snatch', 'snatch', 'Squat snatch', 'olympic_lifting', 'advanced', array['primary','secondary','skill'], false, true, true, array['barbell'], 8, false, false),
  ('snatch', 'snatch', 'Snatch', 'olympic_lifting', 'advanced', array['primary','secondary','skill'], false, true, true, array['barbell'], 8, false, false),
  ('snatch_pull', 'snatch', 'Snatch pull', 'olympic_lifting', 'intermediate', array['primary','secondary','accessory'], false, true, true, array['barbell'], 6, false, false),
  ('clean_pull', 'clean', 'Clean pull', 'olympic_lifting', 'intermediate', array['primary','secondary','accessory'], false, true, true, array['barbell'], 6, false, false),
  ('hang_clean_and_jerk', 'clean_and_jerk', 'Hang clean plus jerk', 'olympic_lifting', 'advanced', array['primary','secondary','skill'], false, true, true, array['barbell'], 12, false, false),
  ('clean_and_jerk', 'clean_and_jerk', 'Clean and jerk', 'olympic_lifting', 'advanced', array['primary','secondary','skill'], false, true, true, array['barbell'], 12, false, false),
  ('strict_pull_up', 'strict_pull', 'Strict pull-up', 'gymnastics', 'intermediate', array['secondary','skill','accessory'], false, false, false, array['pull-up bar'], 4, false, false),
  ('ring_row', 'strict_pull', 'Ring row', 'gymnastics', 'beginner', array['warmup','secondary','skill','accessory'], false, false, false, array['rings'], 3, false, false),
  ('hollow_hold', 'core', 'Hollow hold', 'gymnastics', 'beginner', array['warmup','secondary','skill','accessory'], false, false, false, '{}'::text[], 1, false, true),
  ('arch_hold', 'core', 'Arch hold', 'gymnastics', 'beginner', array['warmup','secondary','skill','accessory'], false, false, false, '{}'::text[], 1, false, true),
  ('hanging_knee_raise', 'toes_to_bar', 'Hanging knee raise', 'gymnastics', 'beginner', array['secondary','skill','accessory','conditioning'], false, false, false, array['pull-up bar'], 3, false, false),
  ('romanian_deadlift', 'hinge', 'Romanian deadlift', 'accessory', 'intermediate', array['accessory'], false, true, false, array['barbell'], 4, false, false),
  ('reverse_lunge', 'accessory', 'Reverse lunge', 'accessory', 'beginner', array['accessory'], true, true, false, array['dumbbell'], 3, false, false),
  ('farmer_carry', 'carry', 'Farmer carry', 'accessory', 'beginner', array['accessory','conditioning'], false, true, false, array['dumbbell'], 1, false, false),
  ('dead_bug', 'core', 'Dead bug', 'accessory', 'beginner', array['warmup','accessory','cooldown'], false, false, false, '{}'::text[], 3, false, false),
  ('side_plank', 'core', 'Side plank', 'accessory', 'beginner', array['accessory','cooldown'], false, false, false, '{}'::text[], 1, false, true),
  ('band_face_pull', 'accessory', 'Band face pull', 'accessory', 'beginner', array['warmup','accessory','cooldown'], false, false, false, array['band'], 2, false, false),
  ('run', 'running', 'Run', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, '{}'::text[], 1, false, false),
  ('row', 'rowing', 'Row', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, array['rower'], 1, false, false),
  ('bike', 'bike', 'Bike', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, array['bike'], 1, false, false),
  ('ski', 'ski', 'Ski', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, array['ski erg'], 1, false, false),
  ('burpee', 'burpee', 'Burpee', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, '{}'::text[], 4, false, false),
  ('box_step_up', 'jumping', 'Box step-up', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, array['box'], 3, false, false),
  ('air_squat', 'front_squat', 'Air squat', 'conditioning', 'beginner', array['warmup','conditioning'], false, false, false, '{}'::text[], 2, false, false),
  ('push_up', 'horizontal_press', 'Push-up', 'gymnastics', 'beginner', array['warmup','conditioning','accessory'], false, false, false, '{}'::text[], 3, false, false),
  ('pvc_pass_through', 'accessory', 'PVC pass-through', 'accessory', 'beginner', array['warmup'], false, false, false, array['PVC'], 2, false, false),
  ('empty_bar_overhead_squat', 'snatch', 'Empty-bar overhead squat', 'olympic_lifting', 'intermediate', array['warmup','skill'], false, true, false, array['barbell'], 4, true, false),
  ('empty_bar_clean_and_jerk', 'clean_and_jerk', 'Empty-bar clean and jerk', 'olympic_lifting', 'intermediate', array['warmup','skill'], false, true, false, array['barbell'], 8, true, false),
  ('glute_bridge', 'hinge', 'Glute bridge', 'accessory', 'beginner', array['warmup','accessory'], false, false, false, '{}'::text[], 2, false, false),
  ('scapular_pull_up', 'strict_pull', 'Scapular pull-up', 'gymnastics', 'beginner', array['warmup','skill'], false, false, false, array['pull-up bar'], 2, false, false);

alter table public.movement_families enable row level security;
alter table public.movements enable row level security;
alter table public.programming_engine_flags enable row level security;
alter table public.athlete_movement_restrictions enable row level security;

create policy "Authenticated athletes can read movement families"
  on public.movement_families for select
  to authenticated
  using (true);
create policy "Authenticated athletes can read movements"
  on public.movements for select
  to authenticated
  using (true);
create policy "Athletes can read their V2 flag"
  on public.programming_engine_flags for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Athletes can read their movement restrictions"
  on public.athlete_movement_restrictions for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Athletes can insert their movement restrictions"
  on public.athlete_movement_restrictions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Athletes can update their movement restrictions"
  on public.athlete_movement_restrictions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Athletes can delete their movement restrictions"
  on public.athlete_movement_restrictions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'training_programs',
    'training_blocks',
    'progression_tracks',
    'progression_steps',
    'training_weeks',
    'training_sessions',
    'session_progression_tracks',
    'session_sections',
    'exercise_prescriptions',
    'conditioning_prescriptions',
    'conditioning_movements',
    'warmup_prescriptions',
    'warmup_exercises',
    'equipment_transitions',
    'session_feedback',
    'exercise_results',
    'program_validation_results'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Athletes can read their own V2 rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end;
$policies$;

revoke all on table public.movement_families, public.movements from anon, authenticated;
grant select on table public.movement_families, public.movements to authenticated;

revoke all on table public.programming_engine_flags from anon, authenticated;
grant select on table public.programming_engine_flags to authenticated;

revoke all on table public.athlete_movement_restrictions from anon, authenticated;
grant select, insert, update, delete on table public.athlete_movement_restrictions to authenticated;

revoke all on table
  public.training_programs,
  public.training_blocks,
  public.progression_tracks,
  public.progression_steps,
  public.training_weeks,
  public.training_sessions,
  public.session_progression_tracks,
  public.session_sections,
  public.exercise_prescriptions,
  public.conditioning_prescriptions,
  public.conditioning_movements,
  public.warmup_prescriptions,
  public.warmup_exercises,
  public.equipment_transitions,
  public.session_feedback,
  public.exercise_results,
  public.program_validation_results
from anon, authenticated;

grant select on table
  public.training_programs,
  public.training_blocks,
  public.progression_tracks,
  public.progression_steps,
  public.training_weeks,
  public.training_sessions,
  public.session_progression_tracks,
  public.session_sections,
  public.exercise_prescriptions,
  public.conditioning_prescriptions,
  public.conditioning_movements,
  public.warmup_prescriptions,
  public.warmup_exercises,
  public.equipment_transitions,
  public.session_feedback,
  public.exercise_results,
  public.program_validation_results
to authenticated;

grant all on table
  public.movement_families,
  public.movements,
  public.programming_engine_flags,
  public.athlete_movement_restrictions,
  public.training_programs,
  public.training_blocks,
  public.progression_tracks,
  public.progression_steps,
  public.training_weeks,
  public.training_sessions,
  public.session_progression_tracks,
  public.session_sections,
  public.exercise_prescriptions,
  public.conditioning_prescriptions,
  public.conditioning_movements,
  public.warmup_prescriptions,
  public.warmup_exercises,
  public.equipment_transitions,
  public.session_feedback,
  public.exercise_results,
  public.program_validation_results
to service_role;

grant usage, select on all sequences in schema public to service_role;

create or replace function private.assert_valid_programming_engine_v2(
  p_program jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_block jsonb;
  v_week jsonb;
  v_session jsonb;
  v_exercise jsonb;
  v_conditioning jsonb;
  v_movement public.movements%rowtype;
  v_session_count integer := 0;
  v_week_count integer := 0;
  v_snatch_count integer := 0;
  v_clean_and_jerk_count integer := 0;
  v_section_total numeric;
begin
  if p_program is null or jsonb_typeof(p_program) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'V2 programme must be a JSON object.';
  end if;
  if p_program ->> 'engineVersion' is distinct from 'v2'
    or coalesce((p_program ->> 'schemaVersion')::integer, 0) <> 2
  then
    raise exception using errcode = '22023', message = 'Only programming-engine V2 schema version 2 can be saved.';
  end if;
  if coalesce((p_program #>> '{validation,valid}')::boolean, false) is not true
    or exists (
      select 1
      from jsonb_array_elements(coalesce(p_program #> '{validation,issues}', '[]'::jsonb)) as validation_issue
      where validation_issue ->> 'severity' = 'error'
    )
  then
    raise exception using errcode = '22023', message = 'A programme with validation errors cannot be saved.';
  end if;
  if jsonb_array_length(coalesce(p_program -> 'trainingBlocks', '[]'::jsonb)) <> 1 then
    raise exception using errcode = '22023', message = 'The initial V2 release requires exactly one training block.';
  end if;
  if lower(p_program::text) ~ '(clean or snatch|clean pulls or snatch pulls|or similar|as needed|challenging load|comfortable pace|pick a movement|choose a variation)' then
    raise exception using errcode = '22023', message = 'Programme contains prohibited ambiguous language.';
  end if;

  for v_block in
    select value from jsonb_array_elements(p_program -> 'trainingBlocks')
  loop
    if v_block ->> 'blockType' <> 'mixed_strength' then
      raise exception using errcode = '22023', message = 'Only mixed_strength is enabled in the initial V2 release.';
    end if;
    v_week_count := jsonb_array_length(coalesce(v_block -> 'trainingWeeks', '[]'::jsonb));
    if v_week_count <> 6 then
      raise exception using errcode = '22023', message = 'A mixed-strength block requires six weeks.';
    end if;
    for v_week in
      select value from jsonb_array_elements(v_block -> 'trainingWeeks')
    loop
      if jsonb_array_length(coalesce(v_week -> 'sessions', '[]'::jsonb)) <> 2 then
        raise exception using errcode = '22023', message = 'Each V2 training week requires two sessions.';
      end if;
      for v_session in
        select value from jsonb_array_elements(v_week -> 'sessions')
      loop
        v_session_count := v_session_count + 1;
        if coalesce((v_session ->> 'estimatedDurationMinutes')::numeric, 0) <= 0
          or (v_session ->> 'estimatedDurationMinutes')::numeric > 65
        then
          raise exception using errcode = '22023', message = 'A session duration must be present and no higher than 65 minutes.';
        end if;
        select coalesce(sum((section ->> 'estimatedDurationMinutes')::numeric), 0)
        into v_section_total
        from jsonb_array_elements(coalesce(v_session -> 'sections', '[]'::jsonb)) as section;
        if abs(v_section_total - (v_session ->> 'estimatedDurationMinutes')::numeric) > 1 then
          raise exception using errcode = '22023', message = 'Session section durations must match the session estimate.';
        end if;
        if jsonb_array_length(coalesce(v_session -> 'exercises', '[]'::jsonb)) < 2 then
          raise exception using errcode = '22023', message = 'Each V2 session requires structured progression exercises.';
        end if;
        for v_exercise in
          select value from jsonb_array_elements(v_session -> 'exercises')
        loop
          if nullif(btrim(v_exercise ->> 'movementId'), '') is null
            or coalesce((v_exercise ->> 'sets')::integer, 0) <= 0
            or coalesce((v_exercise ->> 'restSeconds')::integer, -1) < 0
            or coalesce((v_exercise ->> 'estimatedDurationMinutes')::numeric, 0) <= 0
          then
            raise exception using errcode = '22023', message = 'Exercise movement, sets, rest, and duration are required.';
          end if;
          if (v_exercise ->> 'reps') is null
            and (v_exercise ->> 'repRangeMin') is null
            and (v_exercise ->> 'durationSeconds') is null
            and (v_exercise ->> 'distanceMeters') is null
            and (v_exercise ->> 'calories') is null
          then
            raise exception using errcode = '22023', message = 'Exercise repetitions or duration are required.';
          end if;
          select * into v_movement
          from public.movements
          where id = v_exercise ->> 'movementId';
          if not found then
            raise exception using errcode = '22023', message = 'Exercise references an unknown movement.';
          end if;
          if v_movement.family_id <> v_exercise ->> 'movementFamilyId' then
            raise exception using errcode = '22023', message = 'Exercise movement family does not match the catalog.';
          end if;
          if v_movement.loadable
            and v_exercise ->> 'intensityMethod' not in ('percentage_1rm', 'percentage_training_max', 'rpe', 'rir', 'fixed_load', 'quality')
          then
            raise exception using errcode = '22023', message = 'Loaded movement is missing measurable load guidance.';
          end if;
          if v_movement.category = 'gymnastics'
            and (
              nullif(btrim(v_exercise ->> 'progressionObjective'), '') is null
              or nullif(btrim(v_exercise ->> 'stoppingRule'), '') is null
              or jsonb_array_length(coalesce(v_exercise -> 'scalingOptions', '[]'::jsonb)) = 0
            )
          then
            raise exception using errcode = '22023', message = 'Gymnastics requires an objective, stopping rule, and measurable scaling.';
          end if;
          if v_exercise ->> 'movementFamilyId' = 'snatch' then
            v_snatch_count := v_snatch_count + 1;
          elsif v_exercise ->> 'movementFamilyId' = 'clean_and_jerk' then
            v_clean_and_jerk_count := v_clean_and_jerk_count + 1;
          end if;
        end loop;
        v_conditioning := v_session -> 'conditioning';
        if v_conditioning is null
          or jsonb_typeof(v_conditioning) is distinct from 'object'
          or nullif(btrim(v_conditioning ->> 'intendedStimulus'), '') is null
          or jsonb_array_length(coalesce(v_conditioning -> 'movements', '[]'::jsonb)) = 0
          or jsonb_array_length(coalesce(v_conditioning -> 'scalingOptions', '[]'::jsonb)) = 0
        then
          raise exception using errcode = '22023', message = 'Conditioning format, movements, stimulus, and scaling are required.';
        end if;
        if v_conditioning ->> 'format' = 'intervals'
          and (v_conditioning ->> 'restSeconds') is null
        then
          raise exception using errcode = '22023', message = 'Conditioning intervals require rest.';
        end if;
      end loop;
    end loop;
  end loop;
  if v_session_count <> 12 then
    raise exception using errcode = '22023', message = 'A six-week two-day block requires twelve sessions.';
  end if;
  if v_snatch_count = 0 or v_clean_and_jerk_count = 0 then
    raise exception using errcode = '22023', message = 'A mixed-strength block requires snatch and clean-and-jerk exposure.';
  end if;
end;
$function$;

revoke all on function private.assert_valid_programming_engine_v2(jsonb) from public, anon, authenticated;

create or replace function private.save_programming_engine_v2(
  p_program jsonb,
  p_expected_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_program_id uuid;
  v_existing_user_id uuid;
  v_existing_revision integer;
  v_revision integer;
  v_block jsonb;
  v_track jsonb;
  v_step jsonb;
  v_week jsonb;
  v_session jsonb;
  v_assignment jsonb;
  v_section jsonb;
  v_exercise jsonb;
  v_conditioning jsonb;
  v_conditioning_movement jsonb;
  v_warmup jsonb;
  v_warmup_exercise jsonb;
  v_transition jsonb;
  v_feedback jsonb;
  v_result jsonb;
  v_validation_issue jsonb;
  v_order integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required to save a V2 programme.';
  end if;
  perform private.assert_valid_programming_engine_v2(p_program);

  begin
    v_program_id := (p_program ->> 'id')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'V2 programme id must be a UUID.';
  end;
  if (p_program ->> 'ownerId') is not null
    and (p_program ->> 'ownerId')::uuid <> v_user_id
  then
    raise exception using errcode = '42501', message = 'V2 programme ownership does not match the authenticated athlete.';
  end if;

  select user_id, revision
  into v_existing_user_id, v_existing_revision
  from public.training_programs
  where id = v_program_id
  for update;

  if found and v_existing_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Athletes cannot replace another athlete''s programme.';
  end if;
  if found and p_expected_revision is null then
    raise exception using errcode = '40001', message = 'Expected revision is required when replacing an existing programme.';
  end if;
  if found and p_expected_revision <> v_existing_revision then
    raise exception using errcode = '40001', message = 'PROGRAM_REVISION_CONFLICT';
  end if;
  if not found and p_expected_revision is not null and p_expected_revision <> 0 then
    raise exception using errcode = '40001', message = 'PROGRAM_REVISION_CONFLICT';
  end if;
  v_revision := coalesce(v_existing_revision, 0) + 1;

  insert into public.training_programs (
    id, user_id, engine_version, schema_version, template_version,
    catalog_version, validator_version, name, status,
    active_training_block_id, revision, validated_snapshot,
    created_at, updated_at
  )
  values (
    v_program_id,
    v_user_id,
    'v2',
    (p_program ->> 'schemaVersion')::integer,
    p_program ->> 'templateVersion',
    (p_program ->> 'catalogVersion')::integer,
    (p_program ->> 'validatorVersion')::integer,
    p_program ->> 'name',
    p_program ->> 'status',
    null,
    v_revision,
    p_program,
    (p_program ->> 'createdAt')::timestamptz,
    (p_program ->> 'updatedAt')::timestamptz
  )
  on conflict (id) do update
  set engine_version = excluded.engine_version,
      schema_version = excluded.schema_version,
      template_version = excluded.template_version,
      catalog_version = excluded.catalog_version,
      validator_version = excluded.validator_version,
      name = excluded.name,
      status = excluded.status,
      active_training_block_id = null,
      revision = excluded.revision,
      validated_snapshot = excluded.validated_snapshot,
      updated_at = excluded.updated_at
  where public.training_programs.user_id = v_user_id;

  -- Exercise prescriptions reference both sessions (cascade) and progression
  -- tracks (set null).  Deleting a whole block lets PostgreSQL visit those two
  -- dependency paths in an unspecified order, which can briefly attempt to
  -- null the track on an exercise whose session has already been removed.
  -- Remove the shared child explicitly so programme replacement stays atomic.
  delete from public.exercise_prescriptions
  where session_id in (
    select session.id
    from public.training_sessions as session
    join public.training_weeks as week
      on week.id = session.training_week_id
    join public.training_blocks as block
      on block.id = week.training_block_id
    where block.program_id = v_program_id
  );

  delete from public.program_validation_results
  where program_id = v_program_id;

  delete from public.training_blocks where program_id = v_program_id;

  for v_block in
    select value from jsonb_array_elements(p_program -> 'trainingBlocks')
  loop
    insert into public.training_blocks (
      id, user_id, program_id, block_type, name, goal, duration_weeks,
      current_week, status, deload_week, started_at, completed_at,
      created_at, updated_at
    ) values (
      (v_block ->> 'id')::uuid,
      v_user_id,
      v_program_id,
      v_block ->> 'blockType',
      v_block ->> 'name',
      v_block ->> 'goal',
      (v_block ->> 'durationWeeks')::integer,
      (v_block ->> 'currentWeek')::integer,
      v_block ->> 'status',
      nullif(v_block ->> 'deloadWeek', '')::integer,
      nullif(v_block ->> 'startedAt', '')::timestamptz,
      nullif(v_block ->> 'completedAt', '')::timestamptz,
      (v_block ->> 'createdAt')::timestamptz,
      (v_block ->> 'updatedAt')::timestamptz
    );

    for v_track in
      select value from jsonb_array_elements(v_block -> 'progressionTracks')
    loop
      insert into public.progression_tracks (
        id, user_id, training_block_id, track_type, movement_family_id,
        current_step, total_steps, status, consecutive_failures, metadata,
        created_at, updated_at
      ) values (
        (v_track ->> 'id')::uuid,
        v_user_id,
        (v_block ->> 'id')::uuid,
        v_track ->> 'trackType',
        v_track ->> 'movementFamilyId',
        (v_track ->> 'currentStep')::integer,
        (v_track ->> 'totalSteps')::integer,
        v_track ->> 'status',
        (v_track ->> 'consecutiveFailures')::integer,
        v_track -> 'metadata',
        (v_track ->> 'createdAt')::timestamptz,
        (v_track ->> 'updatedAt')::timestamptz
      );

      for v_step in
        select value from jsonb_array_elements(v_track -> 'steps')
      loop
        insert into public.progression_steps (
          id, user_id, progression_track_id, step_number, week_number,
          movement_id, movement_family_id, sets, reps, rep_range_min,
          rep_range_max, intensity_method, intensity_min, intensity_max,
          rest_seconds, tempo, pause_description, technical_intent,
          estimated_duration_minutes
        ) values (
          (v_step ->> 'id')::uuid,
          v_user_id,
          (v_track ->> 'id')::uuid,
          (v_step ->> 'stepNumber')::integer,
          (v_step ->> 'weekNumber')::integer,
          nullif(v_step ->> 'movementId', ''),
          v_step ->> 'movementFamilyId',
          nullif(v_step ->> 'sets', '')::integer,
          nullif(v_step ->> 'reps', '')::integer,
          nullif(v_step ->> 'repRangeMin', '')::integer,
          nullif(v_step ->> 'repRangeMax', '')::integer,
          v_step ->> 'intensityMethod',
          nullif(v_step ->> 'intensityMin', '')::numeric,
          nullif(v_step ->> 'intensityMax', '')::numeric,
          nullif(v_step ->> 'restSeconds', '')::integer,
          nullif(v_step ->> 'tempo', ''),
          nullif(v_step ->> 'pauseDescription', ''),
          v_step ->> 'technicalIntent',
          (v_step ->> 'estimatedDurationMinutes')::numeric
        );
      end loop;
    end loop;

    for v_week in
      select value from jsonb_array_elements(v_block -> 'trainingWeeks')
    loop
      insert into public.training_weeks (
        id, user_id, training_block_id, week_number, theme, status
      ) values (
        (v_week ->> 'id')::uuid,
        v_user_id,
        (v_block ->> 'id')::uuid,
        (v_week ->> 'weekNumber')::integer,
        v_week ->> 'theme',
        v_week ->> 'status'
      );

      for v_session in
        select value from jsonb_array_elements(v_week -> 'sessions')
      loop
        insert into public.training_sessions (
          id, user_id, training_week_id, session_number, week_number,
          objective, intended_stimulus, expected_fatigue, fatigue_focus,
          community_workout_advice, duration_target_minutes,
          estimated_duration_minutes, duration_validation_status,
          provisional, status, revision, stress, created_at, updated_at
        ) values (
          (v_session ->> 'id')::uuid,
          v_user_id,
          (v_week ->> 'id')::uuid,
          (v_session ->> 'sessionNumber')::integer,
          (v_session ->> 'weekNumber')::integer,
          v_session ->> 'objective',
          v_session ->> 'intendedStimulus',
          v_session ->> 'expectedFatigue',
          v_session ->> 'fatigueFocus',
          v_session ->> 'communityWorkoutAdvice',
          (v_session ->> 'durationTargetMinutes')::integer,
          (v_session ->> 'estimatedDurationMinutes')::numeric,
          v_session ->> 'durationValidationStatus',
          (v_session ->> 'provisional')::boolean,
          v_session ->> 'status',
          (v_session ->> 'revision')::integer,
          v_session -> 'stress',
          (v_session ->> 'createdAt')::timestamptz,
          (v_session ->> 'updatedAt')::timestamptz
        );

        for v_assignment in
          select value from jsonb_array_elements(v_session -> 'trackAssignments')
        loop
          insert into public.session_progression_tracks (
            session_id, progression_track_id, user_id,
            progression_step_number, role
          ) values (
            (v_session ->> 'id')::uuid,
            (v_assignment ->> 'progressionTrackId')::uuid,
            v_user_id,
            (v_assignment ->> 'progressionStepNumber')::integer,
            v_assignment ->> 'role'
          );
        end loop;

        for v_section in
          select value from jsonb_array_elements(v_session -> 'sections')
        loop
          insert into public.session_sections (
            id, user_id, session_id, section, section_order,
            estimated_duration_minutes
          ) values (
            (v_section ->> 'id')::uuid,
            v_user_id,
            (v_session ->> 'id')::uuid,
            v_section ->> 'section',
            (v_section ->> 'order')::integer,
            (v_section ->> 'estimatedDurationMinutes')::numeric
          );
        end loop;

        for v_exercise in
          select value from jsonb_array_elements(v_session -> 'exercises')
        loop
          insert into public.exercise_prescriptions (
            id, user_id, session_id, progression_track_id,
            progression_step_number, group_id, section, movement_id,
            movement_name, movement_family_id, sets, reps, rep_range_min,
            rep_range_max, duration_seconds, distance_meters, calories,
            intensity_method, intensity_value, intensity_max, load_kg,
            reference_max_kg, reference_lift, rest_seconds, tempo,
            pause_description, technical_intent, progression_objective,
            stopping_rule, coaching_cues, scaling_options, equipment,
            warmup_set_count, setup_minutes, estimated_duration_minutes
          ) values (
            (v_exercise ->> 'id')::uuid,
            v_user_id,
            (v_session ->> 'id')::uuid,
            nullif(v_exercise ->> 'progressionTrackId', '')::uuid,
            nullif(v_exercise ->> 'progressionStepNumber', '')::integer,
            nullif(v_exercise ->> 'groupId', '')::uuid,
            v_exercise ->> 'section',
            v_exercise ->> 'movementId',
            v_exercise ->> 'movementName',
            v_exercise ->> 'movementFamilyId',
            (v_exercise ->> 'sets')::integer,
            nullif(v_exercise ->> 'reps', '')::integer,
            nullif(v_exercise ->> 'repRangeMin', '')::integer,
            nullif(v_exercise ->> 'repRangeMax', '')::integer,
            nullif(v_exercise ->> 'durationSeconds', '')::integer,
            nullif(v_exercise ->> 'distanceMeters', '')::integer,
            nullif(v_exercise ->> 'calories', '')::integer,
            v_exercise ->> 'intensityMethod',
            nullif(v_exercise ->> 'intensityValue', '')::numeric,
            nullif(v_exercise ->> 'intensityMax', '')::numeric,
            nullif(v_exercise ->> 'loadKg', '')::numeric,
            nullif(v_exercise ->> 'referenceMaxKg', '')::numeric,
            nullif(v_exercise ->> 'referenceLift', ''),
            (v_exercise ->> 'restSeconds')::integer,
            nullif(v_exercise ->> 'tempo', ''),
            nullif(v_exercise ->> 'pauseDescription', ''),
            v_exercise ->> 'technicalIntent',
            nullif(v_exercise ->> 'progressionObjective', ''),
            nullif(v_exercise ->> 'stoppingRule', ''),
            v_exercise -> 'coachingCues',
            v_exercise -> 'scalingOptions',
            array(select jsonb_array_elements_text(coalesce(v_exercise -> 'equipment', '[]'::jsonb))),
            (v_exercise ->> 'warmupSetCount')::integer,
            (v_exercise ->> 'setupMinutes')::numeric,
            (v_exercise ->> 'estimatedDurationMinutes')::numeric
          );
        end loop;

        v_conditioning := v_session -> 'conditioning';
        if v_conditioning is not null and jsonb_typeof(v_conditioning) = 'object' then
          insert into public.conditioning_prescriptions (
            id, user_id, session_id, format, duration_minutes, rounds,
            time_cap_minutes, work_seconds, rest_seconds, intended_stimulus,
            target_duration_min, target_duration_max, target_rpe,
            scaling_options, estimated_duration_minutes
          ) values (
            (v_conditioning ->> 'id')::uuid,
            v_user_id,
            (v_session ->> 'id')::uuid,
            v_conditioning ->> 'format',
            nullif(v_conditioning ->> 'durationMinutes', '')::integer,
            nullif(v_conditioning ->> 'rounds', '')::integer,
            nullif(v_conditioning ->> 'timeCapMinutes', '')::integer,
            nullif(v_conditioning ->> 'workSeconds', '')::integer,
            nullif(v_conditioning ->> 'restSeconds', '')::integer,
            v_conditioning ->> 'intendedStimulus',
            nullif(v_conditioning ->> 'targetDurationMin', '')::integer,
            nullif(v_conditioning ->> 'targetDurationMax', '')::integer,
            nullif(v_conditioning ->> 'targetRpe', '')::numeric,
            v_conditioning -> 'scalingOptions',
            (v_conditioning ->> 'estimatedDurationMinutes')::numeric
          );
          v_order := 0;
          for v_conditioning_movement in
            select value from jsonb_array_elements(v_conditioning -> 'movements')
          loop
            v_order := v_order + 1;
            insert into public.conditioning_movements (
              user_id, conditioning_id, movement_order, movement_id,
              movement_name, movement_family_id, reps, calories,
              distance_meters, duration_seconds, load_kg,
              percentage_reference, equipment
            ) values (
              v_user_id,
              (v_conditioning ->> 'id')::uuid,
              v_order,
              v_conditioning_movement ->> 'movementId',
              v_conditioning_movement ->> 'movementName',
              v_conditioning_movement ->> 'movementFamilyId',
              nullif(v_conditioning_movement ->> 'reps', '')::integer,
              nullif(v_conditioning_movement ->> 'calories', '')::integer,
              nullif(v_conditioning_movement ->> 'distanceMeters', '')::integer,
              nullif(v_conditioning_movement ->> 'durationSeconds', '')::integer,
              nullif(v_conditioning_movement ->> 'loadKg', '')::numeric,
              nullif(v_conditioning_movement ->> 'percentageReference', '')::numeric,
              array(select jsonb_array_elements_text(coalesce(v_conditioning_movement -> 'equipment', '[]'::jsonb)))
            );
          end loop;
        end if;

        v_warmup := v_session -> 'warmup';
        insert into public.warmup_prescriptions (
          id, user_id, session_id, duration_minutes, rounds, purpose
        ) values (
          (v_warmup ->> 'id')::uuid,
          v_user_id,
          (v_session ->> 'id')::uuid,
          (v_warmup ->> 'durationMinutes')::integer,
          nullif(v_warmup ->> 'rounds', '')::integer,
          v_warmup ->> 'purpose'
        );
        v_order := 0;
        for v_warmup_exercise in
          select value from jsonb_array_elements(v_warmup -> 'exercises')
        loop
          v_order := v_order + 1;
          insert into public.warmup_exercises (
            user_id, warmup_id, exercise_order, movement_id, movement_name,
            reps, duration_seconds, distance_meters, equipment
          ) values (
            v_user_id,
            (v_warmup ->> 'id')::uuid,
            v_order,
            v_warmup_exercise ->> 'movementId',
            v_warmup_exercise ->> 'movementName',
            nullif(v_warmup_exercise ->> 'reps', '')::integer,
            nullif(v_warmup_exercise ->> 'durationSeconds', '')::integer,
            nullif(v_warmup_exercise ->> 'distanceMeters', '')::integer,
            array(select jsonb_array_elements_text(coalesce(v_warmup_exercise -> 'equipment', '[]'::jsonb)))
          );
        end loop;

        v_order := 0;
        for v_transition in
          select value from jsonb_array_elements(v_session -> 'equipmentTransitions')
        loop
          v_order := v_order + 1;
          insert into public.equipment_transitions (
            user_id, session_id, transition_order, from_equipment,
            to_equipment, estimated_minutes
          ) values (
            v_user_id,
            (v_session ->> 'id')::uuid,
            v_order,
            array(select jsonb_array_elements_text(coalesce(v_transition -> 'fromEquipment', '[]'::jsonb))),
            array(select jsonb_array_elements_text(coalesce(v_transition -> 'toEquipment', '[]'::jsonb))),
            (v_transition ->> 'estimatedMinutes')::numeric
          );
        end loop;

        v_feedback := v_session -> 'feedback';
        if v_feedback is not null and jsonb_typeof(v_feedback) = 'object' then
          insert into public.session_feedback (
            session_id, user_id, completed, session_rpe, fatigue,
            pain_reported, duration_minutes_actual, notes, completed_at
          ) values (
            (v_session ->> 'id')::uuid,
            v_user_id,
            (v_feedback ->> 'completed')::boolean,
            nullif(v_feedback ->> 'sessionRpe', '')::numeric,
            nullif(v_feedback ->> 'fatigue', '')::numeric,
            (v_feedback ->> 'painReported')::boolean,
            nullif(v_feedback ->> 'durationMinutesActual', '')::integer,
            nullif(v_feedback ->> 'notes', ''),
            (v_feedback ->> 'completedAt')::timestamptz
          );
          for v_result in
            select value from jsonb_array_elements(v_feedback -> 'results')
          loop
            insert into public.exercise_results (
              prescription_id, user_id, progression_track_id,
              completed_sets, completed_reps, load_kg, achieved_rpe,
              successful, pain_reported
            ) values (
              (v_result ->> 'prescriptionId')::uuid,
              v_user_id,
              (v_result ->> 'progressionTrackId')::uuid,
              (v_result ->> 'completedSets')::integer,
              (v_result ->> 'completedReps')::integer,
              nullif(v_result ->> 'loadKg', '')::numeric,
              nullif(v_result ->> 'achievedRpe', '')::numeric,
              (v_result ->> 'successful')::boolean,
              (v_result ->> 'painReported')::boolean
            );
          end loop;
        end if;
      end loop;
    end loop;
  end loop;

  for v_validation_issue in
    select value from jsonb_array_elements(coalesce(p_program #> '{validation,issues}', '[]'::jsonb))
  loop
    insert into public.program_validation_results (
      user_id, program_id, validator_version, code, severity,
      issue_path, message
    ) values (
      v_user_id,
      v_program_id,
      (p_program ->> 'validatorVersion')::integer,
      v_validation_issue ->> 'code',
      v_validation_issue ->> 'severity',
      v_validation_issue ->> 'path',
      v_validation_issue ->> 'message'
    );
  end loop;

  update public.training_programs
  set active_training_block_id = (p_program ->> 'activeTrainingBlockId')::uuid
  where id = v_program_id and user_id = v_user_id;

  return jsonb_build_object(
    'programId', v_program_id,
    'revision', v_revision,
    'updatedAt', p_program ->> 'updatedAt'
  );
end;
$function$;

revoke all on function private.save_programming_engine_v2(jsonb, integer) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.save_programming_engine_v2(jsonb, integer) to authenticated;

create or replace function public.save_programming_engine_v2(
  p_program jsonb,
  p_expected_revision integer default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.save_programming_engine_v2(p_program, p_expected_revision);
$function$;

create or replace function public.load_programming_engine_v2(
  p_program_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'program', validated_snapshot,
    'revision', revision
  )
  from public.training_programs
  where id = p_program_id
    and user_id = (select auth.uid());
$function$;

create or replace function public.load_active_programming_engine_v2()
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'program', validated_snapshot,
    'revision', revision
  )
  from public.training_programs
  where user_id = (select auth.uid())
    and status = 'active'
  order by updated_at desc
  limit 1;
$function$;

revoke all on function public.save_programming_engine_v2(jsonb, integer) from public, anon;
revoke all on function public.load_programming_engine_v2(uuid) from public, anon;
revoke all on function public.load_active_programming_engine_v2() from public, anon;
grant execute on function public.save_programming_engine_v2(jsonb, integer) to authenticated;
grant execute on function public.load_programming_engine_v2(uuid) to authenticated;
grant execute on function public.load_active_programming_engine_v2() to authenticated;

create or replace function public.replace_athlete_movement_restrictions(
  p_restrictions jsonb
)
returns setof public.athlete_movement_restrictions
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_restriction jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required to edit movement restrictions.';
  end if;
  if p_restrictions is null or jsonb_typeof(p_restrictions) <> 'array' then
    raise exception using errcode = '22023', message = 'Movement restrictions must be a JSON array.';
  end if;
  delete from public.athlete_movement_restrictions where user_id = v_user_id;
  for v_restriction in select value from jsonb_array_elements(p_restrictions)
  loop
    if ((v_restriction ->> 'movement_id') is null) = ((v_restriction ->> 'movement_family_id') is null) then
      raise exception using errcode = '22023', message = 'Each restriction must identify exactly one movement or movement family.';
    end if;
    insert into public.athlete_movement_restrictions (
      user_id, movement_id, movement_family_id, guidance
    ) values (
      v_user_id,
      nullif(v_restriction ->> 'movement_id', ''),
      nullif(v_restriction ->> 'movement_family_id', ''),
      nullif(v_restriction ->> 'guidance', '')
    );
  end loop;
  return query
  select * from public.athlete_movement_restrictions
  where user_id = v_user_id
  order by created_at, id;
end;
$function$;

revoke all on function public.replace_athlete_movement_restrictions(jsonb) from public, anon;
grant execute on function public.replace_athlete_movement_restrictions(jsonb) to authenticated;
