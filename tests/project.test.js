"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

test("HTML mounts the React app and references the required assets", () => {
  const html = read("index.html");

  assert.match(
    html,
    /<link rel="manifest" href="\.\/manifest\.webmanifest"\s*\/?>/,
  );
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css"\s*\/?>/);
  assert.match(html, /id="root"/);
  assert.match(html, /react@18\.3\.1\/umd\/react\.production\.min\.js/);
  assert.match(html, /react-dom@18\.3\.1\/umd\/react-dom\.production\.min\.js/);
  assert.match(
    html,
    /@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.min\.js/,
  );
  assert.match(
    html,
    /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.min\.js/,
  );
  assert.match(html, /<script src="\.\/supabase-config\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/supabase-sync\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/react-app\.js" defer><\/script>/);
});

test("React app contains the main app surfaces and navigation", () => {
  const app = read("react-app.js");

  assert.match(app, /dashboardView/);
  assert.match(app, /programView/);
  assert.match(app, /builderView/);
  assert.match(app, /learnView/);
  assert.match(app, /logView/);
  assert.match(app, /proofView/);
  assert.match(app, /prView/);
  assert.match(app, /eight-week cycle/i);
  assert.match(app, /RX readiness/);
  assert.match(app, /Masters RX assessment/);
  assert.match(app, /nav-button/);
  assert.match(app, /Home/);
  assert.match(app, /PRs/);
  assert.match(app, /Competition proof/);
});

test("builder form has the required fields for a full CrossFit session", () => {
  const app = read("react-app.js");
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
    "customPlanIntensity",
  ];

  for (const id of requiredIds) {
    assert.match(app, new RegExp(`"${id}"`));
  }

  assert.match(app, /Get stronger/);
  assert.match(app, /More endurance/);
  assert.match(app, /Better gymnastics/);
  assert.match(app, /Masters 35-39 RX \/ Open Prep/);
  assert.match(app, /Optional add-ons/);
});

test("movement library surface exposes search and category filters", () => {
  const app = read("react-app.js");

  assert.match(app, /movementCategory/);
  assert.match(app, /movementSearch/);
  assert.match(app, /movementLibrary/);
  assert.match(app, /Gymnastics/);
  assert.match(app, /Weightlifting/);
  assert.match(app, /Learn/);
});

test("manifest is valid JSON and points to an existing icon", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const icon = manifest.icons[0];

  assert.equal(manifest.name, "CrossFit Training Programme");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "any");
  assert.match(manifest.description, /8-week/);
  assert.ok(fs.existsSync(path.join(ROOT, icon.src.replace("./", ""))));
});

test("service worker caches the files needed to run offline", () => {
  const serviceWorker = read("sw.js");
  const assets = [
    "index.html",
    "styles.css",
    "app.js",
    "supabase-config.js",
    "supabase-sync.js",
    "react-app.js",
    "manifest.webmanifest",
    "icon.svg",
  ];

  assert.match(serviceWorker, /crossfit-training-programme-v8/);
  assert.match(
    serviceWorker,
    /react@18\.3\.1\/umd\/react\.production\.min\.js/,
  );
  assert.match(
    serviceWorker,
    /react-dom@18\.3\.1\/umd\/react-dom\.production\.min\.js/,
  );
  assert.match(
    serviceWorker,
    /@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.min\.js/,
  );
  assert.match(
    serviceWorker,
    /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.min\.js/,
  );

  for (const asset of assets) {
    assert.match(serviceWorker, new RegExp(`"\\./${asset}"`));
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${asset} should exist`);
  }
});

test("project documentation describes the current feature set", () => {
  const readme = read("README.md");

  assert.match(readme, /Eight-week progression cycle/);
  assert.match(readme, /Needs-based programme generator/);
  assert.match(readme, /Masters 35-39 RX\/Open prep generator/);
  assert.match(readme, /RX readiness dashboard/);
  assert.match(readme, /WOD variation/);
  assert.match(readme, /Manual training programme builder/);
  assert.match(readme, /Movement library/);
  assert.match(readme, /React-powered/);
  assert.match(readme, /Supabase/);
  assert.match(readme, /python3 -m http\.server 4173/);
  assert.match(readme, /GitHub Pages/);
});

test("GitHub Pages workflow checks and publishes the static app", () => {
  const workflow = read(".github/workflows/pages.yml");

  assert.match(workflow, /Deploy to GitHub Pages/);
  assert.match(workflow, /branches:/);
  assert.match(workflow, /master/);
  assert.match(workflow, /main/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(
    workflow,
    /cp index\.html styles\.css app\.js supabase-config\.js supabase-sync\.js react-app\.js manifest\.webmanifest sw\.js icon\.svg dist\//,
  );
});

test("Supabase schema scopes policies to authenticated owners", () => {
  const schema = read("supabase-schema.sql");
  const policyCount = (schema.match(/create policy/g) || []).length;

  assert.equal(policyCount, 12);
  assert.equal((schema.match(/to authenticated/g) || []).length, policyCount);
  assert.equal(
    (
      schema.match(/auth\.uid\(\) is not null and auth\.uid\(\) = user_id/g) ||
      []
    ).length,
    15,
  );
  assert.match(
    schema,
    /alter table public\.workout_logs enable row level security/,
  );
  assert.match(schema, /timer_result jsonb/);
  assert.match(schema, /competition_proof jsonb/);
  assert.match(
    schema,
    /alter table public\.pr_attempts enable row level security/,
  );
  assert.match(
    schema,
    /alter table public\.personal_records enable row level security/,
  );
});
