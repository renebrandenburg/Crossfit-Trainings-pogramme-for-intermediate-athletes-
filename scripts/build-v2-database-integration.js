"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const v2 = require(path.join(root, "build", "programming-v2.cjs"));
const userId = "66666666-6666-4666-8666-666666666666";
const programId = "77777777-7777-4777-8777-777777777777";
const generatedAt = "2026-08-02T10:00:00.000Z";
const program = v2.generateMixedStrengthBlock({
  programId,
  ownerId: userId,
  generatedAt,
  blockType: "mixed_strength",
  seed: "database-integration",
  athleteLevel: "intermediate",
  maxes: {
    front_squat: 125,
    back_squat: 145,
    snatch: 75,
    clean_and_jerk: 100,
    strict_press: 60,
  },
  equipment: [
    "barbell",
    "rack",
    "pull-up bar",
    "rings",
    "dumbbell",
    "box",
    "rower",
    "bike",
    "ski erg",
    "band",
    "PVC",
  ],
  restrictions: {
    movementIds: [],
    movementFamilyIds: [],
    guidance: null,
  },
  weightIncrementKg: 2.5,
  roundingMode: "nearest",
});
const firstSession = program.trainingBlocks[0].trainingWeeks[0].sessions[0];
const regenerated = v2.regenerateSessionSection({
  program,
  sessionId: firstSession.id,
  scope: "conditioning",
  seed: "database-integration-regeneration",
}).program;

function dollarJson(value, tag) {
  const json = JSON.stringify(value);
  if (json.includes(`$${tag}$`)) throw new Error("Unexpected SQL dollar tag");
  return `$${tag}$${json}$${tag}$::jsonb`;
}

const firstPayload = dollarJson(program, "program_one");
const secondPayload = dollarJson(regenerated, "program_two");
const sql = `
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

insert into auth.users (id, email)
values ('${userId}', 'v2-database-integration@example.test')
on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"${userId}"}';
set local request.jwt.claim.sub = '${userId}';

select plan(9);

select lives_ok(
  $save_one$select public.save_programming_engine_v2(${firstPayload}, null)$save_one$,
  'a complete generated V2 programme saves atomically'
);
select is((select count(*) from public.training_weeks), 6::bigint, 'six normalized training weeks are saved');
select is((select count(*) from public.training_sessions), 12::bigint, 'twelve normalized training sessions are saved');
select is((select count(*) from public.training_sessions where estimated_duration_minutes > 65), 0::bigint, 'no normalized session exceeds 65 minutes');
select is(
  (
    select count(*)
    from public.exercise_prescriptions exercise
    join public.movements movement on movement.id = exercise.movement_id
    where movement.loadable
      and exercise.intensity_method not in ('percentage_1rm', 'percentage_training_max', 'rpe', 'rir', 'fixed_load', 'quality')
  ),
  0::bigint,
  'every normalized loaded movement has measurable intensity'
);
select is(
  public.load_programming_engine_v2('${programId}'::uuid) -> 'program',
  ${firstPayload},
  'loading returns the exact graph that passed validation and persistence'
);
select lives_ok(
  $save_two$select public.save_programming_engine_v2(${secondPayload}, 1)$save_two$,
  'a regenerated section replaces the graph with optimistic locking'
);
select is((select revision from public.training_programs where id = '${programId}'), 2, 'optimistic revision advances exactly once');
select is(
  public.load_programming_engine_v2('${programId}'::uuid) -> 'program',
  ${secondPayload},
  'regenerated exact graph saves and loads atomically'
);

select * from finish();

rollback;
`;

const output = path.join(root, "build", "v2-database-integration.test.sql");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, sql);
console.info(output);
