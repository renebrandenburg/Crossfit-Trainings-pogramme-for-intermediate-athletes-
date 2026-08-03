# CrossFit Programming Engine V2

## Architecture summary

### Previous architecture (V1)

V1 builds an eight-week plan in `app.js`. Generator helpers select movements,
assemble workout definitions, derive some athlete-facing strings, validate the
result, and store the complete plan in the owner-scoped athlete-state document.
`react-app.js` renders that plan and handles regeneration and logging. This
format remains the source of truth for existing plans and manual free-text
sessions.

The important V1 risk is coupling: generation, progression decisions, text
formatting, and some compatibility migration live in the same JavaScript
domain. A regeneration can replace a plan-level result, and old free-text data
cannot safely be reinterpreted as an exact structured prescription.

### V2 architecture

V2 is an additive, strict-TypeScript domain under `src/programming-v2`. Its
hierarchy is:

```text
Programme
└── Training block
    ├── Progression tracks and immutable steps
    └── Six training weeks
        └── Two, three, or four sessions
            ├── Warm-up
            ├── Primary progression
            ├── Secondary progression
            ├── Conditioning
            ├── Accessory/cooldown
            └── Equipment transitions
```

The deterministic template decides the block, movement family, progression
step, intensity range, fatigue, conditioning budget, and section budgets before
anything is rendered. Athlete-facing text is derived only from the validated
structured graph. The AI adapter is deliberately disabled in the first rollout;
future AI output must pass through the same structured validator and save RPC.

Core responsibilities:

- `types.ts`: versioned domain contracts.
- `catalog.ts`: canonical movement families, purposes, contexts, equipment, and
  clean/snatch separation.
- `template.ts`: reusable six-week mixed-strength progression steps.
- `engine.ts`: deterministic session materialization, restrictions, fatigue,
  equipment selection, and duration adjustment.
- `duration.ts`: calculated work, rest, setup, warm-up-set, transition, and
  conditioning time plus working-weight rounding.
- `validation.ts`: central programme/block/week/session/exercise/conditioning,
  language, movement-balance, fatigue, and duration validation.
- `format.ts`: athlete-facing text derived from the final structured object.
- `state.ts`: scoped regeneration, optimistic session revisions, completion,
  pain handling, and track advancement.
- `adapters.ts`: feature-flag resolution and deterministic/controlled-AI
  boundaries.

## Generation behaviour

The initial template is a six-week `mixed_strength` block with two sessions per
week:

- Day 1: front squat, snatch progression, short mixed conditioning, and a small
  trunk/posterior-chain accessory.
- Day 2: clean and jerk, strict-pull/gymnastics progression, longer engine work,
  and core/carry/shoulder-health accessory work.
- Week 6: front-squat and Olympic-lifting deload with reduced conditioning and
  gymnastics volume.

Snatch and clean-and-jerk are independent tracks. A movement restriction never
silently turns one Olympic family into another. Unknown maximums produce a
bounded RPE prescription rather than an invented kilogram load. Equipment and
movement-family restrictions are applied before materialization.

The engine validates the exact final graph after all sections are assembled.
Invalid graphs are neither returned by the persistence gate nor rendered by the
V2 React panel.

## New-programme policy and compatibility

V2 is now the only generator for newly created programmes. The template registry
selects frequency and goal-specific deterministic blocks (mixed strength,
endurance, gymnastics/bar muscle-up, Masters/Open, and deload metadata) without
moving business logic into React. V1 generation is retired, but existing V1
plans remain read-only compatible, including their logs, calendar events,
feedback, and free-text sessions. Athletes can create a validated V2 replacement
from the Builder and roll back to the original V1 plan during rollout. Ambiguous
V1 text is never invented as structured V2 exercise data.

V2 appears in Today and Calendar as well as Builder. Debug information reports
the active engine, template, migration status, and V1 compatibility mode.

## Regeneration and completion

Regeneration scopes are `warmup`, `conditioning`, `accessory`, and
`full_session`. All preserve the block, week, session objective, progression
track IDs, progression step numbers, movement-family requirements, fatigue, and
duration ceiling. Regeneration never advances a track.

Completion requires one result for each assigned progression track. Successful
completion advances the track and rematerializes only its next linked section.
RPE 9 or higher selects the low end of the next range. A first failed result
repeats the step; a repeated failure regresses it. A skipped session does not
advance. Reported pain pauses affected tracks and blocks their next linked
session until review.

The first adaptive implementation is intentionally conservative. It records
actual duration but does not yet learn new duration coefficients automatically.

## Duration estimation

`calculateSessionDuration` derives duration from structured prescriptions:

- execution time per repetition or timed effort;
- working sets, warm-up sets, and safe inter-set rest;
- setup and plate changes;
- programmed conditioning duration, time cap, or intervals;
- equipment/location transitions; and
- explicit warm-up and cooldown minutes.

