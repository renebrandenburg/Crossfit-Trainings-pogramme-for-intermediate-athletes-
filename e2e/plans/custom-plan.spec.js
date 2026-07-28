"use strict";

const { test, expect } = require("../fixtures/playwright");
const { readActivePlan, readAppState } = require("../helpers/state");
const { uniqueTestData } = require("../helpers/data-factory");
const { AppShell } = require("../pages/app-shell");
const { PlanBuilderPage } = require("../pages/plan-builder-page");
const { PlanOverviewPage } = require("../pages/plan-overview-page");

test("@smoke creates a plan and preserves its selected values after refresh", async ({
  page,
}) => {
  const data = uniqueTestData();
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  const overview = new PlanOverviewPage(page);

  await app.open();
  await builder.open();
  await builder.createCustomPlan({
    planName: data.planName,
    sessionTitle: data.sessionTitle,
    week: "2",
    focus: "Engine and pull-up quality",
    duration: "55",
    intensity: "Moderate",
  });
  await builder.expectActivePlan(data.planName);
  await builder.waitForSync();

  const created = await readActivePlan(page);
  expect(created.title).toBe(data.planName);
  expect(created.kind).toBe("custom");
  expect(created.sessions).toHaveLength(1);
  expect(created.sessions[0]).toMatchObject({
    title: data.sessionTitle,
    week: 2,
    focus: "Engine and pull-up quality",
    duration: 55,
    intensity: "Moderate",
  });

  await overview.open();
  await expect(overview.heading(data.planName)).toBeVisible();
  await page.getByLabel("Programme week").selectOption("2");
  await expect(
    page.getByRole("heading", { name: data.sessionTitle }),
  ).toBeVisible();

  await page.reload();
  await overview.open();
  await expect(overview.heading(data.planName)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: data.sessionTitle }),
  ).toBeVisible();
  expect((await readActivePlan(page)).sessions[0].duration).toBe(55);
});

test("@critical edits a plan and persists only the new values", async ({
  page,
}) => {
  const data = uniqueTestData();
  const updatedTitle = `${data.sessionTitle} edited`;
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);

  await app.open();
  await builder.open();
  await builder.createCustomPlan(data);
  await builder.editSession(data.sessionTitle, {
    title: updatedTitle,
    focus: "Updated gymnastics focus",
    duration: "45",
  });
  await builder.waitForSync();

  let plan = await readActivePlan(page);
  expect(plan.sessions).toHaveLength(1);
  expect(plan.sessions[0]).toMatchObject({
    title: updatedTitle,
    focus: "Updated gymnastics focus",
    duration: 45,
  });
  expect(
    plan.sessions.some((session) => session.title === data.sessionTitle),
  ).toBe(false);

  await page.reload();
  await builder.open();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: data.sessionTitle, exact: true }),
  ).toHaveCount(0);
  plan = await readActivePlan(page);
  expect(plan.sessions[0].duration).toBe(45);
});

test("@smoke deletes a custom plan and it stays deleted after refresh", async ({
  page,
}) => {
  const data = uniqueTestData();
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);

  await app.open();
  await builder.open();
  await builder.createCustomPlan(data);
  const deletedPlanId = (await readActivePlan(page)).id;
  await builder.deleteActivePlan();
  await builder.waitForSync();

  let state = await readAppState(page);
  expect(state.plans.some((plan) => plan.id === deletedPlanId)).toBe(false);
  await page.reload();
  await builder.open();
  state = await readAppState(page);
  expect(state.plans.some((plan) => plan.id === deletedPlanId)).toBe(false);
  await expect(page.getByText(data.planName, { exact: true })).toHaveCount(0);
});

test("required fields prevent an empty plan submission", async ({ page }) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  const before = (await readAppState(page)).plans.length;
  await builder.customPlanForm
    .getByRole("button", { name: "Save training session" })
    .click();
  expect((await readAppState(page)).plans).toHaveLength(before);
  await expect(builder.customPlanForm.getByLabel("Day or title")).toBeFocused();
});

test("invalid duration and duplicate submission cannot create extra sessions", async ({
  page,
}) => {
  const app = new AppShell(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();

  await builder.customPlanForm
    .getByLabel("Day or title")
    .fill("E2E validity session");
  await builder.customPlanForm
    .getByLabel("Duration", { exact: true })
    .fill("10");
  await builder.customPlanForm
    .getByRole("button", { name: "Save training session" })
    .click();
  expect((await readAppState(page)).plans).toHaveLength(0);
  await expect(
    builder.customPlanForm.getByLabel("Duration", { exact: true }),
  ).toBeFocused();

  await builder.customPlanForm
    .getByLabel("Duration", { exact: true })
    .fill("45");
  await builder.customPlanForm
    .getByRole("button", { name: "Save training session" })
    .dblclick();
  await expect(
    page.getByText("Training session saved.", { exact: true }),
  ).toBeVisible();
  expect((await readActivePlan(page)).sessions).toHaveLength(1);
});
