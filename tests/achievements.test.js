"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ACHIEVEMENT_DEFINITIONS,
  evaluateAchievementProgress,
  normalizeAchievementState,
  reconcileAchievementState,
} = require("../achievements.js");

const NOW = "2026-08-02T12:00:00.000Z";

function log(id, date) {
  return { id, date, createdAt: `${date}T12:00:00.000Z` };
}

function attempt(id, metricId, date, isPr = true) {
  return {
    id,
    metricId,
    isPr,
    date,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function byId(progress, id) {
  return progress.find((item) => item.id === id);
}

test("achievement definitions are unique, immutable, and complete", () => {
  assert.equal(ACHIEVEMENT_DEFINITIONS.length, 16);
  assert.equal(
    new Set(ACHIEVEMENT_DEFINITIONS.map((definition) => definition.id)).size,
    16,
  );
  assert.ok(Object.isFrozen(ACHIEVEMENT_DEFINITIONS));
  assert.ok(ACHIEVEMENT_DEFINITIONS.every(Object.isFrozen));
  assert.deepEqual(
    new Set(ACHIEVEMENT_DEFINITIONS.map((item) => item.category)),
    new Set(["consistency", "pr", "benchmark", "skill", "rx"]),
  );
});

test("workout history unlocks volume, rolling-window, and weekly streak badges", () => {
  const logs = [
    log("w1", "2026-06-29"),
    log("w2", "2026-07-06"),
    log("w3", "2026-07-13"),
    log("w4", "2026-07-20"),
    ...Array.from({ length: 8 }, (_, index) =>
      log(`recent-${index}`, `2026-07-${String(24 + index).padStart(2, "0")}`),
    ),
    log("recent-extra", "2026-07-22"),
  ];
  const progress = evaluateAchievementProgress({ logs, now: NOW });

  assert.equal(byId(progress, "first-session").earned, true);
  assert.equal(byId(progress, "training-habit").earned, true);
  assert.equal(byId(progress, "four-week-fire").current, 5);
  assert.equal(byId(progress, "four-week-fire").earned, true);
  assert.equal(byId(progress, "consistency-engine").current, 12);
  assert.equal(byId(progress, "consistency-engine").earned, true);
});

test("PR and benchmark badges use unique successful PR attempts", () => {
  const attempts = [
    attempt("a1", "backSquat", "2026-07-01"),
    attempt("a2", "row1k", "2026-07-02"),
    attempt("a3", "run5k", "2026-07-03"),
    attempt("a4", "murph", "2026-07-04"),
    attempt("a5", "snatch", "2026-07-05"),
    attempt("a5", "snatch", "2026-07-05"),
    attempt("not-pr", "row2k", "2026-07-06", false),
  ];
  const progress = evaluateAchievementProgress({
    prAttempts: attempts,
    now: NOW,
  });

  assert.equal(byId(progress, "pr-collector").current, 5);
  assert.equal(byId(progress, "pr-collector").earned, true);
  assert.equal(byId(progress, "record-machine").earned, false);
  assert.equal(byId(progress, "engine-builder").current, 3);
  assert.equal(byId(progress, "engine-builder").earned, true);
});

test("skill benchmarks and RX Level unlock their exact milestones", () => {
  const progress = evaluateAchievementProgress({
    profile: {
      benchmarks: {
        barMuscleUp: 1,
        ringMuscleUp: 0,
        strictHspu: 2,
        handstandWalk: 5,
      },
    },
    rxLevel: 52,
    now: NOW,
  });

  assert.equal(byId(progress, "first-bar-muscle-up").earned, true);
  assert.equal(byId(progress, "first-ring-muscle-up").earned, false);
  assert.equal(byId(progress, "upside-down").earned, true);
  assert.equal(byId(progress, "handstand-traveller").earned, true);
  assert.equal(byId(progress, "rx-rising").earned, true);
  assert.equal(byId(progress, "rx-contender").earned, true);
  assert.equal(byId(progress, "rx-ready").earned, false);
});

test("reconciliation unlocks retroactively and never revokes earned badges", () => {
  const earnedProgress = evaluateAchievementProgress({
    logs: [log("one", "2026-08-01")],
    now: NOW,
  });
  const first = reconcileAchievementState({}, earnedProgress, NOW);
  assert.deepEqual(first.newlyEarnedIds, ["first-session"]);
  assert.ok(first.state.earned["first-session"]);

  const emptyProgress = evaluateAchievementProgress({ now: NOW });
  const second = reconcileAchievementState(first.state, emptyProgress, NOW);
  assert.deepEqual(second.newlyEarnedIds, []);
  assert.ok(second.state.earned["first-session"]);

  const normalized = normalizeAchievementState({
    ...second.state,
    acknowledgedIds: ["first-session", "unknown"],
    earned: { ...second.state.earned, unknown: NOW },
  });
  assert.deepEqual(normalized.acknowledgedIds, ["first-session"]);
  assert.equal(normalized.earned.unknown, undefined);
});
