"use strict";

const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const startsLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
const authenticatedState = "playwright/.auth/e2e-user.json";
const realSupabase = process.env.E2E_MODE === "staging";

module.exports = defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/helpers/**", "**/fixtures/**", "**/pages/**"],
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: !realSupabase,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI || realSupabase ? 1 : undefined,
  outputDir: "test-results",
  reporter: process.env.GITHUB_ACTIONS
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  webServer: startsLocalServer
    ? {
        command: "npm run serve:e2e",
        url: `${baseURL}/__e2e_health`,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.js/,
    },
    {
      name: "chromium",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.js/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: authenticatedState,
      },
    },
    {
      name: "firefox",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.js/,
      use: {
        ...devices["Desktop Firefox"],
        storageState: authenticatedState,
      },
    },
    {
      name: "webkit",
      dependencies: ["auth-setup"],
      testIgnore: /auth\.setup\.js/,
      use: {
        ...devices["Desktop Safari"],
        storageState: authenticatedState,
      },
    },
  ],
});
