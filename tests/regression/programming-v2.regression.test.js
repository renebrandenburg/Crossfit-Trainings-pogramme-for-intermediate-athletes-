"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const v2 = require("../../build/programming-v2.cjs");
const { INTERMEDIATE_V2_ATHLETE } = require("../fixtures/v2-athletes.js");

function generateProfile(
  goal,
  blockType,
  templateId = "mixed_strength_8w_testing",
  seed = "regression-contract-seed",
) {
  return v2.generateV2Program({
    ...INTERMEDIATE_V2_ATHLETE,
    programId: v2.stableUuid("regression", goal, blockType, templateId),
    ownerId: "22222222-2222-4222-a222-222222222222",
    generatedAt: "2026-08-10T08:00:00.000Z",
    blockType,
    goal,
    templateId,
    sessionCount: 2,
    seed,
    restrictions: {
      movementIds: [],
      movementFamilyIds: [],
      guidance: null,
    },
    weightIncrementKg: 2.5,
    roundingMode: "nearest",
  });
}

test("deterministic focused golden summary is stable and records its generation seed", () => {
  const first = generateProfile(
    "general_crossfit",
    "gymnastics_capacity",
    "mixed_strength_8w_testing",
    "golden-seed",
  );
  const repeated = generateProfile(
    "general_crossfit",
    "gymnastics_capacity",
    "mixed_strength_8w_testing",
    "golden-seed",
  );
  const changedSeed = generateProfile(
    "general_crossfit",
    "gymnastics_capacity",
    "mixed_strength_8w_testing",
    "another-seed",
  );
  const summary = (program) => ({
    goal: program.programmeProfile.primaryGoal,
    block: program.programmeProfile.trainingBlock,
    focus: program.programmeProfile.focus,
    template: program.generationRequest.programmeType,
    weeks: program.trainingBlocks[0].trainingWeeks.length,
    sessions: sessions(program).length,
    valid: program.generationSummary.identityValidation.valid,
  });

  assert.deepEqual(summary(first), {
    goal: "general_crossfit",
    block: "gymnastics_capacity",
    focus: "gymnastics",
    template: "mixed_strength_8w_testing",
    weeks: 8,
    sessions: 16,
    valid: true,
  });
  assert.deepEqual(first, repeated);
  assert.equal(first.generationRequest.generationSeed, "golden-seed");
  assert.equal(changedSeed.generationRequest.generationSeed, "another-seed");
});

function sessions(program) {
  return program.trainingBlocks[0].trainingWeeks.flatMap(
    (week) => week.sessions,
  );
}

function movementIds(program) {
  return new Set(
    sessions(program).flatMap((session) => [
      ...session.exercises.map((exercise) => exercise.movementId),
      ...(session.conditioning?.movements.map(
        (movement) => movement.movementId,
      ) ?? []),
    ]),
  );
}

function exposure(program, ...families) {
  return families.reduce(
    (total, family) =>
      total + (program.generationSummary.movementExposures[family] || 0),
    0,
  );
}

test("REG-003 supported templates preserve their declared programme duration", () => {
  for (const template of v2.V2_TEMPLATE_REGISTRY) {
    const program = generateProfile(
      template.blockType === "aerobic_capacity" ? "endurance" : "mixed",
      template.blockType,
      template.id,
    );
    const block = program.trainingBlocks[0];

    assert.equal(block.templateId, template.id);
    assert.equal(block.durationWeeks, template.durationWeeks);
    assert.equal(block.trainingWeeks.length, template.durationWeeks);
    assert.ok(
      block.trainingWeeks.every(
        (week) => week.sessions.length === block.plannedSessionCount,
      ),
    );
  }
});

test("REG-003 duration corruption is rejected before persistence", () => {
  const malformed = structuredClone(
    generateProfile(
      "general_crossfit",
      "gymnastics_capacity",
      "mixed_strength_8w_testing",
    ),
  );
  malformed.trainingBlocks[0].trainingWeeks.pop();

  const validation = v2.validateProgram(malformed);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.some((issue) => issue.code === "INVALID_BLOCK_DURATION"),
  );
});

