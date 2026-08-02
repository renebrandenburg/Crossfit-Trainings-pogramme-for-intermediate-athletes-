"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const catalog = require("../movement-catalog.js");
const app = require("../app.js");

test("movement catalog exposes unique, immutable, complete definitions", () => {
  const ids = catalog.MOVEMENT_CATALOG.map((movement) => movement.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(Object.isFrozen(catalog.MOVEMENT_CATALOG));
  assert.ok(Object.isFrozen(catalog.ORDERED_MOVEMENT_POOLS));

  for (const movement of catalog.MOVEMENT_CATALOG) {
    assert.match(movement.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(movement.displayName);
    assert.ok(movement.discipline);
    assert.ok(movement.roles.length > 0);
    assert.ok(movement.supportedTargetTypes.length > 0);
    assert.equal(catalog.getMovementDefinition(movement.id), movement);
    assert.equal(catalog.isRegisteredMovement(movement.id), true);
  }
});

test("movement aliases and semantic metadata preserve current behavior", () => {
  assert.equal(catalog.resolveMovementId("DB snatches"), "dumbbell-snatches");
  assert.equal(catalog.resolveMovementId("KB swings"), "kettlebell-swings");
  assert.equal(
    catalog.resolveMovementId("hang power clean drills"),
    "hang-power-clean-drill",
  );
  assert.equal(catalog.getOlympicFamily("hang-power-cleans"), "clean");
  assert.equal(catalog.getOlympicFamily("hang-power-snatches"), "snatch");
  assert.equal(catalog.isConditioningEligible("hang-power-clean-drill"), false);
  assert.equal(catalog.isConditioningEligible("hang-power-cleans"), true);
  assert.equal(catalog.isConditioningEligible("tall-clean-pulls"), false);
  assert.equal(
    catalog.sameMovement(
      { movement: "DB snatches" },
      { movementId: "dumbbell-snatches" },
    ),
    true,
  );
});

test("movement catalog identifies loaded prescriptions structurally", () => {
  [
    "tall-clean-pulls",
    "front-rack-hold",
    "kettlebell-swings",
    "wall-balls",
    "loaded-carry",
    "dumbbell-lunges",
  ].forEach((movementId) => {
    assert.equal(
      catalog.getMovementDefinition(movementId).loadRequired,
      true,
      `${movementId} should require load guidance`,
    );
  });
  assert.equal(catalog.getMovementDefinition("air-squats").loadRequired, false);
  assert.equal(
    catalog.getMovementDefinition("tall-snatch-pulls").referenceLift,
    "snatch",
  );
});

test("Olympic movement metadata classifies families and meaningful exposure", () => {
  const cleanIds = [
    "clean",
    "power-clean",
    "hang-clean",
    "hang-power-cleans",
    "clean-pulls",
    "tall-clean-pulls",
    "clean-and-jerk",
  ];
  const snatchIds = [
    "snatch",
    "power-snatch",
    "hang-snatch",
    "hang-power-snatches",
    "snatch-pulls",
    "tall-snatch-pulls",
  ];

  cleanIds.forEach((movementId) => {
    assert.equal(catalog.getOlympicFamily(movementId), "clean");
    assert.equal(catalog.isMeaningfulOlympicExposure(movementId), true);
  });
  snatchIds.forEach((movementId) => {
    assert.equal(catalog.getOlympicFamily(movementId), "snatch");
    assert.equal(catalog.isMeaningfulOlympicExposure(movementId), true);
  });
  assert.equal(catalog.getOlympicVariationType("hang-clean"), "hang");
  assert.equal(catalog.getOlympicVariationType("snatch-pulls"), "pull");
  assert.equal(catalog.getOlympicFamily("hang-power-clean-drill"), "clean");
  assert.equal(
    catalog.getOlympicVariationType("hang-power-clean-drill"),
    "technique",
  );
  [
    "front-squats",
    "front-rack-hold",
    "overhead-squats",
    "overhead-hold",
  ].forEach((movementId) => {
    assert.equal(catalog.getOlympicVariationType(movementId), "position");
    assert.equal(catalog.isMeaningfulOlympicExposure(movementId), false);
  });
  assert.equal(catalog.isConditioningEligible("hang-power-snatches"), true);
});

test("equipment and barbell substitutions resolve to registered IDs", () => {
  assert.deepEqual(
    catalog.getEquipmentSubstitution(
      { movementId: "dumbbell-snatches", movement: "DB snatches" },
      ["kettlebells"],
    ),
    {
      movementId: "kettlebell-snatches",
      displayName: "kettlebell snatches",
      resetTarget: false,
      clearLoad: false,
    },
  );
  assert.deepEqual(
    catalog.getEquipmentSubstitution({ movementId: "row", movement: "row" }, [
      "running",
    ]),
    {
      movementId: "run",
      displayName: "run",
      resetTarget: false,
      clearLoad: false,
    },
  );
  assert.equal(
    catalog.getBarbellDropSubstitution("clean-and-jerks").id,
    "hand-release-push-ups",
  );
});

test("ordered generator pools contain registered movements in stable order", () => {
  assert.deepEqual(catalog.getOrderedMovementPool("weighted", "balanced"), [
    "power-cleans",
    "overhead-squats",
    "dumbbell-snatches",
    "kettlebell-swings",
    "clean-and-jerks",
  ]);

  for (const pool of Object.values(catalog.ORDERED_MOVEMENT_POOLS)) {
    for (const movementIds of Object.values(pool)) {
      movementIds.forEach((movementId) => {
        assert.equal(
          catalog.isRegisteredMovement(movementId),
          true,
          `${movementId} should resolve from its generator pool`,
        );
      });
    }
  }

  const weaknessIds = Object.values(catalog.WEAKNESS_MOVEMENT_IDS).flatMap(
    (value) => (typeof value === "string" ? [value] : Object.values(value)),
  );
  weaknessIds.forEach((movementId) => {
    assert.equal(catalog.isRegisteredMovement(movementId), true);
  });
});

test("Learn movement data remains available through the ForgeHour API", () => {
  assert.deepEqual(app.MOVEMENT_LIBRARY, catalog.MOVEMENT_LIBRARY);
  assert.ok(catalog.MOVEMENT_LIBRARY.length >= 20);
  assert.ok(
    catalog.MOVEMENT_LIBRARY.every(
      (movement) => movement.cues.length && movement.videoUrl,
    ),
  );
});
