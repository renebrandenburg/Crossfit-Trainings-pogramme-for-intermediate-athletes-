"use strict";

const { test, expect } = require("../fixtures/playwright");
const { readActivePlan } = require("../helpers/state");
const { AppShell } = require("../pages/app-shell");
const { PlanBuilderPage } = require("../pages/plan-builder-page");

test("@critical generated plan matches and persists builder selections", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "balanced",
    days: "4",
    weakness: "running",
    athleteLevel: "rx",
    duration: "60",
  });
  await builder.waitForSync();

  let plan = await readActivePlan(page);
  expect(plan.kind).toBe("generated");
  expect(plan.generatorOptions).toEqual({
    goal: "balanced",
    daysPerWeek: 4,
    weakness: "running",
    duration: 60,
    athleteLevel: "rx",
  });
  expect(plan.sessions).toHaveLength(32);
  expect(new Set(plan.sessions.map((session) => session.week))).toEqual(
    new Set([1, 2, 3, 4, 5, 6, 7, 8]),
  );
  expect(plan.sessions.every((session) => session.duration <= 60)).toBe(true);

  await page.reload();
  await builder.open();
  await expect(builder.generatorForm.getByLabel("Main goal")).toHaveValue(
    "balanced",
  );
  await expect(
    builder.generatorForm.getByLabel("Sessions per week"),
  ).toHaveValue("4");
  await expect(
    builder.generatorForm.getByLabel("Biggest weakness"),
  ).toHaveValue("running");
  await expect(
    builder.generatorForm.getByLabel("Max session length"),
  ).toHaveValue("60");
  await expect(
    builder.generatorForm.getByLabel("Athlete programming level"),
  ).toHaveValue("rx");
  plan = await readActivePlan(page);
  expect(plan.generatorOptions.weakness).toBe("running");
});

test("@critical bar muscle-up goal persists and adds level-aware progression", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "barMuscleUp",
    days: "4",
    athleteLevel: "intermediate",
    duration: "60",
    barMuscleUpLevel: "highPull",
  });
  await builder.waitForSync();

  let plan = await readActivePlan(page);
  expect(plan.generatorOptions).toMatchObject({
    goal: "barMuscleUp",
    weakness: "muscleup",
    barMuscleUpLevel: "highPull",
  });
  const progressionText = plan.sessions
    .flatMap((session) => session.strength)
    .join(" ");
  expect(progressionText).toMatch(/pull|chest-to-bar/i);
  expect(progressionText).toMatch(/kip|swing|transition/i);
  expect(
    plan.sessions.filter((session) => /muscle-up/i.test(session.focus)).length,
  ).toBeGreaterThan(0);

  await page.reload();
  await builder.open();
  await expect(builder.generatorForm.getByLabel("Main goal")).toHaveValue(
    "barMuscleUp",
  );
  await expect(
    builder.generatorForm.getByLabel("Current bar muscle-up level"),
  ).toHaveValue("highPull");
  plan = await readActivePlan(page);
  expect(plan.generatorOptions.goal).toBe("barMuscleUp");
});

test("bar muscle-up is not promoted when a different goal is selected", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "stronger",
    days: "4",
    weakness: "squat",
    athleteLevel: "intermediate",
    duration: "60",
  });

  const plan = await readActivePlan(page);
  expect(plan.generatorOptions.goal).toBe("stronger");
  expect(plan.generatorOptions).not.toHaveProperty("barMuscleUpLevel");
  expect(
    plan.sessions.some((session) => session.sourceGoal === "barMuscleUp"),
  ).toBe(false);
});