test("REG-013 unsupported persisted templates report the complete generation context", () => {
  const malformed = structuredClone(
    generateProfile(
      "general_crossfit",
      "gymnastics_capacity",
      "mixed_strength_8w_testing",
    ),
  );
  delete malformed.trainingBlocks[0].templateId;

  const validation = v2.validateProgram(malformed);
  const unsupportedTemplate = validation.issues.find(
    (issue) => issue.code === "UNSUPPORTED_TEMPLATE",
  );

  assert.equal(validation.valid, false);
  assert.deepEqual(unsupportedTemplate, {
    code: "UNSUPPORTED_TEMPLATE",
    severity: "error",
    path: `program.trainingBlocks.${malformed.trainingBlocks[0].id}.templateId`,
    message: "Generated programme uses unsupported template <missing>.",
    template: null,
    programmeId: malformed.id,
    programmeType: "mixed_strength_8w_testing",
    week: null,
    day: null,
    sessionId: null,
  });
});

test("REG-013 every independently selectable V2 configuration generates a valid supported template", () => {
  const goals = [
    "mixed",
    "strength",
    "endurance",
    "gymnastics",
    "bar_muscle_up",
    "masters_open",
    "competition",
    "open",
    "olympic_lifting",
    "general_crossfit",
  ];
  const blockTypes = [
    "mixed_strength",
    "back_squat_strength",
    "aerobic_capacity",
    "gymnastics_capacity",
    "olympic_lifting_development",
    "competition_preparation",
    "open_preparation",
    "masters_open_preparation",
    "deload",
  ];

  assert.deepEqual(
    v2.V2_SELECTABLE_TEMPLATES.map((template) => template.id),
    [
      "mixed_strength_6w",
      "mixed_strength_8w_testing",
      "endurance_capacity_6w",
      "gymnastics_capacity_6w",
      "competition_preparation_6w",
      "open_preparation_6w",
      "masters_open_preparation_6w",
      "olympic_lifting_6w",
      "general_crossfit_6w",
    ],
  );

  for (const goal of goals) {
    for (const blockType of blockTypes) {
      for (const template of v2.V2_SELECTABLE_TEMPLATES) {
        const program = generateProfile(
          goal,
          blockType,
          template.id,
          "selectable-template-matrix",
        );

        assert.equal(program.trainingBlocks[0].templateId, template.id);
        assert.equal(v2.validateProgram(program).valid, true);
      }
    }
  }
});

test("REG-004 programme profiles have explicit, materially different identities", () => {
  const gymnastics = generateProfile("general_crossfit", "gymnastics_capacity");
  const olympic = generateProfile(
    "olympic_lifting",
    "olympic_lifting_development",
  );
  const engine = generateProfile("endurance", "aerobic_capacity");
  const strength = generateProfile("strength", "back_squat_strength");

  assert.deepEqual(
    [gymnastics, olympic, engine, strength].map((program) => [
      program.programmeProfile.primaryGoal,
      program.programmeProfile.trainingBlock,
      program.programmeProfile.focus,
    ]),
    [
      ["general_crossfit", "gymnastics_capacity", "gymnastics"],
      ["olympic_lifting", "olympic_lifting_development", "olympic"],
      ["endurance", "aerobic_capacity", "conditioning"],
      ["strength", "back_squat_strength", "strength"],
    ],
  );
  assert.equal(
    v2.validateProgrammeDifferentiation([gymnastics, olympic, engine, strength])
      .valid,
    true,
  );
});

test("REG-004 request, profile, block, and session identity cannot diverge", () => {
  const source = generateProfile("general_crossfit", "gymnastics_capacity");
  const corruptions = [
    {
      code: "PROGRAMME_GOAL_MISMATCH",
      mutate(program) {
        program.generationRequest.athleteGoals = ["strength"];
      },
    },
    {
      code: "PROGRAMME_BLOCK_MISMATCH",
      mutate(program) {
        program.trainingBlocks[0].blockType = "aerobic_capacity";
      },
    },
    {
      code: "PROGRAMME_TYPE_MISMATCH",
      mutate(program) {
        program.generationRequest.programmeType = "olympic_lifting_6w";
      },
    },
    {
      code: "PROGRAMME_DURATION_MISMATCH",
      mutate(program) {
        program.generationRequest.cycleLengthWeeks = 6;
      },
    },
    {
      code: "PROGRAMME_VERSION_MISMATCH",
      mutate(program) {
        program.generationRequest.programmeVersion = "stale-template";
      },
    },
    {
      code: "PROGRAMME_FREQUENCY_MISMATCH",
      mutate(program) {
        program.generationRequest.sessionsPerWeek = 4;
      },
    },
    {
      code: "ACTIVE_BLOCK_MISMATCH",
      mutate(program) {
        program.activeTrainingBlockId = "00000000-0000-4000-a000-000000000000";
      },
    },
  ];

  for (const corruption of corruptions) {
    const program = structuredClone(source);
    corruption.mutate(program);
    const validation = v2.validateProgram(program);
    assert.equal(validation.valid, false, corruption.code);
    assert.ok(
      validation.issues.some((issue) => issue.code === corruption.code),
      corruption.code,
    );
  }
});

