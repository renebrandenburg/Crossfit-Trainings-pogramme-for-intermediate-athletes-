"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const reactAppPath = path.resolve(__dirname, "../../react-app.js");

async function overrideV2ProgrammeGenerator(page, implementationSource) {
  const reactApp = await fs.readFile(reactAppPath, "utf8");
  await page.route("**/react-app.js", (route) =>
    route.fulfill({
      body: `window.ForgeHourProgrammingV2 = { ...window.ForgeHourProgrammingV2, generateV2Program: ${implementationSource} };\n${reactApp}`,
      contentType: "text/javascript",
    }),
  );
}

module.exports = { overrideV2ProgrammeGenerator };
