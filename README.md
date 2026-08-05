# CrossFit Training Programme

A phone-first, box-aware CrossFit coach and progression tracker for intermediate athletes.

## What is included

- Configurable two-, three-, or four-day app programming, with intentional two-day progression sessions designed to complement CrossFit box workouts.
- Eight-week progression cycle with recalculated loads from the athlete's 1RMs.
- A **Today** coach that combines a ten-second readiness check, pasted box WOD parsing, conflict detection, and an explained Train, Scale, Swap, or Rest decision.
- A real dated **Calendar** with move, swap, skip, resume, box-workout, and rest-day actions while completed work stays anchored to its log date.
- Needs-based programme generator for strength, endurance, gymnastics, running and bodyweight capacity, or all-round goals.
- Dedicated eight-week bar muscle-up programme with level-aware first-rep or consistency progressions, three focused skill exposures per week, and supporting Olympic-lifting and engine sessions.
- Masters 35-39 RX/Open prep generator with readiness targets, assessment fields, and optional engine or skill add-ons.
- WOD variation across time domains and formats: AMRAP, intervals, for-time, EMOM, ladder, repeat sets, chipper, and benchmark.
- Manual training programme builder for adding your own sessions.
- Movement library for gymnastics and weightlifting skills with cues, progressions, scaling, and video guide links.
- Separate app and box workout logging, with structured time, rounds/reps, load, distance/calorie, split, substitution, strength-set, Rx/scaled, readiness, RPE, notes, and mobility data. Legacy free-form scores remain supported.
- Standalone Workout Library with seeded 40-minute EMOM generation, searchable 2024/2025 Open workouts, benchmark catalogs, tagged history, and benchmark PR updates.
- Frequency-aware dashboard totals that distinguish app progression completion from total weekly training.
- iPhone Competition Proof recording with a synchronized timer overlay, local video preview, and save/share controls.
- A combined **Progress** view for PRs, benchmark history, strength, gymnastics, engine, adherence, mobility, readiness/RPE, planned-versus-completed work, and end-of-cycle increase/hold/reduce recommendations.
- User-created benchmarks plus a compact common CrossFit benchmark catalog.
- React-powered phone-first UI mounted into a static app shell.
- Light, dark, and system theme setting saved locally.
- Optional private Supabase account sync for profiles, programmes, workout logs, and PR records.
- Feature-flagged Programming Engine V2 with a deterministic six-week,
  two-session mixed-strength block, independent progression tracks, calculated
  session duration, structured prescriptions, scoped regeneration, completion
  feedback, and a database-enforced validation gate. See
  [the V2 architecture guide](docs/programming-engine-v2.md).
- Local-first storage in the browser with JSON backup/restore, workout-log and PR-history CSV exports, a PWA manifest, and an offline cache.

New programmes use V2 only, with deterministic 2-, 3-, or 4-session templates
for mixed strength, endurance, gymnastics, Masters/Open preparation, and
deloads. Existing V1 plans remain readable and can be explicitly migrated or
rolled back without inventing structured prescriptions from legacy free text.

The primary navigation is **Today**, **Calendar**, **Log**, **Progress**, and
**More**. Programme building, the Workout Library, movement library, Competition Proof, profile,
theme, data ownership, and account synchronization live under More so the daily
decision stays first.

## Competition Proof recording

Open **More → Competition proof**, choose a programmed or saved session or enter a custom
competition workout, then configure the timer mode, duration or time cap,
interval length, and countdown. Opening the camera requests the rear camera and
microphone and starts the configured timer and video together. On supported
browsers, the athlete, workout, timer, round, and recording state are embedded
into the exported video. Review the result before saving or sharing it from the
iPhone, then continue to the workout log to store the timer and proof metadata.

Recording requires a current iPhone browser, camera and microphone permission,
and an HTTPS deployment such as GitHub Pages. Keep the app in the foreground and
disable Auto-Lock for long workouts. Backgrounding or locking the phone is
marked as an interruption. Recording chunks use temporary private browser file
storage when available and are deleted after export or discard. Browsers without
that capability use a lower-resolution in-memory fallback and show a warning.
Videos are never uploaded to Supabase or added to the offline cache. Browser
proof recording is not an official competition certification or an automatic
submission to an event platform.

## Run locally

Install the test dependencies once:

```sh
npm install
```

Open `index.html` directly in a browser, or serve the folder for full PWA behavior:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

Run the unit and React Testing Library tests with:

```sh
npm test
```

Playwright covers the critical browser workflows. See
[the E2E testing guide](docs/e2e-testing.md) for local commands, failure traces,
staging variables, and destructive-cleanup safeguards.

## Supabase database sync

