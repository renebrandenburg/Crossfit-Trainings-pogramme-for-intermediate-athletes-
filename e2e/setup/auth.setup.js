"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { test, expect } = require("../fixtures/playwright");
const { AccountPage } = require("../pages/account-page");
const { AppShell } = require("../pages/app-shell");
const {
  cleanupStagingUser,
  generateStagingMagicLink,
  isMockMode,
} = require("../helpers/environment");

const authFile = path.resolve("playwright/.auth/e2e-user.json");

test("authenticate dedicated E2E athlete", async ({ page, baseURL }) => {
  if (process.env.E2E_DEBUG === "true") {
    page.on("console", (message) =>
      console.log(`[browser:${message.type()}] ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      console.log(`[browser:error] ${error.message}`),
    );
  }
  const app = new AppShell(page);
  const account = new AccountPage(page);

  if (isMockMode()) {
    await app.open();
    await account.loginWithEmail(
      process.env.E2E_USER_EMAIL || "e2e-athlete@example.test",
    );
  } else {
    await cleanupStagingUser();
    const actionLink = await generateStagingMagicLink(baseURL);
    await page.goto(actionLink);
  }

  await account.expectSignedIn();
  await expect(page.getByText(/syncing|synced/i)).toBeVisible();
  await fs.mkdir(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
