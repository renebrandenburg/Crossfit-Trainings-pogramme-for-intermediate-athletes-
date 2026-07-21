create table if not exists public.athlete_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint athlete_states_schema_version_valid
    check (schema_version between 1 and 100),
  constraint athlete_states_state_valid
    check (
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
    ),
  constraint athlete_states_state_size_valid
    check (octet_length(state::text) <= 5242880),
  constraint athlete_states_updated_at_finite
    check (isfinite(updated_at))
);

alter table public.athlete_states enable row level security;

drop policy if exists "Users can read their athlete state"
  on public.athlete_states;
drop policy if exists "Users can insert their athlete state"
  on public.athlete_states;
drop policy if exists "Users can update their athlete state"
  on public.athlete_states;

create policy "Users can read their athlete state"
  on public.athlete_states for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their athlete state"
  on public.athlete_states for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their athlete state"
  on public.athlete_states for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.athlete_states
  from public, anon, authenticated;
grant select, insert, update on table public.athlete_states
  to authenticated;

create or replace function public.guard_athlete_state_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.user_id is distinct from old.user_id then
    raise exception using
      errcode = '22023',
      message = 'Athlete-state ownership cannot change.';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists athlete_states_guard_update
  on public.athlete_states;
create trigger athlete_states_guard_update
before update on public.athlete_states
for each row
execute function public.guard_athlete_state_update();

revoke all on function public.guard_athlete_state_update()
  from public, anon, authenticated, service_role;
