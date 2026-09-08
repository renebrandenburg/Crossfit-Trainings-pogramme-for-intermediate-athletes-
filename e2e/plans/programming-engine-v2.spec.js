"use strict";

const { test, expect } = require("../fixtures/playwright");
const { readAppState } = require("../helpers/state");
const { AppShell } = require("../pages/app-shell");
const { PlanBuilderPage } = require("../pages/plan-builder-page");

const INVALID_GYMNASTICS =
  "Gymnastics skill: hollow and arch control, strict pulling, and midline strength";
const INVALID_PULL_HOLD =
  "3 sets: 3 tall snatch pulls + 20-second overhead hold";

function activeV2Program(state) {
  const program = (state.v2Programs || []).find(
    (item) => item.id === state.activeV2ProgramId,
  );
  if (!program) throw new Error("Active V2 programme is missing.");
  return program;
}

function firstSession(program) {
  return program.trainingBlocks[0].trainingWeeks[0].sessions[0];
}

test("@critical V2 generates, renders, regenerates, completes, and reloads a connected block", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await builder.generateV2({
    frequency: 3,
    preferredDays: ["monday", "wednesday", "saturday"],
    athleteLevel: "advanced",
  });
  const programme = page.getByTestId("v2-programme");
  await expect(programme.getByTestId("v2-session-card")).toHaveCount(3);
  await expect(programme).toContainText("72–75% of front squat 1RM");
  await expect(programme).toContainText("Working weight");
  await expect(programme).toContainText("90–95 kg");
  await expect(programme).toContainText("Strict pull-up");
  await expect(programme).toContainText("Ring row");
  await expect(programme).toContainText("Rest 120 sec");
  await expect(programme).not.toContainText(INVALID_GYMNASTICS);
  await expect(programme).not.toContainText(INVALID_PULL_HOLD);

  await app.navigate("Plan");
  const calendar = page.locator("#calendarView");
  await expect(calendar.getByTestId("v2-session-card")).toHaveCount(3);
  await expect(calendar).toContainText("72–75% of front squat 1RM");
  await expect(calendar).toContainText("Rest 120 sec");
  await expect(page.getByLabel("Programme week").locator("option")).toHaveCount(
    6,
  );

  await app.navigate("Home");
  await expect(page.locator("#dashboardView")).toContainText("V2 progression");
  await expect(
    page.getByRole("button", { name: "Open structured workout" }),
  ).toBeVisible();
  await builder.open();

  const beforeState = await readAppState(page);
  const beforeProgram = activeV2Program(beforeState);
  expect(beforeState.v2GenerationPreferences).toMatchObject({
    preferredDays: ["monday", "wednesday", "saturday"],
    frequency: 3,
    athleteLevel: "advanced",
  });
  expect(
    beforeProgram.trainingBlocks[0].trainingWeeks.every(
      (week) => week.sessions.length === 3,
    ),
  ).toBe(true);
  const beforeSession = firstSession(beforeProgram);
  const exercisesBefore = beforeSession.exercises;
  const warmupBefore = beforeSession.warmup;
  const conditioningBefore = beforeSession.conditioning;
  const primaryBefore = beforeSession.exercises.filter(
    (exercise) => exercise.section === "primary",
  );
  const assignmentsBefore = beforeSession.trackAssignments;

  await programme
    .getByTestId("v2-session-card")
    .first()
    .getByRole("button", { name: "Regenerate conditioning" })
    .click();
  await expect(
    page.getByText("Regenerated conditioning within the current progression.", {
      exact: true,
    }),
  ).toBeVisible();

  const regenerated = activeV2Program(await readAppState(page));
  const regeneratedSession = firstSession(regenerated);
  expect(regeneratedSession.exercises).toEqual(exercisesBefore);
  expect(regeneratedSession.warmup).toEqual(warmupBefore);
  expect(regeneratedSession.conditioning).not.toEqual(conditioningBefore);
  expect(
    regeneratedSession.exercises.filter(
      (exercise) => exercise.section === "primary",
    ),
  ).toEqual(primaryBefore);
  expect(regeneratedSession.trackAssignments).toEqual(assignmentsBefore);
  expect(regeneratedSession.estimatedDurationMinutes).toBeLessThanOrEqual(65);
  expect(regenerated.validation.valid).toBe(true);

  const firstCard = programme.getByTestId("v2-session-card").first();
  await firstCard
    .getByText("Record completion and advance progression", { exact: true })
    .click();
  await firstCard.getByLabel("Session RPE").fill("7");
  await firstCard.getByLabel("Fatigue").fill("6");
  await firstCard.getByLabel("Actual duration (minutes)").fill("56");
  await firstCard.getByRole("button", { name: "Complete session" }).click();
  await expect(firstCard).toContainText(
    "Completed — progression feedback has been applied.",
  );

  const completed = activeV2Program(await readAppState(page));
  const completedBlock = completed.trainingBlocks[0];
  const completedSession = firstSession(completed);
  expect(completedSession.status).toBe("completed");
  const completedTrackIds = completedSession.trackAssignments.map(
    (assignment) => assignment.progressionTrackId,
  );
  expect(
    completedBlock.progressionTracks
      .filter((track) => completedTrackIds.includes(track.id))
      .every((track) => track.currentStep === 2),
  ).toBe(true);

  await app.navigate("Plan");
  await expect(
    page
      .locator("#calendarView .calendar-event.status-completed")
      .getByTestId("v2-session-card"),
  ).toContainText("Completed — progression feedback has been applied.");

  await page.reload();
  await builder.open();
  await expect(page.locator('select[name="v2Frequency"]')).toHaveValue("3");
  await expect(page.locator('select[name="v2AthleteLevel"]')).toHaveValue(
    "advanced",
  );
  await expect(page.getByTestId("v2-programme")).toContainText(
    "Completed — progression feedback has been applied.",
  );
  await expect(page.getByTestId("v2-programme")).not.toContainText(
    INVALID_GYMNASTICS,
  );
  await expect(page.getByTestId("v2-programme")).not.toContainText(
    INVALID_PULL_HOLD,
  );
});

