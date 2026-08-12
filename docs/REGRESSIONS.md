# Regression Catalogue

## Regression policy

Every production or user-discovered regression must receive an automated regression test before the fix is considered complete.

The test must reproduce the broken behaviour and must fail against the faulty implementation.

Fixes should address the root cause rather than only patching visible symptoms.

Existing regression tests must not be removed merely to allow new code to pass.

Changes to expected product behaviour must update both tests and documentation intentionally.

Critical programme flows must remain protected by automated Playwright coverage.

CI is the final authority: a change with failing regression protection is not complete.

## Required workflow

For a regression fix:

1. Reproduce the reported behaviour.
2. Add or update a deterministic automated test and confirm that it fails for the reported reason.
3. identify the responsible domain, state, persistence, or UI boundary.
4. Correct the root cause without mutating existing saved programmes.
5. Run the focused test, related suite, `npm run test:regression`, `npm run check`, and the critical Playwright suite where the behaviour is user-visible.
6. Merge only when the CI checks and database tests pass.

Do not weaken or delete a regression test unless the product requirement changed and the change is documented here.

## Current architecture and safety boundaries

- `src/programming-v2/` is the deterministic generator, progression, regeneration, duration, validation, persistence-adapter, and observability boundary. The seed is injectable and stored in the generation request for newly generated programmes.
- `activeV2ProgramId` and `selectedWeek` are canonical persisted identities. Active programme and active week objects are derived from those values.
- `react-app.js` maps UI selections into an explicit generation request. It never owns exercise-selection rules.
- `supabase-sync.js` rejects unvalidated output and routes profile-driven programmes to `save_programming_engine_v2_profile`; the database repeats structural identity and integrity checks before atomically replacing the validated snapshot.
- Existing saved V1 and V2 programmes remain readable. Only newly generated or explicitly regenerated content uses current generator behaviour.
- Unit/domain tests use `node:test`; React integration tests use Testing Library with JSDOM; browser journeys use Playwright; database contracts use pgTAP against local Supabase.

## REG-001 Programme switching

Problem: Selecting Programme B could leave Programme A active internally, including when a delayed Programme A save completed after the switch.

Root cause: A background save helper always assigned the saved programme ID to `activeV2ProgramId`.

Protection:

- `tests/react-app.test.js` covers canonical switching, reload, and the out-of-order save race.
- `e2e/plans/programming-engine-v2.spec.js` switches, renames, deletes, and reloads distinct V2 programmes.

Status: Protected.

## REG-002 Week switching

Problem: The selected tab and rendered workout could represent different weeks.

Protection:

- `tests/react-app.test.js` verifies shared Dashboard, Calendar, and Builder week state across reload.
- `e2e/plans/programming-engine-v2.spec.js` exercises Week 1 → 4 → 7 → 2 → 8 and reloads Week 8.

Status: Protected.

## REG-003 Duration mismatch

Problem: An eight-week request could materialize fewer weeks.

Protection:

- `tests/regression/programming-v2.regression.test.js` checks every supported template and rejects a corrupted week count.
- `e2e/plans/programming-engine-v2.spec.js` verifies eight week controls, Week 8 content, and reload.
- `save_programming_engine_v2_profile` rejects request, block, week-array, and weekly-session count mismatches.

Status: Protected.

## REG-004 Programme type collision

Problem: Goal and block selections were metadata while a shared squat/Olympic blueprint drove content.

Root cause: Generation began from the selected template's legacy session family instead of an explicit programme profile and progression map.

Protection:

- `tests/programming-v2.test.js` checks profile distributions, fingerprints, and the exact General CrossFit + Gymnastics Capacity configuration.
- `tests/regression/programming-v2.regression.test.js` checks explicit identities, differentiation, and request/profile/block consistency.
- `tests/supabase-sync.test.js` verifies profile programmes cannot enter the legacy persistence route.
- `supabase/tests/database/010_profile_programming_regressions.test.sql` rejects profile/block identity collisions.
- Playwright compares multiple programme families by structured Week 4 content.

Status: Protected.

## REG-005 Open Prep programme quality

Problem: Open Prep could be generic CrossFit with an Open label.

Protection: `tests/regression/programming-v2.regression.test.js` checks gymnastics, Open-relevant movements, mixed-modal work, competition metadata, and conditioning-format variety across the full cycle.

Status: Protected.

## REG-006 Masters programme quality

Problem: Masters/Open could resolve to generic programming or merely easier training.

Protection: Domain and Playwright contracts check the dedicated profile, legitimate strength and conditioning, recovery-aware fatigue, duration ceilings, scaling paths, and competition metadata.

Status: Protected.

## REG-007 Weightlifting programme identity

Problem: Olympic Weightlifting could become generic squatting with a lifting label.

Protection: `tests/regression/programming-v2.regression.test.js` requires snatch, clean and jerk, hang/position variations, pulls, and squat support while ensuring the Olympic families remain the dominant identity.

