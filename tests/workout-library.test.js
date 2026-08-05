"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BENCHMARKS,
  OPEN_WORKOUTS,
  generateEmom,
  filterCatalog,
} = require("../src/workout-library/index.js");

test("EMOM generation is deterministic and lasts forty minutes", () => {
  const options = {
    focus: "mixed",
    seed: "test-seed",
    profile: {
      availableEquipment: ["rower", "kettlebell", "dumbbell", "wallBall"],
    },
  };
  const first = generateEmom(options);
  const second = generateEmom(options);

  assert.deepEqual(first, second);
  assert.equal(first.durationMinutes, 40);
  assert.equal(first.rounds * first.stations.length, 40);
  assert.ok(
    first.stations.every(
      (station) =>
        !station.equipment ||
        options.profile.availableEquipment.includes(station.equipment),
    ),
  );
});

test("Open catalog filters by year and movement", () => {
  const results = filterCatalog(OPEN_WORKOUTS, { year: 2024, movement: "row" });
  assert.deepEqual(
    results.map((item) => item.number),
    ["24.2"],
  );
});

test("benchmark catalog contains the four initial sections", () => {
  assert.deepEqual(
    [...new Set(BENCHMARKS.map((item) => item.groupId))],
    ["girls", "strength", "conditioning", "gymnastics"],
  );
  assert.ok(BENCHMARKS.some((item) => item.title === "Fran"));
  assert.ok(BENCHMARKS.some((item) => item.title === "2k Row"));
});
