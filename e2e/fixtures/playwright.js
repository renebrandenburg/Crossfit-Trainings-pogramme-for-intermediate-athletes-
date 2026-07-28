"use strict";

const path = require("node:path");
const { test: base, expect } = require("@playwright/test");
const { isMockMode, stagingEnvironment } = require("../helpers/environment");

const workspaceRoot = path.resolve(__dirname, "../..");
const assetPaths = {
  react: path.join(
    workspaceRoot,
    "node_modules/react/umd/react.production.min.js",
  ),
  reactDom: path.join(
    workspaceRoot,
    "node_modules/react-dom/umd/react-dom.production.min.js",
  ),
  supabase: path.join(
    workspaceRoot,
    "node_modules/@supabase/supabase-js/dist/umd/supabase.js",
  ),
  supabaseMock: path.join(__dirname, "supabase-browser-mock.js"),
};

async function installAppRoutes(page) {
  if (isMockMode()) {
    await page.route(
      /^https?:\/\/[^/]+\/(?:index\.html)?(?:\?.*)?$/,
      async (route) => {
        const response = await route.fetch();
        const html = (await response.text()).replace(
          /\s+integrity="[^"]+"/g,
          "",
        );
        await route.fulfill({ response, body: html });
      },
    );
  }
  await page.route(
    /https:\/\/unpkg\.com\/react@.*\/react\.production\.min\.js/,
    (route) =>
      route.fulfill({ path: assetPaths.react, contentType: "text/javascript" }),
  );
  await page.route(
    /https:\/\/unpkg\.com\/react-dom@.*\/react-dom\.production\.min\.js/,
    (route) =>
      route.fulfill({
        path: assetPaths.reactDom,
        contentType: "text/javascript",
      }),
  );
  await page.route(
    /https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\/npm\/@supabase\/supabase-js@.*\/supabase\.js/,
    (route) =>
      route.fulfill({
        path: isMockMode() ? assetPaths.supabaseMock : assetPaths.supabase,
        contentType: "text/javascript",
      }),
  );
  await page.route("**/supabase-config.js", (route) => {
    const config = isMockMode()
      ? { url: "https://e2e.test.supabase.co", anonKey: "e2e-publishable-key" }
      : (() => {
          const environment = stagingEnvironment();
          return { url: environment.url, anonKey: environment.anonKey };
        })();
    return route.fulfill({
      body: `window.ForgeHourSupabaseConfig = ${JSON.stringify(config)};`,
      contentType: "text/javascript",
    });
  });
}

const test = base.extend({
  page: async ({ page }, use) => {
    await installAppRoutes(page);
    await use(page);
  },
});

module.exports = { expect, installAppRoutes, test };