test("@critical REG-012 V2 goal and block drive content without rewriting the selected template", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await builder.generateV2({
    goal: "bar_muscle_up",
    blockType: "gymnastics_capacity",
  });

  let program = activeV2Program(await readAppState(page));
  expect(program.trainingBlocks[0].templateId).toBe("mixed_strength_6w");
  expect(program.generationRequest.athleteGoals).toEqual(["bar_muscle_up"]);
  expect(program.generationRequest.trainingBlock).toBe("gymnastics_capacity");
  expect(program.programmeProfile).toMatchObject({
    primaryGoal: "bar_muscle_up",
    trainingBlock: "gymnastics_capacity",
    focus: "gymnastics",
  });
  await expect(page.getByTestId("v2-programme")).toContainText(/strict pull/i);

  await page.reload();
  await builder.open();
  await expect(page.locator('select[name="v2Goal"]')).toHaveValue(
    "bar_muscle_up",
  );
  await expect(page.locator('select[name="v2TemplateId"]')).toHaveValue(
    "mixed_strength_6w",
  );
  program = activeV2Program(await readAppState(page));
  expect(program.trainingBlocks[0].templateId).toBe("mixed_strength_6w");
  expect(program.programmeProfile.focus).toBe("gymnastics");
});

test("@critical REG-013 a historical programme with no template is rejected with explicit recovery", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generateV2();

  const original = activeV2Program(await readAppState(page));
  await page.evaluate(() => {
    const store = window.ForgeHourLocalState.createLocalStateStore(
      window.localStorage,
    );
    const state = store.load();
    const athlete = state.athleteStateByOwner[state.activeScoreOwner];
    const program = structuredClone(
      athlete.v2Programs.find((item) => item.id === state.activeV2ProgramId),
    );
    delete program.trainingBlocks[0].templateId;
    state.activeScoreOwner = "guest";
    state.v2Programs = [program];
    state.activeV2ProgramId = program.id;
    state.activeProgrammingEngine = "v2";
    state.athleteStateByOwner.guest = {
      ...state.athleteStateByOwner.guest,
      v2Programs: [program],
      activeV2ProgramId: program.id,
      activeProgrammingEngine: "v2",
    };
    store.save(state);
    window.localStorage.removeItem("forge-hour-e2e-auth-v1");
  });

  await page.reload();
  await builder.open();
  const rejected = page.getByTestId("v2-programme-rejected");
  await expect(rejected).toContainText("UNSUPPORTED_TEMPLATE");
  await expect(rejected).toContainText("template <missing>");
  await expect(rejected).toContainText(`programme ${original.id}`);
  await expect(rejected).toContainText("type mixed_strength_6w");

  const template = rejected.locator('select[name="v2TemplateId"]');
  await expect(template).toHaveValue("");
  await template.selectOption("general_crossfit_6w");
  await rejected
    .getByRole("button", { name: "Generate replacement V2 programme" })
    .click();
  await expect(page.getByTestId("v2-programme")).toBeVisible();

  const state = await readAppState(page);
  const replacement = activeV2Program(state);
  expect(replacement.id).not.toBe(original.id);
  expect(replacement.trainingBlocks[0].templateId).toBe("general_crossfit_6w");
  expect(state.v2Programs.some((program) => program.id === original.id)).toBe(
    true,
  );
});

