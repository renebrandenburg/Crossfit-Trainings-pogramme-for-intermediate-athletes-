"use strict";

const { test, expect } = require("../fixtures/playwright");
const { AccountPage } = require("../pages/account-page");
const { AppShell } = require("../pages/app-shell");

test("@smoke application loads its primary navigation", async ({ page }) => {
  const app = new AppShell(page);
  await app.open();

  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toBeVisible();
  for (const name of ["Home", "Plan", "Build", "Learn", "Log", "PRs"]) {
    await expect(
      navigation.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
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
