"use strict";

const { test, expect } = require("../fixtures/playwright");
const { readActivePlan, readAppState } = require("../helpers/state");
const { AppShell } = require("../pages/app-shell");
const { PlanBuilderPage } = require("../pages/plan-builder-page");

function statCard(page, label) {
  return page.locator("#statsGrid .stat-card").filter({ hasText: label });
}

async function logSelectedWorkout(page) {
  await page.getByRole("button", { name: "Save workout log" }).click();
  await page.getByText("Workout log saved.", { exact: true }).waitFor();
}

test("@critical generated plan matches and persists builder selections", async ({
  page,
}) => {
  test.slow();
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
  expect(plan.generatorOptions).toMatchObject({
    goal: "balanced",
    daysPerWeek: 4,
    primaryGoal: "balanced",
    programDaysPerWeek: 4,
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
    builder.generatorForm.getByLabel("App-programmed sessions"),
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

test("@critical creates and reloads an intentional two-day plan with box training", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "stronger",
    days: "2",
    weakness: "pulling",
    athleteLevel: "intermediate",
    duration: "75",
    boxDays: "2",
  });

  let plan = await readActivePlan(page);
  expect(plan.generatorOptions).toMatchObject({
    primaryGoal: "stronger",
    programDaysPerWeek: 2,
    usesBoxProgramming: true,
    expectedBoxDays: 2,
    totalTrainingDays: 4,
    sessionDuration: 75,
    preferredProgramDays: ["tuesday", "saturday"],
  });
  expect(plan.sessions).toHaveLength(16);
  expect(plan.sessions.every((session) => session.twoDayStrategy)).toBe(true);
  expect(
    plan.sessions
      .filter((session) => session.week === 1)
      .map((session) => session.workoutDefinition.timeDomain),
  ).toEqual(["short", "long"]);

  await builder.waitForSync();
  await page.reload();
  await builder.open();
  await expect(
    builder.generatorForm.getByLabel("App-programmed sessions"),
  ).toHaveValue("2");
  await expect(
    builder.generatorForm.getByLabel("Max session length"),
  ).toHaveValue("75");
  plan = await readActivePlan(page);
  expect(plan.sessions).toHaveLength(16);
});

test("@critical two-day dashboard separates app progression from box training", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({
    goal: "balanced",
    days: "2",
    weakness: "rowing",
    duration: "75",
    boxDays: "2",
  });
  const plan = await readActivePlan(page);
  const weekOneSessions = plan.sessions.filter((session) => session.week === 1);

  await app.navigate("Log");
  await page.locator("#logDay").selectOption(weekOneSessions[0].id);
  await logSelectedWorkout(page);

  await page.getByLabel("Workout type").selectOption("box");
  await page.getByLabel("Box workout name").fill("Community chipper");
  await page.getByLabel("Heavy squats").check();
  await page.getByLabel("Long conditioning").check();
  await logSelectedWorkout(page);

  await app.navigate("Home");
  await expect(statCard(page, "App progression")).toContainText("1/2");
  await expect(statCard(page, "Total training")).toContainText("2/4");
  await expect(statCard(page, "Box workouts")).toContainText("1/2");
  await expect(statCard(page, "Progression week")).toContainText("50%");

  await app.navigate("Log");
  await page.getByLabel("Workout type").selectOption("app");
  await page.locator("#logDay").selectOption(weekOneSessions[1].id);
  await logSelectedWorkout(page);

  await app.navigate("Home");
  await expect(statCard(page, "App progression")).toContainText("2/2");
  await expect(statCard(page, "Progression week")).toContainText("Complete");
  await expect(statCard(page, "Box workouts")).toContainText("1/2");
});

test("@critical changing four app days to two preserves completed history", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generate({ goal: "stronger", days: "4", duration: "60" });
  const originalPlan = await readActivePlan(page);
  const completedSession = originalPlan.sessions.find(
    (session) => session.week === 3,
  );

  await app.navigate("Home");
  await page.getByLabel("Dashboard week").selectOption("3");
  await app.navigate("Log");
  await page.locator("#logDay").selectOption(completedSession.id);
  await logSelectedWorkout(page);

  await builder.open();
  page.once("dialog", (dialog) => dialog.accept());
  await builder.generate({
    goal: "stronger",
    days: "2",
    weakness: "squat",
    duration: "75",
    boxDays: "2",
  });

  const updatedPlan = await readActivePlan(page);
  const state = await readAppState(page);
  expect(updatedPlan.generatorOptions.programDaysPerWeek).toBe(2);
  expect(
    updatedPlan.sessions.filter((session) => session.week === 1),
  ).toHaveLength(4);
  expect(
    updatedPlan.sessions.filter((session) => session.week === 2),
  ).toHaveLength(4);
  expect(
    updatedPlan.sessions.filter((session) => session.week === 3),
  ).toHaveLength(2);
  expect(
    updatedPlan.sessions.some((session) => session.id === completedSession.id),
  ).toBe(true);
  expect(
    state.scoreDataByOwner[state.activeScoreOwner].logs.some(
      (log) => log.dayId === completedSession.id,
    ),
  ).toBe(true);
  expect(
    updatedPlan.sessions.filter((session) => session.week === 4),
  ).toHaveLength(2);
  await app.navigate("Log");
  expect(
    updatedPlan.sessions
      .filter((session) => session.week === 3)
      .map((session) => session.id),
  ).toContain(await page.locator("#logDay").inputValue());
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
