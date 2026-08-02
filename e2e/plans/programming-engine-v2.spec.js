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
  await expect(page.getByTestId("v2-session-card")).toHaveCount(2);

  const programme = page.getByTestId("v2-programme");
  await expect(programme).toContainText("72–75% of front squat 1RM");
  await expect(programme).toContainText("Working weight");
  await expect(programme).toContainText("90–95 kg");
  await expect(programme).toContainText("Strict pull-up");
  await expect(programme).toContainText("Ring row");
  await expect(programme).toContainText("Rest 120 sec");
  await expect(programme).not.toContainText(INVALID_GYMNASTICS);
  await expect(programme).not.toContainText(INVALID_PULL_HOLD);

  const beforeState = await readAppState(page);
  const beforeProgram = activeV2Program(beforeState);
  const beforeSession = firstSession(beforeProgram);
  const primaryBefore = beforeSession.exercises.filter(
    (exercise) => exercise.section === "primary",
  );
  const assignmentsBefore = beforeSession.trackAssignments;

  await page
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

  const firstCard = page.getByTestId("v2-session-card").first();
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