test("@critical Masters/Open V2 uses competition-specific sessions", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await page.locator('select[name="v2Goal"]').selectOption("masters_open");
  await page
    .locator('select[name="v2BlockType"]')
    .selectOption("masters_open_preparation");
  await page
    .locator('select[name="v2TemplateId"]')
    .selectOption("masters_open_preparation_6w");
  await page
    .getByRole("button", { name: "Generate six-week V2 block" })
    .click();

  const programme = page.getByTestId("v2-programme");
  await expect(programme).toContainText("Masters/Open");
  await page.getByRole("button", { name: "Week 4" }).click();
  await expect(programme).toContainText("Pacing:");
  await expect(programme).toContainText("Standards:");
  await expect(programme).toContainText("Score: rounds_reps");
  await expect(programme).not.toContainText(
    "Front-squat progression and snatch development",
  );
  await expect(programme).not.toContainText("Baseline preview");
  await expect(programme).not.toContainText("rematerialized");

  const program = activeV2Program(await readAppState(page));
  const weekFour = program.trainingBlocks[0].trainingWeeks[3];
  expect(program.programmeProfile).toMatchObject({
    primaryGoal: "masters_open",
    trainingBlock: "masters_open_preparation",
    conditioningStyle: "open",
  });
  expect(
    weekFour.sessions.every((session) => session.fatigueFocus === "recovery"),
  ).toBe(true);
  expect(
    weekFour.sessions.some(
      (session) =>
        session.conditioning?.competitionMetadata?.competitionStyle === true,
    ),
  ).toBe(true);

  await app.navigate("Plan");
  await expect(page.getByLabel("Programme week")).toHaveValue("4");
  await page.reload();
  await builder.open();
  await expect(page.getByTestId("v2-programme")).toContainText("Pacing:");
});

test("@critical V2 families produce different Week 4 programming", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  const families = [
    ["mixed", "mixed_strength", "mixed_strength_6w"],
    ["competition", "competition_preparation", "competition_preparation_6w"],
    ["open", "open_preparation", "open_preparation_6w"],
    ["masters_open", "masters_open_preparation", "masters_open_preparation_6w"],
  ];
  const weekFour = [];
  for (const [goal, blockType, templateId] of families) {
    await page.locator('select[name="v2Goal"]').selectOption(goal);
    await page.locator('select[name="v2BlockType"]').selectOption(blockType);
    await page.locator('select[name="v2TemplateId"]').selectOption(templateId);
    await page.getByRole("button", { name: /Generate .*block/ }).click();
    const state = await readAppState(page);
    const programme = activeV2Program(state);
    const week = programme.trainingBlocks[0].trainingWeeks[3];
    weekFour.push({
      templateId: programme.trainingBlocks[0].templateId,
      theme: week.theme,
      objectives: week.sessions.map((session) => session.objective),
      formats: week.sessions.map((session) => session.conditioning?.format),
    });
    if (templateId !== families[families.length - 1][2]) {
      await page
        .getByRole("button", { name: "Create new V2 programme" })
        .click();
    }
  }
  expect(new Set(weekFour.map((item) => item.templateId)).size).toBe(4);
  expect(new Set(weekFour.map((item) => item.theme)).size).toBe(4);
  expect(new Set(weekFour.map((item) => item.objectives.join("|"))).size).toBe(
    4,
  );
  await page.reload();
  await builder.open();
  await expect(page.getByTestId("v2-programme")).toContainText("Masters/Open");
});

