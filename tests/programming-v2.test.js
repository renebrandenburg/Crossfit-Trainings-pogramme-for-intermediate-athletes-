"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const v2 = require("../build/programming-v2.cjs");

const EQUIPMENT = [
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
];

function generate(overrides = {}) {
  return v2.generateMixedStrengthBlock({
    programId: "11111111-1111-4111-a111-111111111111",
    ownerId: "22222222-2222-4222-a222-222222222222",
    generatedAt: "2026-08-02T10:00:00.000Z",
    blockType: "mixed_strength",
    seed: "test-seed",
    athleteLevel: "intermediate",
    maxes: {
      front_squat: 125,
      back_squat: 145,
      snatch: 75,
      clean_and_jerk: 100,
      strict_press: 60,
    },
    equipment: EQUIPMENT,
    restrictions: {
      movementIds: [],
      movementFamilyIds: [],
      guidance: null,
    },
    weightIncrementKg: 2.5,
    roundingMode: "nearest",
    ...overrides,
  });
}

function sessions(program) {
  return program.trainingBlocks[0].trainingWeeks.flatMap(
    (week) => week.sessions,
  );
}

test("feature flag enables loopback development without weakening production", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
    assert.deepEqual(
      v2.resolveProgrammingFeatureFlag({
        remoteEnabled: false,
        hostname,
      }),
      { enabled: true, source: "local_development" },
    );
  }

  assert.deepEqual(
    v2.resolveProgrammingFeatureFlag({
      remoteEnabled: false,
      hostname: "renebrandenburg.github.io",
    }),
    { enabled: false, source: "disabled" },
  );
  assert.deepEqual(
    v2.resolveProgrammingFeatureFlag({
      remoteEnabled: true,
      hostname: "renebrandenburg.github.io",
    }),
    { enabled: true, source: "supabase" },
  );
});

test("generates a connected six-week mixed-strength block", () => {
  const program = generate();
  const block = program.trainingBlocks[0];
  const generatedSessions = sessions(program);

  assert.equal(program.engineVersion, "v2");
  assert.equal(program.validation.valid, true);
  assert.equal(block.durationWeeks, 6);
  assert.equal(block.trainingWeeks.length, 6);
  assert.equal(generatedSessions.length, 12);
  assert.ok(
    generatedSessions.every(
      (session) => session.estimatedDurationMinutes <= 65,
    ),
  );
  assert.ok(
    generatedSessions
      .filter((session) => session.weekNumber !== 6)
      .every((session) => session.estimatedDurationMinutes >= 50),
  );
  assert.ok(
    generatedSessions.some((session) =>
      session.exercises.some(
        (exercise) => exercise.movementFamilyId === "snatch",
      ),
    ),
  );
  assert.ok(
    generatedSessions.some((session) =>
      session.exercises.some(
        (exercise) => exercise.movementFamilyId === "clean_and_jerk",
      ),
    ),
  );
});

test("front squat, snatch, and clean-and-jerk steps progress and deload", () => {
  const tracks = generate().trainingBlocks[0].progressionTracks;
  const frontSquat = tracks.find((track) => track.trackType === "front_squat");
  const snatch = tracks.find((track) => track.trackType === "snatch");
  const cleanAndJerk = tracks.find(
    (track) => track.trackType === "clean_and_jerk",
  );

  assert.deepEqual(
    frontSquat.steps.map((step) => step.intensityMin),
    [72, 75, 78, 82, 87, 60],
  );
  assert.deepEqual(
    snatch.steps.map((step) => step.movementId),
    [
      "muscle_snatch",
      "hang_power_snatch",
      "hang_squat_snatch",
      "squat_snatch",
      "snatch",
      "muscle_snatch",
    ],
  );
  assert.equal(cleanAndJerk.steps.at(-1).intensityMin, 55);
});

test("weight calculation supports all required increments and rounding", () => {
  assert.equal(
    v2.calculateWorkingWeight({
      maxKg: 103,
      percentage: 75,
      incrementKg: 2.5,
      roundingMode: "nearest",
    }),
    77.5,
  );
  assert.equal(
    v2.calculateWorkingWeight({
      maxKg: 103,
      percentage: 75,
      incrementKg: 5,
      roundingMode: "down",
    }),
    75,
  );
  assert.equal(
    v2.calculateWorkingWeight({
      maxKg: 103,
      percentage: 75,
      incrementKg: 1,
      roundingMode: "up",
    }),
    78,
  );
});

test("unknown maxes fall back to bounded RPE without invented kilograms", () => {
  const program = generate({
    maxes: {
      front_squat: null,
      back_squat: null,
      snatch: null,
      clean_and_jerk: null,
      strict_press: null,
    },
  });
  const loadedProgressions = sessions(program).flatMap((session) =>
    session.exercises.filter((exercise) => exercise.progressionTrackId),
  );
  assert.ok(
    loadedProgressions
      .filter((exercise) => exercise.intensityMethod !== "bodyweight")
      .every(
        (exercise) =>
          exercise.intensityMethod === "rpe" && exercise.loadKg === null,
      ),
  );
});

test("exact vague gymnastics theme is rejected at the final string guard", () => {
  const content =
    "Gymnastics skill: hollow and arch control, strict pulling, and midline strength";
  const validation = v2.validateAthleteFacingString(content);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.some(
      (issue) => issue.code === "INCOMPLETE_GYMNASTICS_PRESCRIPTION",
    ),
  );
});

test("exact unloaded tall-snatch-pull block returns MISSING_LOAD and MISSING_REST", () => {
  const block = "3 sets: 3 tall snatch pulls + 20-second overhead hold";
  const validation = v2.validateAthleteFacingString(block);

  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.code === "MISSING_LOAD"));
  assert.ok(validation.issues.some((issue) => issue.code === "MISSING_REST"));
});

