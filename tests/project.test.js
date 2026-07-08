"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

test("HTML contains the main app surfaces and asset references", () => {
  const html = read("index.html");
  const navButtonCount = (html.match(/class="nav-button/g) || []).length;

  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css">/);
  assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
  assert.match(html, /id="dashboardView"/);
  assert.match(html, /id="programView"/);
  assert.match(html, /id="builderView"/);
  assert.match(html, /id="logView"/);
  assert.match(html, /id="prView"/);
  assert.match(html, /Eight-week cycle/);
  assert.equal(navButtonCount, 5);
});

test("builder form has the required fields for a full CrossFit session", () => {
  const html = read("index.html");
  const requiredIds = [
    "programmeGeneratorForm",
    "generatorGoal",
    "generatorDays",
    "generatorWeakness",
    "generatorDuration",
    "replaceGenerated",
    "customPlanWeek",
    "customPlanTitle",
    "customPlanFocus",
    "customPlanWarmup",
    "customPlanStrength",
    "customPlanWod",
    "customPlanMobility",
    "customPlanDuration",
    "customPlanIntensity"
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /Get stronger/);
  assert.match(html, /More endurance/);
  assert.match(html, /Better gymnastics/);
});

test("manifest is valid JSON and points to an existing icon", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const icon = manifest.icons[0];

  assert.equal(manifest.name, "Forge Hour");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait-primary");
  assert.match(manifest.description, /8-week/);
  assert.ok(fs.existsSync(path.join(ROOT, icon.src.replace("./", ""))));
});

test("service worker caches the files needed to run offline", () => {
  const serviceWorker = read("sw.js");
  const assets = ["index.html", "styles.css", "app.js", "manifest.webmanifest", "icon.svg"];

  assert.match(serviceWorker, /forge-hour-v5/);

  for (const asset of assets) {
    assert.match(serviceWorker, new RegExp(`"\\./${asset}"`));
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${asset} should exist`);
  }
});

test("project documentation describes the current feature set", () => {
  const readme = read("README.md");

  assert.match(readme, /Eight-week progression cycle/);
  assert.match(readme, /Needs-based programme generator/);
  assert.match(readme, /WOD variation/);
  assert.match(readme, /Manual training programme builder/);
  assert.match(readme, /python3 -m http\.server 4173/);
  assert.match(readme, /GitHub Pages/);
});

test("GitHub Pages workflow tests and publishes the static app", () => {
  const workflow = read(".github/workflows/pages.yml");

  assert.match(workflow, /Deploy to GitHub Pages/);
  assert.match(workflow, /branches:/);
  assert.match(workflow, /master/);
  assert.match(workflow, /main/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /cp index\.html styles\.css app\.js manifest\.webmanifest sw\.js icon\.svg dist\//);
});