test("REG-014 historical eight-week programmes remain valid after a generator upgrade", () => {
  const historical = structuredClone(
    generateProfile("strength", "back_squat_strength"),
  );
  const persistedVersion = "mixed-strength-6w-v1";
  historical.templateVersion = persistedVersion;
  historical.generatorVersion = persistedVersion;
  historical.generationRequest.programmeVersion = persistedVersion;
  historical.trainingBlocks[0].currentWeek = 2;
  delete historical.programmeProfile;
  delete historical.generationSummary;
  const beforeValidation = structuredClone(historical);

  const loaded = v2.validateProgram(historical);

  assert.equal(loaded.valid, true);
  assert.equal(
    loaded.issues.some((issue) => issue.code === "PROGRAMME_VERSION_MISMATCH"),
    false,
  );
  assert.deepEqual(historical, beforeValidation);
  assert.equal(historical.trainingBlocks[0].trainingWeeks.length, 8);
  assert.equal(sessions(historical).length, 16);
  assert.equal(historical.trainingBlocks[0].currentWeek, 2);
  assert.equal(v2.validateGeneratedProgram(historical).valid, false);
});

test("REG-005 Open preparation satisfies its programme-level quality contract", () => {
  const program = generateProfile("open", "open_preparation");
  const allSessions = sessions(program);
  const formats = new Set(
    allSessions.map((session) => session.conditioning?.format).filter(Boolean),
  );

  assert.equal(program.programmeProfile.conditioningStyle, "open");
  assert.ok(exposure(program, "strict_pull", "toes_to_bar", "handstand") > 0);
  assert.ok(exposure(program, "burpee", "rowing", "bike", "running") > 0);
  assert.ok(
    allSessions.some((session) =>
      Boolean(session.conditioning?.competitionMetadata?.competitionStyle),
    ),
  );
  assert.ok(
    allSessions.some(
      (session) => (session.conditioning?.movements.length || 0) >= 3,
    ),
  );
  assert.ok(formats.size >= 3);
});

test("REG-006 Masters/Open remains progressive, recoverable, and legitimate", () => {
  const program = generateProfile("masters_open", "masters_open_preparation");
  const allSessions = sessions(program);

  assert.equal(program.programmeProfile.primaryGoal, "masters_open");
  assert.equal(program.programmeProfile.conditioningStyle, "open");
  assert.ok(
    allSessions.every(
      (session) =>
        session.fatigueFocus === "recovery" &&
        session.estimatedDurationMinutes <= 65,
    ),
  );
  assert.ok(
    allSessions.every(
      (session) =>
        session.exercises.every(
          (exercise) => exercise.scalingOptions.length > 0,
        ) && (session.conditioning?.scalingOptions.length || 0) > 0,
    ),
  );
  assert.ok(exposure(program, "back_squat", "hinge", "vertical_press") > 0);
});

test("REG-007 Olympic lifting contains lifts, pulls, positions, and squat support", () => {
  const program = generateProfile(
    "olympic_lifting",
    "olympic_lifting_development",
  );
  const movements = movementIds(program);

  assert.ok(movements.has("snatch"));
  assert.ok(movements.has("clean_and_jerk"));
  assert.ok(movements.has("hang_power_snatch"));
  assert.ok(movements.has("hang_clean_and_jerk"));
  assert.ok(movements.has("snatch_pull"));
  assert.ok(movements.has("clean_pull"));
  assert.ok(exposure(program, "front_squat", "back_squat") > 0);
  assert.ok(
    exposure(program, "snatch", "clean", "jerk", "clean_and_jerk") >=
      exposure(program, "front_squat", "back_squat"),
  );
});
