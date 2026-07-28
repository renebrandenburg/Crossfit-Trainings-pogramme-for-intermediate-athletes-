"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const reactAppPath = path.resolve(__dirname, "../../react-app.js");

async function overrideProgrammeGenerator(page, implementationSource) {
  const reactApp = await fs.readFile(reactAppPath, "utf8");
  await page.route("**/react-app.js", (route) =>
    route.fulfill({
      body: `window.ForgeHour.buildGeneratedProgramme = ${implementationSource};\n${reactApp}`,
      contentType: "text/javascript",
    }),
  );
}

module.exports = { overrideProgrammeGenerator };