Profiles, the canonical saved-programme catalog, cycle dates, the active plan,
selected week, training events, readiness checks, workout logs, PR attempts,
and current PRs sync privately to Supabase Postgres after email-link sign-in.
Calendar, Build, Proof, and Log continue to
resolve workouts from the same active-plan record. Theme preferences and
Competition Proof videos stay on the device and are never uploaded.

Each signed-in athlete has one owner-scoped `athlete_states` document. The
server document wins when an account is loaded on a device, and profile or
programme changes autosave after hydration. Concurrent edits use whole-account
last-successful-server-save wins semantics; the app does not attempt a
field-by-field or per-programme merge.

Generated sessions persist a validated structured workout definition. Workout
descriptions, timers, progression sequences, buy-ins, cash-outs, and
after-each-round work are rendered from that definition instead of being stored
as a second prose copy. Existing manual and customized text workouts remain
loadable as legacy free-form sessions; uncustomized generated sessions migrate
to the structured format on load.

Generated conditioning exercises also persist canonical movement identifiers.
Validation rejects unresolved movement choices, technical drills in scored
workouts, incompatible clean/snatch combinations, and accidental duplicate
stations before a plan can be saved or displayed. Scaling alternatives remain
separate, explicitly labelled guidance. Manual and customized sessions keep
their free-form text unchanged.

Movement names, aliases, roles, equipment requirements, Olympic-lifting
families, conditioning eligibility, Learn content, and ordered generator pool
membership live in `movement-catalog.js`. The generator keeps progression,
targets, loading, and workout-structure decisions in `app.js` and resolves
movement prescriptions through the catalog without changing persisted IDs.

Local account data is stored in owner-scoped athlete, score, and sync slices so
an isolated score change does not rewrite every saved programme. The legacy
`forge-hour-state-v1` document remains readable and is refreshed as a delayed
compatibility snapshot. Legacy profile, programme, and score data is migrated
into a separate `guest` bucket and is never shown in a signed-in account unless
the athlete explicitly confirms **Import guest data**. Import replaces the
account profile and programmes, merges guest scores, and keeps the guest copy
available. A remote failure does not discard a local change; it remains in the
account's device bucket and can be retried from the Account panel.

1. Create a Supabase project.
2. Apply the files in `supabase/migrations` with the Supabase CLI. For a fresh
   local database, run `supabase db start`; for an existing linked project, use
   the normal reviewed `supabase db push` workflow. `supabase-schema.sql` is an
   equivalent cumulative SQL-editor fallback.
3. In `supabase-config.js`, set your project URL and public anon key. Never put
   a Supabase service-role key in this static app.
4. In Supabase Auth settings, allow both `http://localhost:4173` and your
   deployed GitHub Pages URL as redirect URLs.
5. Keep Row Level Security enabled on the Supabase tables. The migration defines
   operation-specific policies, removes anonymous table grants, and restricts
   every operation to rows where `auth.uid()` matches `user_id`. Athlete state
   permits only SELECT, INSERT, and UPDATE; PR attempts and current records are
   saved together by the ownership-safe `save_pr_attempt` database function.
6. Review Supabase Auth rate limits and CAPTCHA settings before making a public
   deployment.
7. Serve or deploy the app, then use the Database sync panel to email a sign-in
   link. Confirm **Import guest data** only when that device's guest profile,
   programmes, and scores should become the account state.

The migrations add the private `athlete_states` document plus owner-scoped
`training_events` and `readiness_checks`; structured workout scores,
recommendation links, workout source, box-workout metadata, and nullable
`timer_result` and `competition_proof` JSON metadata without creating video storage. They also add
document-shape, size, non-empty, finite-value, source, difficulty, duration, and
training-stimulus constraints plus owner/recency indexes. Generated
public-schema types are committed at `types/database.types.ts`.

Run the local database authorization and constraint suites with:

```sh
supabase db start
supabase test db
supabase db lint --local --schema public --level warning --fail-on warning
supabase gen types typescript --local --schema public > types/database.types.ts
```

The pgTAP suites use two distinct users and cover all four RLS operations,
ownership spoofing, anonymous access, constraints, and atomic rollback. GitHub
Actions runs the same database tests before deployment.

## Host on GitHub Pages

The project includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
After the repository is pushed to GitHub, enable Pages with **GitHub Actions** as
the source in the repository settings. Every push to `master` or `main` will run
the test suite and deploy the static app.

The deployed app keeps a local cache for guest and signed-in owners. Existing
flat custom-session data is migrated into the canonical plan catalog on load.
Signed-in users can persist profiles, programmes, workout logs, and PR data in
Supabase across devices and deployments; theme settings and proof videos remain
device-local.
