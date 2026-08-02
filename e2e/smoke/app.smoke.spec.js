"use strict";

const { test, expect } = require("../fixtures/playwright");
const { AccountPage } = require("../pages/account-page");
const { AppShell } = require("../pages/app-shell");

test("@smoke application loads its primary navigation", async ({ page }) => {
  const app = new AppShell(page);
  await app.open();

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toBeVisible();
  for (const name of ["Today", "Calendar", "Log", "Progress", "More"]) {
    await expect(
      navigation.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("@smoke mobile Today keeps the decision and primary action in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const app = new AppShell(page);
  await app.open();

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("button")).toHaveCount(5);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const action = page.getByRole("button", { name: "Start and log workout" });
  await expect(action).toBeVisible();
  const bounds = await action.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
});

test("@critical Today to Log to Progress remains local-first while offline", async ({
  page,
  context,
}) => {
  const app = new AppShell(page);
  await app.open();
  await context.setOffline(true);

  await page
    .getByLabel("Paste today's box WOD (optional)")
    .fill("AMRAP 12: 8 thrusters, 8 pull-ups, 200 m run");
  await page
    .getByRole("button", { name: "Save check-in and recommendation" })
    .click();
  await page.getByRole("button", { name: "Log box workout" }).click();
  await page.getByLabel("RPE").fill("8");
  await page.getByLabel("WOD score").fill("5 rounds + 4 reps");
  await page.getByLabel("Score type").selectOption("rounds_reps");
  await page.getByLabel("Primary value").fill("5");
  await page.getByLabel("Reps / secondary").fill("4");
  await page.getByRole("button", { name: "Save workout log" }).click();
  await expect(page.getByText(/5 rounds \+ 4 reps/)).toBeVisible();

  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(page.getByText("Structured workout scores")).toBeVisible();
  await context.setOffline(false);
});

test("@critical skill achievement unlocks once and survives a reload", async ({
  page,
}) => {
  const app = new AppShell(page);
  await app.open();

  await app.navigate("More");
  await page.getByLabel("Unbroken bar muscle-ups").fill("1");
  await page.getByRole("button", { name: "Save assessment" }).click();
  await expect(
    page.getByText("Achievement unlocked: First Bar Muscle-Up"),
  ).toBeVisible();

  await app.navigate("Progress");
  const progress = page.locator("#progressView");
  const badge = progress
    .getByRole("article")
    .filter({ hasText: "First Bar Muscle-Up" });
  await expect(badge).toContainText("Earned");

  await page.reload();
  await page
    .getByRole("heading", {
      name: "CrossFit Training Programme",
      level: 1,
    })
    .waitFor();
  await app.navigate("Progress");
  await expect(
    page
      .locator("#progressView")
      .getByRole("article")
      .filter({ hasText: "First Bar Muscle-Up" }),
  ).toContainText("Earned");
  await expect(
    page.getByText("Achievement unlocked: First Bar Muscle-Up"),
  ).toHaveCount(0);
});

test("@smoke authenticated state is reusable", async ({ page }) => {
  const app = new AppShell(page);
  const account = new AccountPage(page);
  await app.open();

  await account.expectSignedIn();
  await expect(
    page.getByText("e2e-athlete@example.test", { exact: true }),
  ).toBeVisible();
});