Normal sessions target 50–60 minutes. Week 6 may be 45–55 minutes. A result from
61–65 minutes is a warning and anything above 65 minutes is an error. When a
session is too long, adjustment removes/reduces accessory work first, simplifies
transitions, shortens conditioning, and only then reduces secondary volume. It
does not change the primary progression or shorten required rest.

## Validation and athlete-facing language

Errors block persistence and rendering. The rules cover missing/unknown
movements, alternatives, family mismatches, invalid contexts, missing sets or
targets, missing intensity, unloaded holds, missing rest, incomplete
gymnastics/scaling/stopping rules, invalid conditioning formats, missing
stimulus, section-total mismatches, sessions over 65 minutes, and mixed blocks
without both Olympic-lift exposures.

The final string-level guard also rejects prohibited or non-measurable language.
The two historical regressions are permanent fixtures:

```text
Gymnastics skill: hollow and arch control, strict pulling, and midline strength
3 sets: 3 tall snatch pulls + 20-second overhead hold
```

The generated UI instead shows measurable rounds/sets, reps or seconds, rest,
strict-movement scaling, a percentage/RPE/load reference, calculated working
weight, intent, and section time.

## Persistence and database migration

Migration `20260802184904_add_programming_engine_v2.sql` adds normalized public
tables for movement families/movements, programmes, blocks, tracks, steps,
weeks, sessions, assignments, sections, exercise/conditioning/warm-up
prescriptions, transitions, feedback/results, validation results, restrictions,
and per-user feature flags.

Stable entities use foreign keys and checks; flexible metadata and validated
snapshots use JSONB. Foreign-key and RLS owner columns are indexed. RLS is
enabled on every exposed table, anonymous graph access is revoked, and owner
policies use cached `auth.uid()` expressions. Direct graph writes are denied.

`save_programming_engine_v2` is the only application write path. Its private
security-definer implementation verifies `auth.uid()`, validates the exact
payload again inside Postgres, locks existing programme rows, checks an expected
revision, and replaces the normalized graph atomically. The validated snapshot
is a load cache, not an unvalidated source. The transaction rolls back if any
child row fails.

Apply the migration using the normal reviewed Supabase CLI flow. A practical
rollback is to disable all `programming_engine_flags` first, retain the V1
athlete-state document, export any V2 feedback that must be kept, then drop the
V2 RPCs/private validator and V2 tables in reverse dependency order. The
migration intentionally does not modify or reinterpret V1 plans, so disabling
the flag restores V1 behaviour without data conversion.

Generated public-schema types are committed at `types/database.types.ts`.

## Feature flag and compatibility

The flag is `crossfit_programming_engine_v2` in application code and a
per-athlete `programming_engine_flags.v2_enabled` row in Supabase. Production
requires an authenticated allowlisted athlete. Local development is enabled
automatically on `localhost`, `127.0.0.1` and the IPv6 loopback address; query
parameters and localStorage cannot bypass the production allowlist.
Structured, note-free generation records can be enabled explicitly with
`localStorage["forge-hour-v2-debug"] = "true"`.

V1 plans remain readable and render through the V1 UI. New V2 blocks are stored
separately in `v2Programs`; old free-text prescriptions are never silently
parsed into structured V2 data. Missing V2 migrations or flag reads degrade to
V1 rather than breaking account hydration.

## Test coverage

- Unit/invariant tests: full 12-session generation, progressions/deload,
  clean/snatch separation, exact regression strings, percentage rounding,
  unknown-max fallback, duration bounds, restrictions, scoped regeneration,
  completion/failure/pain behaviour, and the final persistence gate.
- React DOM test: generates the exact V2 section, verifies load/rest/scaling and
  calculated weights, and proves both incomplete strings are absent.
- Database pgTAP: schema, grants, RLS, ownership spoofing, feature flags,
  required constraints, and invalid save rejection.
- Generated database integration fixture: saves all 12 sessions, reloads the
  normalized graph, regenerates with optimistic locking, and verifies revision
  conflict behaviour.
- Playwright: generation, DOM prescription visibility, regeneration
  preservation, completion advancement, reload persistence, and V1 coverage.

## Known limitations and next improvements

- Goal-specific templates currently share the validated six-week materialization
  fallback while their movement-specific variations are reviewed incrementally.
- Controlled AI warm-up/conditioning/cue adapters are not enabled. Deterministic
  fallbacks are used exclusively in V2's first rollout.
- Actual-duration discrepancies are stored but not yet used to tune coefficients.
- Community workouts remain unknown by design; the engine provides placement
  advice and fatigue warnings rather than predicting affiliate programming.
- Administrators currently manage the allowlist in Supabase; a safe admin UI is
  a future improvement.

Recommended follow-up: run a selected-athlete rollout, compare estimates with
actual duration for a full block, tune coefficients, add one block template at a
time, and only then introduce controlled AI variations behind their own flag.
