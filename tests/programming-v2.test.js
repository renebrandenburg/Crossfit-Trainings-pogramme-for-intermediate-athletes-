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

function generationInput(overrides = {}) {
  return {
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
  };
}

function generate(overrides = {}) {
  return v2.generateMixedStrengthBlock(generationInput(overrides));
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

test("calendar adapter schedules all twelve V2 sessions on the athlete's two preferred days", () => {
  const program = generate();
  const calendarSessions = v2.adaptV2ProgramToCalendarSessions(program, {
    preferredDays: ["wednesday", "sunday"],
    athleteLevel: "advanced",
    availableEquipment: EQUIPMENT,
    weightIncrementKg: 1,
    roundingMode: "down",
  });

  assert.equal(calendarSessions.length, 12);
  assert.deepEqual(
    calendarSessions.slice(0, 4).map((session) => session.preferredDay),
    ["wednesday", "sunday", "wednesday", "sunday"],
  );
  assert.equal(calendarSessions[0].engineVersion, "v2");
  assert.equal(calendarSessions[0].week, 1);
  assert.ok(calendarSessions[0].movementPatterns.includes("olympic_lifting"));
  assert.equal(calendarSessions[0].v2Session.id, calendarSessions[0].id);
  assert.deepEqual(v2.summarizeV2Program(program), {
    weeks: 6,
    sessions: 12,
    exercises: 54,
  });
});

test("V2 generation preferences default safely and support explicit frequency metadata", () => {
  assert.deepEqual(
    v2.normalizeV2GenerationPreferences({
      preferredDays: ["tuesday", "tuesday", "noday"],
      athleteLevel: "unknown",
      availableEquipment: ["barbell", "barbell", "rower"],
      weightIncrementKg: 3,
      roundingMode: "sideways",
    }),
    {
      preferredDays: ["tuesday", "saturday"],
      frequency: 2,
      goal: "mixed",
      blockType: "mixed_strength",
      athleteLevel: "intermediate",
      availableEquipment: ["barbell", "rower"],
      weightIncrementKg: 2.5,
      roundingMode: "nearest",
      templateId: "mixed_strength_6w",
    },
  );
});

test("V2 template registry covers supported goals and frequencies", () => {
  assert.deepEqual(
    v2.V2_TEMPLATE_REGISTRY.map((template) => template.id),
    [
      "mixed_strength_6w",
      "mixed_strength_8w_testing",
      "endurance_capacity_6w",
      "gymnastics_capacity_6w",
      "bar_muscle_up_6w",
      "masters_open_6w",
      "olympic_lifting_6w",
      "general_crossfit_6w",
      "deload_1w",
    ],
  );
  for (const frequency of [2, 3, 4]) {
    const program = generate({
      sessionCount: frequency,
      templateId: "endurance_capacity_6w",
      blockType: "aerobic_capacity",
    });
    assert.ok(v2.validateProgram(program).valid);
    assert.ok(
      program.trainingBlocks[0].trainingWeeks.every(
        (week) => week.sessions.length === frequency,
      ),
    );
  }
});

test("programme types produce materially different six-week workout fingerprints", () => {
  const templates = [
    "mixed_strength_6w",
    "masters_open_6w",
    "olympic_lifting_6w",
    "endurance_capacity_6w",
    "general_crossfit_6w",
  ];
  const programmes = templates.map((templateId) =>
    v2.generateV2Program({
      ...generationInput({ templateId }),
      programId: v2.stableUuid(
        "33333333-3333-4333-a333-333333333333",
        templateId,
      ),
      templateId,
    }),
  );
  assert.equal(
    new Set(programmes.map((program) => program.generationFingerprint)).size,
    templates.length,
  );
  assert.notDeepEqual(
    programmes[0].trainingBlocks[0].trainingWeeks[0].sessions[0].exercises,
    programmes[1].trainingBlocks[0].trainingWeeks[0].sessions[0].exercises,
  );
  assert.notEqual(
    programmes[0].trainingBlocks[0].trainingWeeks[0].sessions[0].objective,
    programmes[1].trainingBlocks[0].trainingWeeks[0].sessions[0].objective,
  );
});

test("V2 generation rejects missing or unsupported programme types", () => {
  assert.throws(
    () => v2.generateV2Program(generationInput()),
    /MISSING_PROGRAMME_TYPE/,
  );
  assert.throws(
    () =>
      v2.generateV2Program({
        ...generationInput(),
        templateId: "not-a-template",
      }),
    /UNSUPPORTED_TEMPLATE/,
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

test("renders rotating EMOMs with explicit minute assignments", () => {
  const program = generate();
  const session = sessions(program).find(
    (candidate) => candidate.weekNumber === 2 && candidate.sessionNumber === 1,
  );
  const conditioning = session.conditioning;
  const rendered = JSON.stringify(v2.formatSessionForDisplay(session));

  assert.equal(conditioning.executionMode, "rotate");
  assert.equal(conditioning.intervalSeconds, 60);
  assert.equal(conditioning.rounds, 3);
  assert.deepEqual(
    conditioning.stations.map((station) => station.minute),
    [1, 2, 3],
  );
  assert.match(rendered, /9-minute EMOM/);
  assert.match(rendered, /3 rounds · one movement per minute/);
  assert.match(rendered, /Minute 1: \d+ (m|cal) /);
  assert.match(rendered, /Minute 2: 8 Push-ups/);
  assert.match(rendered, /Minute 3: 12 Box Step-ups/);
  assert.doesNotMatch(rendered, /EMOM: .*?, .*?,/);
});

test("rejects rotating EMOMs whose duration cannot complete a round", () => {
  const program = generate();
  const session = sessions(program).find(
    (candidate) => candidate.weekNumber === 2 && candidate.sessionNumber === 1,
  );
  const invalid = structuredClone(session.conditioning);
  invalid.durationMinutes = 10;

  const validation = v2.validateConditioningPrescription(invalid);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.some(
      (issue) => issue.code === "EMOM_DURATION_NOT_COMPATIBLE",
    ),
  );
});

test("labels all-every-minute EMOMs without implying rotation", () => {
  const program = generate();
  const session = sessions(program).find(
    (candidate) => candidate.weekNumber === 2 && candidate.sessionNumber === 1,
  );
  const conditioning = structuredClone(session.conditioning);
  conditioning.executionMode = "all-every-minute";
  conditioning.rounds = 9;
  const rendered = JSON.stringify(
    v2.formatSessionForDisplay({ ...session, conditioning }),
  );

  assert.match(rendered, /complete all movements every minute/);
  assert.match(rendered, /Every minute:/);
  assert.doesNotMatch(rendered, /one movement per minute/);
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

test("eight-week testing template creates explicit test sessions in week eight", () => {
  const program = generate({ templateId: "mixed_strength_8w_testing" });
  const block = program.trainingBlocks[0];
  const testSessions = block.trainingWeeks[7].sessions;

  assert.equal(block.durationWeeks, 8);
  assert.equal(block.endsWithTest, true);
  assert.equal(block.testWeekNumber, 8);
  assert.deepEqual(
    testSessions.map((session) => [
      session.sessionType,
      session.maxTestPrescription?.testType,
    ]),
    [
      ["max_test", "true_1rm"],
      ["max_test", "technical_1rm"],
    ],
  );
  assert.ok(testSessions[0].maxTestPrescription.warmupSets.length >= 4);
  assert.ok(testSessions[0].maxTestPrescription.stoppingRules.length >= 2);
  assert.equal(v2.validateProgram(program).valid, true);
});

test("max-test calculations enforce estimates and the two-failure stopping rule", () => {
  assert.equal(v2.calculateEstimatedOneRepMax(100, 5, "epley"), 116.7);
  assert.equal(v2.calculateEstimatedOneRepMax(100, 5, "brzycki"), 112.5);
  assert.throws(
    () => v2.calculateEstimatedOneRepMax(100, 11),
    /between 2 and 10/,
  );

  const prescription = v2.buildMaxTestPrescription({
    id: "prescription-1",
    sessionId: "session-1",
    movementId: "front_squat",
    testType: "true_1rm",
    previousMaxKg: 125,
    trainingMaxKg: 115,
    athleteLevel: "intermediate",
    eligibility: {
      movementId: "front_squat",
      eligible: true,
      reasons: [],
      completedPrerequisiteSessions: 6,
      requiredPrerequisiteSessions: 6,
      recentPainReported: false,
      recentFailureCount: 0,
      recentHeavySingleCompleted: true,
      daysSinceLastTest: 100,
      readinessScore: 100,
    },
    incrementKg: 2.5,
    roundingMode: "nearest",
  });
  const failed = v2.applyMaxAttemptResult(prescription, {
    attemptNumber: 1,
    loadKg: 115,
    result: "failure",
    perceivedRpe: 10,
    technicalQuality: "acceptable",
    painReported: false,
    notes: null,
  });
  const stopped = v2.applyMaxAttemptResult(failed, {
    attemptNumber: 2,
    loadKg: 115,
    result: "failure",
    perceivedRpe: 10,
    technicalQuality: "acceptable",
    painReported: false,
    notes: null,
  });
  assert.equal(
    v2.proposeMaxUpdate(stopped, new Date().toISOString()).accepted,
    false,
  );
});