test("@critical REG-002 REG-003 eight-week selection is non-sequential and reload-stable", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await builder.generateV2({
    goal: "general_crossfit",
    blockType: "gymnastics_capacity",
    templateId: "mixed_strength_8w_testing",
  });

  const programme = page.getByTestId("v2-programme");
  let program = activeV2Program(await readAppState(page));
  expect(program.trainingBlocks[0].durationWeeks).toBe(8);
  expect(program.trainingBlocks[0].trainingWeeks).toHaveLength(8);
  expect(program.programmeProfile.focus).toBe("gymnastics");
  await expect(
    page
      .getByRole("navigation", { name: "V2 training weeks" })
      .getByRole("button"),
  ).toHaveCount(8);

  for (const week of [4, 7, 2, 8]) {
    await page
      .getByRole("button", { name: `Week ${week}`, exact: true })
      .click();
    await expect(programme).toContainText(`Week ${week} – Session 1`);
    expect((await readAppState(page)).selectedWeek).toBe(week);
  }

  program = activeV2Program(await readAppState(page));
  expect(program.trainingBlocks[0].trainingWeeks[7].sessions).toHaveLength(2);
  await page.reload();
  await builder.open();
  await expect(page.getByTestId("v2-programme")).toContainText(
    "Week 8 – Session 1",
  );
  expect((await readAppState(page)).selectedWeek).toBe(8);
});

test("@critical Strict Strength generates, benchmarks, and reloads its selected week", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await builder.generateV2({
    goal: "strength",
    blockType: "mixed_strength",
    templateId: "strict_strength_8w",
    frequency: 2,
    preferredDays: ["tuesday", "saturday"],
  });

  const programme = page.getByTestId("v2-programme");
  await expect(
    page
      .getByRole("navigation", { name: "V2 training weeks" })
      .getByRole("button"),
  ).toHaveCount(8);
  await expect(programme.getByTestId("v2-session-card")).toHaveCount(2);
  await expect(programme).toContainText(/Strict pull-up/i);
  let program = activeV2Program(await readAppState(page));
  expect(program.trainingBlocks[0].templateId).toBe("strict_strength_8w");
  expect(program.trainingBlocks[0].trainingWeeks).toHaveLength(8);
  expect(
    program.trainingBlocks[0].trainingWeeks.every(
      (week) =>
        week.sessions.length === 2 &&
        week.sessions.every(
          (session) => session.estimatedDurationMinutes <= 60,
        ),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Week 8", exact: true }).click();
  await expect(programme).toContainText(
    "Test · pulling and pressing benchmarks",
  );
  await expect(programme).toContainText(/Retest Strict pull-up capacity/i);
  await expect(programme).toContainText(/Test Strict press true 1rm/i);
  const maxTestCard = programme.getByTestId("v2-session-card").filter({
    hasText: "Test Strict press true 1rm",
  });
  await expect(maxTestCard).toContainText("Planned attempts:");
  await expect(maxTestCard).toContainText("Stopping rules:");
  await expect(maxTestCard).toContainText("58 min");
  await expect(maxTestCard).not.toContainText("Primary progression");
  await expect(maxTestCard).not.toContainText("Secondary progression");
  await expect(maxTestCard).not.toContainText("Conditioning");
  expect((await readAppState(page)).selectedWeek).toBe(8);

  await page.reload();
  await builder.open();
  await expect(page.locator('select[name="v2TemplateId"]')).toHaveValue(
    "strict_strength_8w",
  );
  await expect(page.getByTestId("v2-programme")).toContainText(
    "Week 8 – Session 1",
  );
  await expect(maxTestCard).toContainText("Planned attempts:");
  await expect(maxTestCard).not.toContainText("Primary progression");
  program = activeV2Program(await readAppState(page));
  expect(program.trainingBlocks[0].templateId).toBe("strict_strength_8w");
  expect((await readAppState(page)).selectedWeek).toBe(8);
});

test("@critical mixed test week shows all lifts and conditioning after reload", async ({
  page,
}, testInfo) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.generateV2({
    templateId: "mixed_strength_8w_testing",
    frequency: 2,
    preferredDays: ["tuesday", "saturday"],
  });
  await page.getByRole("button", { name: "Week 8", exact: true }).click();
  const programme = page.getByTestId("v2-programme");
  const cards = programme.getByTestId("v2-session-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Max test: Snatch");
  await expect(cards.nth(0)).toContainText("Max test: Front squat");
  await expect(cards.nth(1)).toContainText("Max test: Clean and jerk");
  await expect(cards.nth(1)).toContainText("30-minute EMOM");
  await expect(cards.nth(0)).toContainText("65 min");
  await expect(cards.nth(1)).toContainText("65 min");
  await expect(programme).not.toContainText("Primary progression");
  await expect(programme.locator(".v2-max-test")).toHaveCount(3);
  await page.screenshot({
    path: testInfo.outputPath("mixed-test-week.png"),
    fullPage: true,
  });
  await page.reload();
  await builder.open();
  await expect(cards.nth(0)).toContainText("Max test: Front squat");
  await expect(cards.nth(1)).toContainText("30-minute EMOM");
});

