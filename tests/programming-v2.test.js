"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const v2 = require("../build/programming-v2.cjs");
const strictStrengthSnapshot = require("./fixtures/strict-strength-8w.snapshot.json");

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
      deadlift: 180,
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
    skills: {
      pullUps: 10,
      chestToBar: 5,
      toesToBar: 8,
      barMuscleUps: 0,
      strictHspu: 0,
      ringDips: 6,
      handstandWalkMeters: 0,
    },
    ...overrides,
  };
}

function generate(overrides = {}) {
  return v2.generateMixedStrengthBlock(generationInput(overrides));
}

function generateStrict(overrides = {}) {
  const base = generationInput();
  return v2.generateV2Program({
    ...base,
    ...overrides,
    programId:
      overrides.programId ||
      v2.stableUuid("strict-strength", JSON.stringify(overrides.skills || {})),
    goal: "strength",
    blockType: "mixed_strength",
    templateId: "strict_strength_8w",
    sessionCount: 2,
    skills: { ...base.skills, ...(overrides.skills || {}) },
  });
}

function sessions(program) {
  return program.trainingBlocks[0].trainingWeeks.flatMap(
    (week) => week.sessions,
  );
}

function profileProgram(goal, blockType, overrides = {}) {
  return v2.generateV2Program(
    generationInput({
      goal,
      blockType,
      templateId: "mixed_strength_8w_testing",
      sessionCount: 2,
      programId: v2.stableUuid("profile-program", goal, blockType),
      ...overrides,
    }),
  );
}

function exposure(program, ...families) {
  return families.reduce(
    (total, family) =>
      total + (program.generationSummary.movementExposures[family] || 0),
    0,
  );
}

function conditioningMovement(movementId, target) {
  const movement = v2.getMovement(movementId);
  return {
    movementId,
    movementName: movement.name,
    movementFamilyId: movement.familyId,
    reps: target.reps ?? null,
    calories: target.calories ?? null,
    distanceMeters: target.distanceMeters ?? null,
    durationSeconds: target.durationSeconds ?? null,
    loadKg: null,
    percentageReference: null,
    equipment: movement.equipment,
  };
}

