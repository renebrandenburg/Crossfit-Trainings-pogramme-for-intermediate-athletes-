"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../movement-catalog.js");
const prescriptions = require("../training-prescriptions.js");
const app = require("../app.js");

function gymnasticsFixture(overrides = {}) {
  const base = {
    schemaVersion: prescriptions.TRAINING_BLOCK_SCHEMA_VERSION,
    id: "gymnastics-test",
    title: "Gymnastics skill",
    category: "gymnastics",
    durationMinutes: 12,
    trainingIntent: ["hollow and arch control", "strict pulling"],
    prescription: {
      format: { type: "rounds", rounds: 3 },
      exercises: [
        {
          id: "hollow",
          movementId: "hollow-hold",
          name: "hollow hold",
          target: { type: "duration_seconds", value: 20 },
        },
        {
          id: "arch",
          movementId: "arch-hold",
          name: "arch hold",
          target: { type: "duration_seconds", value: 20 },
        },
        {
          id: "pullups",
          movementId: "strict-pull-ups",
          name: "strict pull-ups",
          target: { type: "reps", value: 6 },
        },
        {
          id: "raises",
          movementId: "hanging-knee-raises",
          name: "hanging knee raises",
          target: { type: "reps", value: 10 },
        },
      ],
      rest: { after: "round", seconds: 60 },
      scalingOptions: ["Use ring rows and dead bugs."],
      coachingNotes: [],
    },
  };
  return {
    ...base,
    ...overrides,
    prescription: {
      ...base.prescription,
      ...(overrides.prescription || {}),
    },
  };
}

test("loaded movements require measurable guidance and accept RPE", () => {
  const missing = {
    ...gymnasticsFixture(),
    id: "clean-technique",
    category: "weightlifting",
    prescription: {
      format: { type: "sets", sets: 3 },
      exercises: [
        {
          id: "pull",
          movementId: "tall-clean-pulls",
          name: "tall clean pulls",
          target: { type: "reps", value: 3 },
        },
        {
          id: "hold",
          movementId: "front-rack-hold",
          name: "front-rack hold",
          target: { type: "duration_seconds", value: 20 },
        },
      ],
      rest: { after: "set", seconds: 60 },
      scalingOptions: [],
      coachingNotes: [],
    },
  };

  assert.deepEqual(
    prescriptions
      .trainingBlockIssues(missing)
      .filter((issue) => issue.code === "MISSING_LOAD")
      .map((issue) => issue.exerciseId),
    ["pull", "hold"],
  );

  missing.prescription.exercises[0].load = { rpe: { min: 5, max: 6 } };
  assert.equal(
    prescriptions
      .trainingBlockIssues(missing)
      .some(
        (issue) => issue.code === "MISSING_LOAD" && issue.exerciseId === "pull",
      ),
    false,
  );

  const repaired = prescriptions.repairTrainingBlock(missing);
  assert.equal(
    repaired.prescription.exercises.every(
      (item) =>
        !catalog.getMovementDefinition(item.movementId)?.loadRequired ||
        prescriptions.measurableLoad(item.load),
    ),
    true,
  );
});

test("vague gymnastics intent fails while a complete block passes", () => {
  const vague = gymnasticsFixture({
    trainingIntent: [
      "Hollow and arch control, strict pulling, and midline strength",
    ],
    prescription: { exercises: [] },
  });
  assert.ok(
    prescriptions
      .trainingBlockIssues(vague)
      .some((issue) => issue.code === "VAGUE_SKILL_BLOCK"),
  );
  assert.deepEqual(prescriptions.trainingBlockIssues(gymnasticsFixture()), []);
});

test("gymnastics completeness reports missing volume, rest, and scaling", () => {
  const incomplete = gymnasticsFixture({
    prescription: {
      exercises: [
        {
          id: "pullups",
          movementId: "strict-pull-ups",
          name: "strict pull-ups",
        },
      ],
      rest: undefined,
      scalingOptions: [],
    },
  });
  delete incomplete.prescription.rest;
  assert.deepEqual(
    new Set(
      prescriptions
        .trainingBlockIssues(incomplete)
        .map((validationIssue) => validationIssue.code),
    ),
    new Set(["MISSING_VOLUME", "MISSING_REST", "MISSING_SCALING"]),
  );
});

test("EMOM format controls rest without an explicit rest field", () => {
  const emom = gymnasticsFixture({
    durationMinutes: 10,
    prescription: {
      format: { type: "emom", rounds: 5, intervalSeconds: 60 },
      rest: undefined,
    },
  });
  delete emom.prescription.rest;
  assert.equal(
    prescriptions
      .trainingBlockIssues(emom)
      .some((issue) => issue.code === "MISSING_REST"),
    false,
  );
});

test("generated programmes persist actionable blocks and loaded WOD guidance", () => {
  const sessions = app.buildGeneratedProgramme(
    {
      primaryGoal: "balanced",
      secondaryGoal: "endurance",
      programDaysPerWeek: 2,
      totalTrainingDays: 4,
      weakness: "olympic",
      sessionDuration: 60,
      athleteLevel: "intermediate",
    },
    app.cloneDefaultProfile(),
    (id) => id,
    "actionable-regression",
  );

  assert.equal(sessions.length, 16);
  sessions.forEach((session) => {
    assert.deepEqual(prescriptions.generatedTrainingIssues(session), []);
    session.trainingBlocks.forEach((trainingBlock) => {
      assert.ok(trainingBlock.durationMinutes > 0);
      assert.ok(trainingBlock.prescription.exercises.length > 0);
    });
    const definition = session.workoutDefinition;
    const exercises = [
      ...(definition.buyIn || []),
      ...(definition.exercises || []),
      ...(definition.format?.stations || []).flatMap(
        (station) => station.exercises || [],
      ),
      ...(definition.afterEachRound || []),
      ...(definition.cashOut || []),
    ];
    exercises.forEach((item) => {
      const movement = catalog.getMovementDefinition(item.movementId);
      if (movement?.loadRequired) {
        assert.equal(prescriptions.measurableLoad(item.load), true);
      }
    });
  });

  const serialized = JSON.stringify(sessions);
  assert.ok(Buffer.byteLength(serialized) < 5 * 1024 * 1024);
  assert.doesNotMatch(serialized, /clean pulls or snatch pulls/i);
  assert.doesNotMatch(serialized, /hang power clean drills/i);
  assert.ok(serialized.includes("tall-clean-pulls"));
  assert.ok(serialized.includes("tall-snatch-pulls"));
});