Status: Protected.

## REG-008 Regenerate condition crash

Problem: Conditioning regeneration could throw or leave an invalid workout.

Protection: `tests/programming-v2.test.js`, `tests/react-app.test.js`, and Playwright regenerate conditioning and require schema-valid output without losing the existing session.

Status: Protected.

## REG-009 Regeneration scope

Problem: Regenerating conditioning could also alter strength, skill, warm-up, or progression assignments.

Protection: Unit and browser tests compare immutable copies and require only conditioning plus derived duration/revision metadata to change.

Status: Protected.

## REG-010 Missing loading prescription

Problem: Loaded exercises could be emitted without actionable percentage, RPE, fixed-load, bodyweight, or technical guidance.

Protection: Prescription and V2 validation tests reject loaded work without a usable load method, reference max where applicable, rest, and scaling.

Status: Protected.

## REG-011 Vague gymnastics prescription

Problem: Gymnastics work could be a non-actionable paragraph instead of performable work.

Protection: Prescription tests and V2 session validation require structured movements with sets/reps or time, rest, coaching intent, and scaling.

Status: Protected.

## REG-012 UI/generator selection mismatch

Problem: The UI could show a selected goal or block while the generator received a default programme identity.

Protection: Testing Library inspects the persisted generation request, Playwright checks selection after reload, and domain/database validation rejects request/profile/block divergence.

Status: Protected.

## REG-013 Unsupported V2 template

Problem: A historical V2 programme saved before template identity was required could reload without `trainingBlock.templateId`, fail final validation with `UNSUPPORTED_TEMPLATE`, and expose neither the rejected value nor a safe recovery path.

Root cause: Early V2 snapshots did not persist a template ID. The later strict validator correctly rejected the missing value, but its diagnostic discarded programme context and the React rejection branch hid programme creation.

Protection:

- `tests/regression/programming-v2.regression.test.js` reproduces the missing-template snapshot, asserts the full diagnostic context, and generates the complete independently selectable goal/block/template matrix.
- `tests/react-app.test.js` reloads the historical shape, verifies the contextual rejection, and requires explicit selection of a supported template before replacement generation.
- The setup selector is derived from `V2_SELECTABLE_TEMPLATES`; generation resolves that exact ID through the strict registry and has no generic UI or generator fallback.

Status: Protected.

## REG-014 Historical generator version mismatch

Problem: An intact historical eight-week Strength programme became hidden after the registered generator version changed, even though all eight weeks, sessions, and completion data remained valid.

Root cause: Persisted provenance fields were required to equal the latest template registry version during loading. Hydration then excluded the otherwise valid local programme.

Protection:

- `tests/regression/programming-v2.regression.test.js` verifies that internally consistent historical provenance remains loadable and immutable while strict new-generation validation still requires the current version.
- `tests/react-app.test.js` reloads an eight-week historical Strength programme, preserves all weeks, the active week, the exact completed session ID, feedback, and revision, and renders it without `PROGRAMME_VERSION_MISMATCH`.

Status: Protected.

## CI gate

Pull requests run formatting, lint, type checks, all Node suites, the dedicated regression suite, build, pgTAP database checks, schema lint/type drift checks, and critical Chromium Playwright journeys. Main and scheduled browser jobs run the full suite in Chromium, Firefox, and WebKit.

## Adversarial gate

The final hardening review deliberately exercises these failure classes:

| Attempted break                                                                                  | Automated detector                                                                 |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Request eight weeks but remove a week                                                            | Domain duration validation, REG-003 regression test, pgTAP, Playwright Week 8 flow |
| Relabel a gymnastics programme as Olympic lifting                                                | Programme fingerprint/profile validation and REG-004 mutation tests                |
| Pass a different goal, block, template, duration, frequency, or version than the generated graph | Domain mutation tests and `save_programming_engine_v2_profile` pgTAP tests         |
| Complete an older async save after switching programmes                                          | Deferred Testing Library race test                                                 |
| Switch weeks non-sequentially or reload Week 8                                                   | Canonical-state integration test and critical Playwright flow                      |
| Regenerate conditioning twice while its save is pending                                          | Disabled mutation controls and deferred integration test                           |
| Regenerate conditioning but mutate warm-up/strength/progression                                  | Immutable unit contract and critical Playwright comparison                         |
| Save a loaded movement without usable guidance                                                   | REG-010 prescription validation                                                    |
| Save vague gymnastics prose                                                                      | REG-011 actionable-prescription validation                                         |
| Replace the current generator after an older programme was saved                                 | REG-014 historical snapshot and reload tests                                       |
| Rename or delete a cycle and reload                                                              | Critical Playwright programme lifecycle flow                                       |

Each attempted break is part of a pull-request CI path; none relies on a screenshot or manual title comparison.