function underdosedConditioning(overrides = {}) {
  return {
    format: "for_time",
    rounds: 4,
    durationMinutes: null,
    workSeconds: null,
    restSeconds: null,
    timeCapMinutes: 11,
    movements: [
      conditioningMovement("run", { distanceMeters: 160 }),
      conditioningMovement("burpee", { reps: 6 }),
      conditioningMovement("air_squat", { reps: 12 }),
    ],
    athleteProfile: { level: "intermediate" },
    ...overrides,
  };
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

test("conditioning estimator rejects the under-dosed 8-10 minute regression workout", () => {
  const workout = underdosedConditioning();
  const estimate = v2.estimateConditioningDuration(workout);
  const validation = v2.validateConditioningStimulus(workout, {
    minMinutes: 8,
    maxMinutes: 10,
  });

  assert.equal(estimate.confidence, "medium");
  assert.ok(estimate.estimatedSeconds < 480 * 0.9);
  assert.equal(validation.valid, false);
  assert.ok(validation.deviationPercent < -10);
  assert.match(validation.reason, /below the programmed target window/);
});

test("conditioning recalibration preserves the 8-10 minute intent and adjusts workload", () => {
  const { athleteProfile, ...workload } = underdosedConditioning();
  const prescription = {
    id: "33333333-3333-4333-a333-333333333333",
    sessionId: "44444444-4444-4444-a444-444444444444",
    ...workload,
    intervalSeconds: null,
    executionMode: null,
    stations: [],
    intendedStimulus: "Continuous moderate-hard effort.",
    targetDurationMin: 8,
    targetDurationMax: 10,
    targetRpe: 8,
    scalingOptions: [],
    estimatedDurationMinutes: 11,
  };
  const original = structuredClone(prescription);
  const calibrated = v2.calibrateConditioningPrescription(
    prescription,
    athleteProfile,
  );

  assert.deepEqual(prescription, original);
  assert.equal(calibrated.targetDurationMin, 8);
  assert.equal(calibrated.targetDurationMax, 10);
  assert.equal(calibrated.timeCapMinutes, 11);
  assert.equal(calibrated.stimulusValidation.valid, true);
  assert.ok(calibrated.recalibrationAttempts > 0);
  assert.ok(calibrated.recalibrationAttempts <= v2.MAX_RECALIBRATION_ATTEMPTS);
  assert.notDeepEqual(calibrated.movements, original.movements);
});

test("conditioning stimulus tolerance handles target-window boundaries", () => {
  const validate = (seconds) =>
    v2.validateEstimatedConditioningDuration(seconds, {
      minMinutes: 8,
      maxMinutes: 10,
    }).valid;

  assert.equal(validate(7 * 60), false);
  assert.equal(validate(7 * 60 + 40), true);
  assert.equal(validate(8 * 60 + 20), true);
  assert.equal(validate(9 * 60 + 30), true);
  assert.equal(validate(10 * 60 + 40), true);
  assert.equal(validate(12 * 60), false);
});

test("conditioning duration invariants are monotonic and athlete-aware", () => {
  const base = underdosedConditioning();
  const estimate = (overrides) =>
    v2.estimateConditioningDuration({ ...base, ...overrides }).estimatedSeconds;
  const moreReps = base.movements.map((movement) => ({
    ...movement,
    reps: movement.reps == null ? null : movement.reps + 2,
  }));
  const moreDistance = base.movements.map((movement) => ({
    ...movement,
    distanceMeters:
      movement.distanceMeters == null ? null : movement.distanceMeters + 40,
  }));

  assert.ok(estimate({ rounds: 5 }) > estimate({ rounds: 4 }));
  assert.ok(estimate({ movements: moreReps }) >= estimate({}));
  assert.ok(estimate({ movements: moreDistance }) > estimate({}));
  assert.ok(
    estimate({ athleteProfile: { level: "advanced" } }) <
      estimate({ athleteProfile: { level: "intermediate" } }),
  );
  assert.equal(
    estimate({
      athleteProfile: {
        level: "intermediate",
        personalMultiplier: { value: 0.8, sampleCount: 4 },
      },
    }),
    estimate({ athleteProfile: { level: "intermediate" } }),
  );
  assert.ok(
    estimate({
      athleteProfile: {
        level: "intermediate",
        personalMultiplier: { value: 0.8, sampleCount: 5 },
      },
    }) < estimate({ athleteProfile: { level: "intermediate" } }),
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
  assert.ok(
    generatedSessions.every(
      (session) =>
        session.conditioning?.durationEstimate &&
        (!session.conditioning.stimulusValidation ||
          session.conditioning.stimulusValidation.valid),
    ),
  );
  assert.ok(
    generatedSessions.every((session) => {
      const target = session.conditioning?.intent?.durationTarget;
      const cap = session.conditioning?.timeCapMinutes;
      return !target || cap == null || cap >= target.maxMinutes;
    }),
  );
  const regressionSession = generatedSessions.find(
    (session) => session.weekNumber === 3 && session.sessionNumber === 1,
  );
  assert.deepEqual(regressionSession.conditioning.intent.durationTarget, {
    minMinutes: 8,
    maxMinutes: 10,
  });
  assert.equal(regressionSession.conditioning.timeCapMinutes, 11);
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
      "strict_strength_8w",
      "endurance_capacity_6w",
      "gymnastics_capacity_6w",
      "bar_muscle_up_6w",
      "masters_open_6w",
      "masters_open_preparation_six_week",
      "competition_preparation_6w",
      "open_preparation_6w",
      "masters_open_preparation_6w",
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

test("Strict Strength creates a complete progressive eight-week programme", () => {
  const program = generateStrict();
  const block = program.trainingBlocks[0];
  const allSessions = sessions(program);
  const interferingFamilies = new Set([
    "strict_pull",
    "kipping_pull",
    "bar_muscle_up",
    "ring_muscle_up",
    "handstand",
    "vertical_press",
    "horizontal_press",
  ]);

  assert.equal(block.templateId, "strict_strength_8w");
  assert.equal(block.trainingWeeks.length, 8);
  assert.ok(block.trainingWeeks.every((week) => week.sessions.length === 2));
  assert.ok(
    allSessions.every(
      (session) =>
        session.estimatedDurationMinutes <= 60 &&
        session.conditioning.estimatedDurationMinutes >= 10 &&
        session.conditioning.estimatedDurationMinutes <= 15,
    ),
  );
  assert.ok(
    allSessions.every((session) =>
      session.conditioning.movements.every(
        (movement) => !interferingFamilies.has(movement.movementFamilyId),
      ),
    ),
  );
  assert.ok(
    allSessions
      .flatMap((session) => session.exercises)
      .filter((exercise) => v2.getMovement(exercise.movementId)?.loadable)
      .every(
        (exercise) =>
          exercise.intensityMethod !== "none" &&
          exercise.intensityMethod !== "bodyweight" &&
          exercise.intensityValue != null,
      ),
  );
  assert.ok(
    new Set(
      block.trainingWeeks.map((week) =>
        JSON.stringify(
          week.sessions.flatMap((session) =>
            session.exercises
              .filter((exercise) => exercise.progressionTrackId)
              .map((exercise) => [
                exercise.movementId,
                exercise.sets,
                exercise.reps,
                exercise.intensityValue,
              ]),
          ),
        ),
      ),
    ).size >= 6,
  );
  assert.deepEqual(block.plannedTestMovementIds, [
    "strict_pull_up",
    "strict_press",
  ]);
  assert.deepEqual(
    block.trainingWeeks[7].sessions.map((session) => session.sessionType),
    ["benchmark", "max_test"],
  );
  const pullingBenchmark = block.trainingWeeks[7].sessions[0].exercises.find(
    (exercise) => exercise.section === "primary",
  );
  assert.equal(pullingBenchmark.movementId, "strict_pull_up");
  assert.equal(pullingBenchmark.sets, 1);
  assert.equal(pullingBenchmark.repRangeMin, 1);
  assert.match(
    block.trainingWeeks[7].sessions[0].objective,
    /Retest Strict pull-up/,
  );
  assert.equal(program.validation.valid, true);
});

test("Strict Strength movement ladders respect the athlete's current ability", () => {
  const developing = generateStrict({
    skills: { pullUps: 2, strictHspu: 0, ringDips: 0 },
  });
  const capable = generateStrict({
    athleteLevel: "advanced",
    skills: { pullUps: 14, strictHspu: 10, ringDips: 12 },
  });
  const movementIds = (program) =>
    new Set(
      sessions(program).flatMap((session) =>
        session.exercises.map((exercise) => exercise.movementId),
      ),
    );
  const developingMovements = movementIds(developing);
  const capableMovements = movementIds(capable);

  assert.equal(v2.strictPullupLevel({ skills: { pullUps: 2 } }), "developing");
  assert.equal(v2.strictPullupLevel({ skills: { pullUps: 5 } }), "bodyweight");
  assert.equal(v2.strictPullupLevel({ skills: { pullUps: 14 } }), "weighted");
  assert.equal(developingMovements.has("weighted_pull_up"), false);
  assert.equal(
    developingMovements.has("deficit_strict_handstand_push_up"),
    false,
  );
  assert.equal(developingMovements.has("weighted_dip"), false);
  assert.ok(
    developingMovements.has("assisted_strict_pull_up") ||
      developingMovements.has("eccentric_pull_up"),
  );
  assert.equal(capableMovements.has("weighted_pull_up"), true);
  assert.equal(capableMovements.has("deficit_strict_handstand_push_up"), true);
  assert.equal(capableMovements.has("weighted_dip"), true);
});

test("Strict Strength validation rejects structural and duration regressions", () => {
  const malformed = structuredClone(generateStrict());
  malformed.trainingBlocks[0].trainingWeeks[0].sessions[0].estimatedDurationMinutes = 61;
  malformed.trainingBlocks[0].trainingWeeks[1].sessions.pop();

  const validation = v2.validateProgram(malformed);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.some(
      (issue) => issue.code === "STRICT_STRENGTH_SESSION_TOO_LONG",
    ),
  );
  assert.ok(
    validation.issues.some(
      (issue) => issue.code === "STRICT_STRENGTH_SESSION_COUNT",
    ),
  );
});

test("Strict Strength deterministic fixture remains stable", () => {
  const program = generateStrict({
    programId: "11111111-1111-4111-a111-111111111111",
    generatedAt: "2026-08-22T10:00:00.000Z",
    seed: "strict-strength-fixture",
    maxes: { ...generationInput().maxes, strict_press: 70 },
    skills: {
      pullUps: 5,
      chestToBar: 0,
      toesToBar: 0,
      barMuscleUps: 0,
      strictHspu: 0,
      ringDips: 6,
      handstandWalkMeters: 0,
    },
  });
  const block = program.trainingBlocks[0];
  const summary = {
    templateId: block.templateId,
    name: program.name,
    weeks: block.trainingWeeks.map((week) => ({
      week: week.weekNumber,
      theme: week.theme,
      sessions: week.sessions.map((session) => ({
        type: session.sessionType,
        duration: session.estimatedDurationMinutes,
        progression: session.exercises
          .filter((exercise) => exercise.progressionTrackId)
          .map(
            (exercise) =>
              `${exercise.movementId}:${exercise.sets}x${exercise.reps}:${exercise.intensityMethod}:${exercise.intensityValue}`,
          ),
        conditioningMinutes: session.conditioning.estimatedDurationMinutes,
      })),
    })),
  };

  assert.deepEqual(summary, strictStrengthSnapshot);
});

test("programme types produce materially different six-week workout fingerprints", () => {
  const templates = [
    ["mixed_strength_6w", "mixed_strength"],
    ["mixed_strength_8w_testing", "mixed_strength"],
    ["olympic_lifting_6w", "olympic_lifting_development"],
    ["endurance_capacity_6w", "aerobic_capacity"],
    ["general_crossfit_6w", "mixed_strength"],
  ];
  const programmes = templates.map(([templateId, blockType]) =>
    v2.generateV2Program({
      ...generationInput({ templateId, blockType }),
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
    programmes[0].trainingBlocks[0].templateId,
    programmes[1].trainingBlocks[0].templateId,
  );
});

test("REG-004 programme profiles materially differentiate gymnastics, Olympic, engine, and strength content", () => {
  const gymnastics = profileProgram("general_crossfit", "gymnastics_capacity");
  const olympic = profileProgram(
    "general_crossfit",
    "olympic_lifting_development",
  );
  const engine = profileProgram("endurance", "aerobic_capacity");
  const strength = profileProgram("strength", "back_squat_strength");

  assert.ok(
    exposure(
      gymnastics,
      "strict_pull",
      "kipping_pull",
      "bar_muscle_up",
      "toes_to_bar",
      "handstand",
      "core",
    ) >
      exposure(
        olympic,
        "strict_pull",
        "kipping_pull",
        "bar_muscle_up",
        "toes_to_bar",
        "handstand",
        "core",
      ),
  );
  assert.ok(
    exposure(olympic, "snatch", "clean", "jerk", "clean_and_jerk") >
      exposure(gymnastics, "snatch", "clean", "jerk", "clean_and_jerk"),
  );
  assert.ok(
    engine.generationSummary.movementExposures.conditioning_minutes >
      strength.generationSummary.movementExposures.conditioning_minutes,
  );
  assert.ok(
    exposure(strength, "front_squat", "back_squat", "hinge", "vertical_press") >
      exposure(engine, "front_squat", "back_squat", "hinge", "vertical_press"),
  );
  assert.equal(
    v2.validateProgrammeDifferentiation([gymnastics, olympic, engine, strength])
      .valid,
    true,
  );
  assert.equal(
    new Set(
      [gymnastics, olympic, engine, strength].map(
        (program) => program.generationFingerprint,
      ),
    ).size,
    4,
  );
});

test("REG-004 General CrossFit plus gymnastics capacity builds an eight-week gymnastics progression and retest", () => {
  const program = profileProgram("general_crossfit", "gymnastics_capacity");
  const block = program.trainingBlocks[0];
  const allSessions = sessions(program);
  const firstWeek = block.trainingWeeks[0];
  const lastWeek = block.trainingWeeks[7];
  const gymnasticsFamilies = new Set(
    allSessions.flatMap((session) =>
      session.exercises
        .filter(
          (exercise) =>
            v2.getMovement(exercise.movementId)?.category === "gymnastics",
        )
        .map((exercise) => exercise.movementFamilyId),
    ),
  );

  assert.equal(block.durationWeeks, 8);
  assert.equal(allSessions.length, 16);
  assert.equal(program.programmeProfile.primaryGoal, "general_crossfit");
  assert.equal(program.programmeProfile.trainingBlock, "gymnastics_capacity");
  assert.equal(program.programmeProfile.focus, "gymnastics");
  assert.ok(
    block.trainingWeeks.every((week) =>
      week.sessions.some((session) =>
        session.exercises.some(
          (exercise) =>
            v2.getMovement(exercise.movementId)?.category === "gymnastics",
        ),
      ),
    ),
  );
  assert.ok(gymnasticsFamilies.size >= 3);
  assert.ok(exposure(program, "front_squat", "back_squat") < 8);
  assert.equal(
    exposure(program, "snatch", "clean", "jerk", "clean_and_jerk"),
    0,
  );
  assert.doesNotMatch(
    firstWeek.sessions.map((session) => session.objective).join(" "),
    /front.squat|snatch/i,
  );
  assert.deepEqual(
    lastWeek.sessions.map((session) => session.sessionType),
    ["benchmark", "benchmark"],
  );
  assert.match(
    lastWeek.sessions.map((session) => session.objective).join(" "),
    /retest.*chest-to-bar.*retest.*handstand/i,
  );
  assert.ok(
    allSessions.some((session) =>
      session.exercises.some(
        (exercise) => exercise.movementId === "chest_to_bar_pull_up",
      ),
    ),
  );
  assert.ok(
    allSessions.some((session) =>
      session.exercises.some(
        (exercise) => exercise.movementId === "toes_to_bar",
      ),
    ),
  );
  assert.equal(program.generationSummary.identityValidation.valid, true);
  assert.equal(
    v2.validateProgrammeIdentity(program, program.programmeProfile).valid,
    true,
  );
});

test("identity validation rejects a cosmetic profile relabel", () => {
  const gymnastics = profileProgram("general_crossfit", "gymnastics_capacity");
  const olympic = profileProgram(
    "general_crossfit",
    "olympic_lifting_development",
  );
  const result = v2.validateProgrammeIdentity(
    gymnastics,
    olympic.programmeProfile,
  );

  assert.equal(result.valid, false);
  assert.ok(result.problems.some((problem) => /snatch/.test(problem)));
  assert.ok(result.problems.some((problem) => /clean_and_jerk/.test(problem)));
});

test("athlete level changes gymnastics complexity without changing programme identity", () => {
  const skills = {
    pullUps: 15,
    chestToBar: 10,
    toesToBar: 12,
    barMuscleUps: 2,
    strictHspu: 3,
    handstandWalkMeters: 10,
  };
  const beginner = profileProgram("gymnastics", "gymnastics_capacity", {
    athleteLevel: "beginner",
    skills,
    programId: v2.stableUuid("gymnastics-level", "beginner"),
  });
  const advanced = profileProgram("gymnastics", "gymnastics_capacity", {
    athleteLevel: "advanced",
    skills,
    programId: v2.stableUuid("gymnastics-level", "advanced"),
  });

  assert.equal(beginner.programmeProfile.focus, "gymnastics");
  assert.equal(advanced.programmeProfile.focus, "gymnastics");
  assert.equal(
    sessions(beginner).some((session) =>
      session.exercises.some(
        (exercise) => exercise.movementId === "bar_muscle_up",
      ),
    ),
    false,
  );
  assert.equal(
    sessions(advanced).some((session) =>
      session.exercises.some(
        (exercise) => exercise.movementId === "bar_muscle_up",
      ),
    ),
    true,
  );
  assert.ok(exposure(beginner, "toes_to_bar", "handstand") > 0);
  assert.ok(exposure(advanced, "toes_to_bar", "handstand") > 0);
});

test("competition, Open, and Masters/Open use independent programming families", () => {
  const inputs = [
    ["mixed_strength_6w", "mixed_strength"],
    ["competition_preparation_6w", "competition_preparation"],
    ["open_preparation_6w", "open_preparation"],
    ["masters_open_preparation_6w", "masters_open_preparation"],
  ];
  const programmes = inputs.map(([templateId, blockType]) =>
    v2.generateV2Program(
      generationInput({
        templateId,
        blockType,
        programId: v2.stableUuid(
          "44444444-4444-4444-a444-444444444444",
          templateId,
        ),
      }),
    ),
  );
  assert.deepEqual(
    programmes.map((program) => program.trainingBlocks[0].templateId),
    inputs.map(([templateId]) => templateId),
  );
  assert.equal(
    new Set(programmes.map((program) => program.generationFingerprint)).size,
    programmes.length,
  );
  const weekFour = programmes.map(
    (program) => program.trainingBlocks[0].trainingWeeks[3],
  );
  assert.equal(new Set(weekFour.map((week) => week.theme)).size, 4);
  assert.ok(
    weekFour[1].sessions.some(
      (session) =>
        session.conditioning?.competitionMetadata?.setStrategy?.length,
    ),
  );
  assert.ok(
    weekFour[2].sessions.some(
      (session) =>
        session.conditioning?.competitionMetadata?.pacingPlan?.length,
    ),
  );
  assert.ok(
    weekFour[3].sessions.some((session) => session.fatigueFocus === "recovery"),
  );
  assert.notDeepEqual(
    sessions(programmes[2]).map((session) => session.conditioning?.format),
    sessions(programmes[3]).map((session) => session.conditioning?.format),
  );
  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const weekSignatures = programmes.map((program) => {
      const week = program.trainingBlocks[0].trainingWeeks[weekIndex];
      return JSON.stringify({
        theme: week.theme,
        objectives: week.sessions.map((session) => session.objective),
        formats: week.sessions.map((session) => session.conditioning?.format),
        movements: week.sessions.flatMap((session) =>
          session.conditioning?.movements.map(
            (movement) => movement.movementId,
          ),
        ),
      });
    });
    assert.equal(
      new Set(weekSignatures).size,
      4,
      `programming families must differ in week ${weekIndex + 1}`,
    );
  }
});

test("Masters/Open preparation uses a dedicated competition template", () => {
  const mixed = v2.generateV2Program(
    generationInput({
      templateId: "mixed_strength_6w",
      blockType: "mixed_strength",
    }),
  );
  const open = v2.generateV2Program(
    generationInput({
      templateId: "masters_open_preparation_6w",
      blockType: "masters_open_preparation",
    }),
  );
  const openSessions = sessions(open);
  assert.equal(
    open.trainingBlocks[0].templateId,
    "masters_open_preparation_6w",
  );
  assert.equal(open.trainingBlocks[0].blockType, "masters_open_preparation");
  assert.notDeepEqual(
    openSessions.map((session) => session.objective),
    sessions(mixed).map((session) => session.objective),
  );
  assert.ok(
    [4, 5].every((weekNumber) =>
      open.trainingBlocks[0].trainingWeeks[weekNumber - 1].sessions.some(
        (session) =>
          session.conditioning?.competitionMetadata?.competitionStyle,
      ),
    ),
  );
  assert.ok(
    openSessions.some(
      (session) => session.conditioning?.competitionMetadata?.pacingPlan.length,
    ),
  );
  assert.ok(
    openSessions.some((session) =>
      session.conditioning?.movements.some(
        (movement) => movement.movementId === "hang_clean_and_jerk",
      ),
    ),
  );
  assert.ok(
    openSessions.every(
      (session) =>
        session.provisional === false && session.estimatedDurationMinutes <= 65,
    ),
  );
  assert.ok(
    openSessions.every(
      (session) => !JSON.stringify(session).includes("rematerialized"),
    ),
  );
  assert.equal(v2.validateProgram(open).valid, true);
});

test("unsupported block types never silently resolve to mixed strength", () => {
  assert.throws(
    () => v2.getV2TemplateForBlockType("front_squat_accumulation"),
    /UNSUPPORTED_BLOCK_TYPE/,
  );
  assert.equal(
    v2.getV2TemplateForBlockType("masters_open_preparation").id,
    "masters_open_preparation_6w",
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

test("REG-011 exact vague gymnastics theme is rejected at the final string guard", () => {
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

test("REG-010 exact unloaded tall-snatch-pull block returns MISSING_LOAD and MISSING_REST", () => {
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

test("REG-008 REG-009 regenerating conditioning is immutable and section-scoped", () => {
  const program = generate();
  const session = sessions(program)[0];
  const originalProgram = structuredClone(program);
  const originalSession = structuredClone(session);
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

  assert.deepEqual(program, originalProgram);
  assert.deepEqual(next.warmup, originalSession.warmup);
  assert.deepEqual(next.exercises, originalSession.exercises);
  assert.notDeepEqual(next.conditioning, originalSession.conditioning);
  assert.deepEqual(next.trackAssignments, assignments);
  assert.deepEqual(
    next.exercises
      .filter((exercise) => exercise.progressionTrackId)
      .map((exercise) => exercise.id),
    exerciseIds,
  );
  assert.deepEqual(regenerated.changedSectionIds, [
    `${session.id}-conditioning`,
  ]);
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

test("completion stores estimated-versus-actual conditioning performance", () => {
  const program = generate();
  const session = sessions(program).find(
    (candidate) => candidate.weekNumber === 3 && candidate.sessionNumber === 1,
  );
  const completed = v2.applySessionCompletion({
    program,
    sessionId: session.id,
    expectedRevision: session.revision,
    feedback: successfulFeedback(session, {
      conditioningDurationSecondsActual: 405,
    }),
  });
  const stored = v2.findSession(completed.program, session.id).feedback;

  assert.equal(stored.conditioningPerformance.prescribedTargetMin, 480);
  assert.equal(stored.conditioningPerformance.prescribedTargetMax, 600);
  assert.equal(
    stored.conditioningPerformance.estimatedDuration,
    session.conditioning.durationEstimate.estimatedSeconds,
  );
  assert.equal(stored.conditioningPerformance.actualDuration, 405);
  assert.equal(stored.conditioningPerformance.athleteRpe, 8);
  assert.equal(
    stored.conditioningPerformance.performanceRatio,
    Math.round(
      (405 / session.conditioning.durationEstimate.estimatedSeconds) * 1000,
    ) / 1000,
  );
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
  assert.equal(record.programmingGoal, "mixed");
  assert.equal(record.generationSeed, "test-seed");
  assert.equal(record.estimatedSessionDurations.length, 12);
  assert.ok(record.selectedMovementFamilies.includes("snatch"));
  assert.ok(record.selectedMovementFamilies.includes("clean_and_jerk"));
  assert.ok(record.movementExposures.snatch > 0);
  assert.equal(record.generatedEmphasis !== null, true);
  assert.equal(record.conditioningStimulusDiagnostics.length, 12);
  const stimulus = record.conditioningStimulusDiagnostics.find(
    (item) => item.targetRange?.min === 480,
  );
  assert.equal(stimulus.targetRange.max, 600);
  assert.equal(stimulus.timeCap, 11);
  assert.equal(stimulus.validationResult, "PASS");
  assert.equal(stimulus.confidence, "medium");
  assert.deepEqual(record.identityProblems, []);
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

test("max-test display replaces inherited template work, including saved sessions", () => {
  const program = generate({ templateId: "mixed_strength_8w_testing" });
  for (const original of program.trainingBlocks[0].trainingWeeks[7].sessions) {
    const session = JSON.parse(JSON.stringify(original));
    const before = structuredClone(session);
    const rendered = v2.formatSessionForDisplay(session);
    assert.deepEqual(
      rendered.sections.map((section) => section.title),
      ["Max test"],
    );
    assert.equal(
      rendered.estimatedTime,
      `${session.maxTestPrescription.estimatedDurationMinutes} min`,
    );
    const text = rendered.sections[0].lines.join("\n");
    assert.match(text, /Warm-up and build-up:/);
    assert.match(text, /Planned attempts:/);
    assert.match(text, /personal record attempt/);
    assert.match(text, /Stopping rules:/);
    assert.match(text, /Fallback:/);
    assert.deepEqual(session, before);
  }
  const training = v2.formatSessionForDisplay(
    program.trainingBlocks[0].trainingWeeks[0].sessions[0],
  );
  assert.ok(
    training.sections.some(
      (section) => section.title === "Primary progression",
    ),
  );
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