test("rendered V2 prescriptions visibly include load, rest, gymnastics targets, and scaling", () => {
  const program = generate();
  const firstDay = sessions(program)[0];
  const secondDay = sessions(program)[1];
  const renderedFirst = v2.formatSessionForDisplay(firstDay);
  const renderedSecond = v2.formatSessionForDisplay(secondDay);
  const firstText = JSON.stringify(renderedFirst);
  const secondText = JSON.stringify(renderedSecond);

  assert.match(firstText, /72–75% of front squat 1RM/);
  assert.match(firstText, /Rest 120 sec/);
  assert.match(firstText, /90–95 kg/);
  assert.doesNotMatch(firstText, /90–937\.5 kg/);
  assert.match(secondText, /Strict pull-up/);
  assert.match(secondText, /Hollow hold/);
  assert.match(secondText, /20 sec/);
  assert.match(secondText, /Ring row/);
  assert.doesNotMatch(secondText, /Gymnastics skill: hollow and arch control/);
  assert.doesNotMatch(
    firstText,
    /tall snatch pulls \+ 20-second overhead hold/,
  );
});

test("regenerating conditioning preserves progression assignments and duration limits", () => {
  const program = generate();
  const session = sessions(program)[0];
  const assignments = structuredClone(session.trackAssignments);
  const exerciseIds = session.exercises
    .filter((exercise) => exercise.progressionTrackId)
    .map((exercise) => exercise.id);
  const regenerated = v2.regenerateSessionSection({
    program,
    sessionId: session.id,
    scope: "conditioning",
    seed: "different-conditioning",
  });
  const next = v2.findSession(regenerated.program, session.id);

  assert.deepEqual(next.trackAssignments, assignments);
  assert.deepEqual(
    next.exercises
      .filter((exercise) => exercise.progressionTrackId)
      .map((exercise) => exercise.id),
    exerciseIds,
  );
  assert.ok(next.estimatedDurationMinutes <= 65);
  assert.equal(regenerated.validation.valid, true);
});

function successfulFeedback(session, overrides = {}) {
  return {
    sessionId: session.id,
    completed: true,
    sessionRpe: 8,
    fatigue: 6,
    painReported: false,
    durationMinutesActual: session.estimatedDurationMinutes,
    notes: null,
    completedAt: "2026-08-02T12:00:00.000Z",
    results: session.trackAssignments.map((assignment) => {
      const exercise = session.exercises.find(
        (item) => item.progressionTrackId === assignment.progressionTrackId,
      );
      return {
        prescriptionId: exercise.id,
        progressionTrackId: assignment.progressionTrackId,
        completedSets: exercise.sets,
        completedReps: exercise.reps ?? exercise.repRangeMin,
        loadKg: exercise.loadKg,
        achievedRpe: 8,
        successful: true,
        painReported: false,
      };
    }),
    ...overrides,
  };
}

test("successful completion advances tracks and rematerializes only the next linked section", () => {
  const program = generate();
  const first = sessions(program)[0];
  const laterWeekThree = structuredClone(sessions(program)[4]);
  const completed = v2.applySessionCompletion({
    program,
    sessionId: first.id,
    expectedRevision: first.revision,
    feedback: successfulFeedback(first),
  });
  const next = sessions(completed.program)[2];
  const unchangedLater = sessions(completed.program)[4];

  assert.equal(completed.advancedTrackIds.length, 2);
  assert.equal(v2.findSession(completed.program, first.id).status, "completed");
  assert.equal(next.provisional, false);
  assert.deepEqual(unchangedLater.exercises, laterWeekThree.exercises);
});

test("pain pauses affected tracks and blocks their next session", () => {
  const program = generate();
  const first = sessions(program)[0];
  const feedback = successfulFeedback(first, { painReported: true });
  feedback.results = feedback.results.map((result) => ({
    ...result,
    painReported: true,
  }));
  const completed = v2.applySessionCompletion({
    program,
    sessionId: first.id,
    expectedRevision: first.revision,
    feedback,
  });

  assert.equal(completed.pausedTrackIds.length, 2);
  assert.equal(sessions(completed.program)[2].status, "blocked");
});

test("the persistence gate never calls save for a mutated invalid programme", () => {
  const program = generate();
  const invalid = structuredClone(program);
  invalid.trainingBlocks[0].trainingWeeks[0].sessions[0].exercises[0].intensityMethod =
    "none";
  let saved = false;

  assert.throws(
    () => v2.persistValidatedProgram(invalid, () => (saved = true)),
    /MISSING_LOAD/,
  );
  assert.equal(saved, false);
});

test("required movement-family restrictions reject generation instead of silently substituting another lift", () => {
  assert.throws(
    () =>
      generate({
        restrictions: {
          movementIds: [],
          movementFamilyIds: ["snatch"],
          guidance: null,
        },
      }),
    /REQUIRED_MOVEMENT_UNAVAILABLE/,
  );
});

test("structured generation logs include programming decisions but exclude athlete notes", () => {
  const program = generate();
  const record = v2.createGenerationLogRecord(program, {
    event: "regenerated",
    regenerationScope: "conditioning",
  });

  assert.equal(record.programId, program.id);
  assert.equal(record.blockType, "mixed_strength");
  assert.equal(record.estimatedSessionDurations.length, 12);
  assert.ok(record.selectedMovementFamilies.includes("snatch"));
  assert.ok(record.selectedMovementFamilies.includes("clean_and_jerk"));
  assert.equal(record.regenerationScope, "conditioning");
  assert.equal(JSON.stringify(record).includes("notes"), false);
});