test("@critical REG-001 saved V2 programmes switch, rename, delete, and persist", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await builder.generateV2({
    goal: "general_crossfit",
    blockType: "gymnastics_capacity",
    templateId: "gymnastics_capacity_6w",
  });
  const gymnasticsId = (await readAppState(page)).activeV2ProgramId;
  await page.getByLabel("V2 programme name").fill("Gymnastics cycle");
  await page.getByRole("button", { name: "Save V2 programme name" }).click();
  await expect(
    page.getByText("V2 programme renamed.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create new V2 programme" }).click();
  await builder.generateV2({
    goal: "olympic_lifting",
    blockType: "olympic_lifting_development",
    templateId: "olympic_lifting_6w",
  });
  const weightliftingId = (await readAppState(page)).activeV2ProgramId;
  await page.getByLabel("V2 programme name").fill("Weightlifting cycle");
  await page.getByRole("button", { name: "Save V2 programme name" }).click();

  const selector = page.getByLabel("Active programme");
  await selector.selectOption(`v2:${gymnasticsId}`);
  let state = await readAppState(page);
  expect(state.activeV2ProgramId).toBe(gymnasticsId);
  expect(activeV2Program(state).name).toBe("Gymnastics cycle");
  expect(activeV2Program(state).programmeProfile.focus).toBe("gymnastics");

  await page.reload();
  await builder.open();
  await expect(page.getByLabel("Active programme")).toHaveValue(
    `v2:${gymnasticsId}`,
  );

  await page
    .getByLabel("Active programme")
    .selectOption(`v2:${weightliftingId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove V2 programme" }).click();
  await expect(
    page.getByText(
      "V2 programme removed. Switched to another saved V2 programme.",
      { exact: true },
    ),
  ).toBeVisible();
  state = await readAppState(page);
  expect(state.activeV2ProgramId).toBe(gymnasticsId);
  expect(
    state.v2Programs.some((program) => program.id === weightliftingId),
  ).toBe(false);

  await page.reload();
  state = await readAppState(page);
  expect(
    state.v2Programs.some((program) => program.id === weightliftingId),
  ).toBe(false);
  expect(activeV2Program(state).name).toBe("Gymnastics cycle");
});
