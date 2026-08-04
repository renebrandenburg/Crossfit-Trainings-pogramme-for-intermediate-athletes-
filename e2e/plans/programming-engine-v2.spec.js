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

  await page
    .getByRole("button", { name: "Generate six-week V2 block" })
    .click();
  const programme = page.getByTestId("v2-programme");
  await expect(programme.getByTestId("v2-session-card")).toHaveCount(2);
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
  await expect(calendar.getByTestId("v2-session-card")).toHaveCount(2);
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
  const beforeSession = firstSession(beforeProgram);
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
  expect(
    regeneratedSession.exercises.filter(
      (exercise) => exercise.section === "primary",
    ),
  ).toEqual(primaryBefore);
  expect(regeneratedSession.trackAssignments).toEqual(assignmentsBefore);
  expect(regeneratedSession.estimatedDurationMinutes).toBeLessThanOrEqual(65);

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
    page.locator("#calendarView").getByTestId("v2-session-card").first(),
  ).toContainText("Completed — progression feedback has been applied.");

  await page.reload();
  await builder.open();
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

test("@critical Masters/Open V2 uses competition-specific sessions", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await page.locator('select[name="v2Goal"]').selectOption("masters_open");
  await page
    .locator('select[name="v2TemplateId"]')
    .selectOption("masters_open_preparation_six_week");
  await page
    .getByRole("button", { name: "Generate six-week V2 block" })
    .click();

  const programme = page.getByTestId("v2-programme");
  await expect(programme).toContainText("Masters/Open");
  await page.getByRole("button", { name: "Week 4" }).click();
  await expect(programme).toContainText("Open-specific mixed-modal test");
  await expect(programme).toContainText("Pacing:");
  await expect(programme).toContainText("Standards:");
  await expect(programme).toContainText("Score: rounds_reps");
  await expect(programme).not.toContainText(
    "Front-squat progression and snatch development",
  );
  await expect(programme).not.toContainText("Baseline preview");
  await expect(programme).not.toContainText("rematerialized");

  await app.navigate("Plan");
  await expect(page.getByLabel("Programme week")).toHaveValue("4");
  await page.reload();
  await builder.open();
  await expect(page.getByLabel("Programme week")).toHaveValue("4");
  await expect(page.getByTestId("v2-programme")).toContainText("Pacing:");
});
