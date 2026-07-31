"use strict";

const { test, expect } = require("../fixtures/playwright");
const { readActivePlan, workoutExercises } = require("../helpers/state");
const { AppShell } = require("../pages/app-shell");
const { PlanBuilderPage } = require("../pages/plan-builder-page");

async function generateForLevel(page, athleteLevel) {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "balanced",
    days: "4",
    weakness: "running",
    athleteLevel,
    duration: "60",
  });
  return readActivePlan(page);
}

test("@critical generated weeks respect short, medium, long, and session duration rules", async ({
  page,
}) => {
  const plan = await generateForLevel(page, "intermediate");

  for (let week = 1; week <= 8; week += 1) {
    const sessions = plan.sessions.filter((session) => session.week === week);
    const domains = new Set(
      sessions.map((session) => session.workoutDefinition.timeDomain),
    );
    expect(domains.has("short")).toBe(true);
    expect(domains.has("medium")).toBe(true);
    expect(domains.has("long") || domains.has("extraLong")).toBe(true);
  }

  const durations = await page.evaluate(
    (sessions) =>
      sessions.map((session) => ({
        expected: window.ForgeHour.workoutExpectedDurationSeconds(
          session.workoutDefinition,
        ),
        displayedMinutes: session.segmentMinutes.wod,
        timeDomain: session.workoutDefinition.timeDomain,
        sessionMinutes: session.duration,
      })),
    plan.sessions,
  );
  for (const duration of durations) {
    expect(duration.expected).toBe(duration.displayedMinutes * 60);
    expect(duration.sessionMinutes).toBeLessThanOrEqual(60);
    if (["long", "extraLong"].includes(duration.timeDomain)) {
      expect(duration.expected).toBeGreaterThanOrEqual(20 * 60);
      expect(duration.expected).not.toBe(12 * 60);
    }
  }
});

for (const [athleteLevel, maximum] of [
  ["accessible", 15],
  ["intermediate", 20],
  ["rx", 22.5],
]) {
  test(`@critical ${athleteLevel} dumbbell snatches stay at or below ${maximum} kg`, async ({
    page,
  }) => {
    const plan = await generateForLevel(page, athleteLevel);
    const dumbbellSnatches = plan.sessions.flatMap((session) =>
      workoutExercises(session.workoutDefinition).filter((exercise) =>
        /(?:DB|dumbbell) snatches?/i.test(exercise.movement),
      ),
    );

    expect(dumbbellSnatches.length).toBeGreaterThan(0);
    for (const exercise of dumbbellSnatches) {
      expect(exercise.load.display).toMatch(/^\d+(?:\.\d+)? kg$/);
      expect(Number.parseFloat(exercise.load.display)).toBeLessThanOrEqual(
        Number(maximum),
      );
      expect(Number.parseFloat(exercise.load.display)).not.toBe(35);
    }
  });
}

test("@critical every generated workout is structurally valid and ladders are explicit", async ({
  page,
}) => {
  const plan = await generateForLevel(page, "intermediate");
  const validation = await page.evaluate((sessions) => {
    return sessions.map((session) => ({
      id: session.id,
      errors: window.ForgeHour.workoutDefinitionErrors(
        session.workoutDefinition,
      ),
      rendered: window.ForgeHour.renderWorkoutDescription(
        session.workoutDefinition,
      ),
    }));
  }, plan.sessions);

  expect(validation.every((result) => result.errors.length === 0)).toBe(true);
  const ladders = plan.sessions.filter(
    (session) => session.workoutDefinition.progression.type !== "none",
  );
  expect(ladders.length).toBeGreaterThan(0);
  for (const session of ladders) {
    const definition = session.workoutDefinition;
    expect(definition.progression.appliesTo.length).toBeGreaterThan(0);
    const mainIds = workoutExercises({
      ...definition,
      buyIn: [],
      afterEachRound: [],
      cashOut: [],
    }).map((exercise) => exercise.id);
    expect(
      definition.progression.appliesTo.every((id) => mainIds.includes(id)),
    ).toBe(true);
    expect(
      definition.afterEachRound.every(
        (exercise) => !definition.progression.appliesTo.includes(exercise.id),
      ),
    ).toBe(true);
  }
});

test("@critical Olympic prescriptions are exact, executable, and duplicate-safe", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "balanced",
    secondaryGoal: "endurance",
    days: "2",
    totalDays: "4",
    boxDays: "2",
    weakness: "olympic",
    athleteLevel: "intermediate",
    duration: "60",
  });

  let plan = await readActivePlan(page);
  const assertMovementSafety = (sessions) => {
    expect(sessions).toHaveLength(16);
    const serialized = JSON.stringify(sessions);
    expect(serialized).not.toMatch(
      /clean pulls or snatch pulls|tall clean\/snatch pulls|overhead or front rack holds|hang power clean drills/i,
    );
    expect(
      sessions.some((session) =>
        session.strength.some((item) => /tall clean pulls/.test(item)),
      ),
    ).toBe(true);
    expect(
      sessions.some((session) =>
        session.strength.some((item) => /tall snatch pulls/.test(item)),
      ),
    ).toBe(true);
    const weeklyFamilies = [];
    for (let week = 1; week <= 8; week += 1) {
      const families = new Set(
        sessions
          .filter((session) => session.week === week)
          .map((session) => session.olympicFamily),
      );
      expect(families.size).toBe(1);
      weeklyFamilies.push([...families][0]);
    }
    expect(new Set(weeklyFamilies)).toEqual(new Set(["clean", "snatch"]));
    for (const family of ["clean", "snatch"]) {
      let missing = 0;
      let longestMissing = 0;
      for (const weeklyFamily of weeklyFamilies) {
        missing = weeklyFamily === family ? 0 : missing + 1;
        longestMissing = Math.max(longestMissing, missing);
      }
      expect(longestMissing).toBeLessThanOrEqual(2);
    }
    for (const session of sessions) {
      for (const item of session.strength) {
        if (/tall clean pulls/.test(item)) {
          expect(session.olympicFamily).toBe("clean");
          expect(item).toMatch(/front-rack hold/);
        }
        if (/tall snatch pulls/.test(item)) {
          expect(session.olympicFamily).toBe("snatch");
          expect(item).toMatch(/overhead hold/);
        }
      }
      const exercises = workoutExercises(session.workoutDefinition);
      expect(exercises.every((exercise) => exercise.movementId)).toBe(true);
      expect(
        exercises.every((exercise) => !/drills?/i.test(exercise.movement)),
      ).toBe(true);
      expect(session.duration).toBe(60);
      const main =
        session.workoutDefinition.format.type === "emom"
          ? session.workoutDefinition.format.stations.flatMap(
              (station) => station.exercises || [],
            )
          : session.workoutDefinition.exercises;
      expect(new Set(main.map((exercise) => exercise.movementId)).size).toBe(
        main.length,
      );
    }
  };

  expect(plan.generatorOptions.secondaryGoal).toBe("endurance");
  expect(plan.generatorOptions.totalTrainingDays).toBe(4);
  assertMovementSafety(plan.sessions);
  await builder.waitForSync();
  await page.reload();
  await app.open();
  plan = await readActivePlan(page);
  assertMovementSafety(plan.sessions);
});
