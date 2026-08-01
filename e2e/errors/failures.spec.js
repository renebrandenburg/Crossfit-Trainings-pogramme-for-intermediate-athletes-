"use strict";

const { test, expect } = require("../fixtures/playwright");
const { overrideProgrammeGenerator } = require("../helpers/app-overrides");
const { readActivePlan } = require("../helpers/state");
const { uniqueTestData } = require("../helpers/data-factory");
const { AccountPage } = require("../pages/account-page");
const { AppShell } = require("../pages/app-shell");
const { PlanBuilderPage } = require("../pages/plan-builder-page");

test("@critical a failed plan save reports local-only persistence", async ({
  page,
}) => {
  const data = uniqueTestData();
  const app = new AppShell(page);
  const account = new AccountPage(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.waitForHydration();
  await builder.open();
  await builder.createCustomPlan(data);
  await builder.waitForSync();

  await page.evaluate(() => {
    window.__E2E_SUPABASE_FAILURES__ = { "athlete_states.upsert": 1 };
  });
  const offlinePlanName = `${data.planName} offline`;
  await page.getByLabel("Plan name").fill(offlinePlanName);
  await page.getByRole("button", { name: "Save plan name" }).click();
  await expect(
    page.getByText("Custom plan updated.", { exact: true }),
  ).toBeVisible();

  await app.navigate("Home");
  await account.open();
  await expect(
    page.getByText(
      "Profile or programme changes are saved locally and need a sync retry.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await readActivePlan(page)).title).toBe(offlinePlanName);
  await expect(
    page.getByRole("button", { name: "Retry account sync" }),
  ).toBeEnabled();
});

test("a failed delete sync does not falsely claim remote success", async ({
  page,
}) => {
  const data = uniqueTestData();
  const app = new AppShell(page);
  const account = new AccountPage(page);
  const builder = new PlanBuilderPage(page);
  await app.open();
  await builder.open();
  await builder.createCustomPlan(data);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const database = JSON.parse(
          window.localStorage.getItem("forge-hour-e2e-supabase-v1") || "{}",
        );
        return database.athlete_states?.[0]?.state?.plans?.length || 0;
      }),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__E2E_SUPABASE_FAILURES__ = { "athlete_states.upsert": 1 };
  });
  await builder.deleteActivePlan();
  await app.navigate("Home");
  await account.open();

  await expect(
    page.getByText(
      "Profile or programme changes are saved locally and need a sync retry.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry account sync" }),
  ).toBeEnabled();
});

test("@critical sign-in failure stops loading and offers a retry", async ({
  page,
}) => {
  const app = new AppShell(page);
  const account = new AccountPage(page);
  await app.open();
  await account.open();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Email sign-in link" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.__E2E_SUPABASE_FAILURES__ = { "auth.signInWithOtp": 1 };
  });

  await account.loginWithEmail("e2e-retry@example.test");
  await expect(
    page
      .getByRole("region", { name: "Database sync" })
      .getByText("Could not send sign-in email.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email sign-in link" }),
  ).toBeEnabled();
});

test("a slow sign-in exposes loading state and eventually completes", async ({
  page,
}) => {
  const app = new AppShell(page);
  const account = new AccountPage(page);
  await app.open();
  await account.open();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.evaluate(() => {
    window.__E2E_SUPABASE_DELAYS__ = { "auth.signInWithOtp": 300 };
  });
  await page.getByLabel("Email").fill("e2e-slow@example.test");
  const signIn = page.getByRole("button", { name: "Email sign-in link" });
  await signIn.click();

  await expect(signIn).toBeDisabled();
  await account.expectSignedIn();
});

test("expired authentication produces a useful session error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("forge-hour-e2e-auth-v1");
    window.__E2E_SUPABASE_FAILURES__ = { "auth.getSession": 1 };
  });
  const app = new AppShell(page);
  const account = new AccountPage(page);
  await app.open();
  await account.open();

  await expect(
    page.getByText("Could not read Supabase session.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email sign-in link" }),
  ).toBeEnabled();
});

for (const [label, implementation] of [
  ["empty", "() => []"],
  ["malformed", "() => [{ week: 1 }]"],
]) {
  test(`@critical ${label} generator output leaves the current plan unchanged`, async ({
    page,
  }) => {
    await overrideProgrammeGenerator(page, implementation);
    const app = new AppShell(page);
    const builder = new PlanBuilderPage(page);
    await app.open();
    await builder.open();
    await builder.createCustomPlan(uniqueTestData());
    const activePlanBefore = await readActivePlan(page);

    await builder.generatorForm
      .getByRole("button", { name: /Generate 8-week programme/ })
      .click();
    await expect(
      page.getByText(
        "Programme generation could not produce valid workouts. Your current plan was not changed.",
        { exact: true },
      ),
    ).toBeVisible();
    expect((await readActivePlan(page)).id).toBe(activePlanBefore.id);
  });
}
