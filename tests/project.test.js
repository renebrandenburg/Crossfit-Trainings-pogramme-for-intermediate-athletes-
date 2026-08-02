"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function deployedAssetNames(workflow) {
  const copyCommand = workflow.match(/cp ([^\n]+) dist\//);
  assert.ok(
    copyCommand,
    "Pages workflow should copy the static site into dist",
  );
  return new Set(copyCommand[1].trim().split(/\s+/));
}

function localHtmlAssetNames(html) {
  return new Set(
    [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)[^"]*"/g)].map(
      (match) => match[1],
    ),
  );
}

function runServiceWorker({ fetchImpl, matchImpl, cacheKeys = [] } = {}) {
  const listeners = {};
  const calls = {
    added: [],
    addedAll: [],
    deleted: [],
    fetched: [],
    matched: [],
    put: [],
  };
  const cache = {
    async add(asset) {
      calls.added.push(asset);
    },
    async addAll(assets) {
      calls.addedAll.push([...assets]);
    },
    async match(request, options) {
      calls.matched.push({ request, options });
      return matchImpl ? matchImpl(request, options) : undefined;
    },
    async put(request, response) {
      calls.put.push({ request, response });
    },
  };
  const context = {
    URL,
    caches: {
      async delete(key) {
        calls.deleted.push(key);
      },
      async keys() {
        return cacheKeys;
      },
      async open() {
        return cache;
      },
    },
    async fetch(...args) {
      calls.fetched.push(args);
      if (fetchImpl) return fetchImpl(...args);
      throw new Error("Unexpected network request");
    },
    self: {
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
      clients: { claim: async () => undefined },
      registration: { scope: "https://example.test/training/" },
      skipWaiting: async () => undefined,
    },
  };

  vm.runInNewContext(read("sw.js"), context, { filename: "sw.js" });
  return { calls, listeners };
}

function successfulResponse(name) {
  return {
    name,
    ok: true,
    type: "basic",
    clone() {
      return this;
    },
  };
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
    /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.js/,
  );
  assert.match(
    html,
    /if \(!window\.supabase\)[\s\S]*unpkg\.com\/@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.js/,
  );
  assert.doesNotMatch(
    html,
    /unpkg\.com\/@supabase\/supabase-js@2\.57\.4\/dist\/umd\/supabase\.min\.js/,
  );
  assert.equal((html.match(/integrity="sha384-/g) || []).length, 4);
  assert.match(html, /<script src="\.\/supabase-config\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/build-info\.js" defer><\/script>/);
  assert.match(
    html,
    /<script src="\.\/local-state-store\.js" defer><\/script>/,
  );
  assert.match(html, /<script src="\.\/movement-catalog\.js" defer><\/script>/);
  assert.match(
    html,
    /<script src="\.\/training-prescriptions\.js" defer><\/script>/,
  );
  assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
  assert.ok(
    html.indexOf("./movement-catalog.js") < html.indexOf("./app.js"),
    "the movement catalog must load before the generator",
  );
  assert.ok(
    html.indexOf("./training-prescriptions.js") < html.indexOf("./app.js"),
    "training prescriptions must load before the generator",
  );
  assert.match(html, /<script src="\.\/supabase-sync\.js" defer><\/script>/);
  assert.match(html, /<script src="\.\/react-app\.js" defer><\/script>/);
});

test("React app contains the main app surfaces and navigation", () => {
  const app = read("react-app.js");

  assert.match(app, /dashboardView/);
  assert.match(app, /calendarView/);
  assert.match(app, /builderView/);
  assert.match(app, /learnView/);
  assert.match(app, /logView/);
  assert.match(app, /proofView/);
  assert.match(app, /progressView/);
  assert.match(app, /eight-week cycle/i);
  assert.match(app, /RX readiness/);
  assert.match(app, /Masters RX assessment/);
  assert.match(app, /nav-button/);
  assert.match(app, /Today/);
  assert.match(app, /Calendar/);
  assert.match(app, /Progress/);
  assert.match(app, /More/);
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

test("service worker precaches the app and only the primary CDN runtimes", async () => {
  const serviceWorker = read("sw.js");
  const assets = [
    "index.html",
    "build-info.js",
    "styles.css",
    "local-state-store.js",
    "movement-catalog.js",
    "training-prescriptions.js",
    "app.js",
    "supabase-config.js",
    "supabase-sync.js",
    "react-app.js",
    "manifest.webmanifest",
    "icon.svg",
  ];
  const { calls, listeners } = runServiceWorker();
  let installPromise;

  listeners.install({
    waitUntil(promise) {
      installPromise = promise;
    },
  });
  await installPromise;

  assert.match(serviceWorker, /crossfit-training-programme-/);
  assert.equal(calls.addedAll.length, 1);
  assert.equal(calls.added.length, 3);
  assert.ok(
    calls.added.some((asset) => asset.includes("react@18.3.1")),
    "React should be available offline",
  );
  assert.ok(
    calls.added.some((asset) =>
      asset.includes("cdn.jsdelivr.net/npm/@supabase"),
    ),
    "the primary Supabase runtime should be available offline",
  );
  assert.ok(
    !calls.added.some((asset) => asset.includes("unpkg.com/@supabase")),
    "the fallback Supabase runtime must not be downloaded unconditionally",
  );

  for (const asset of assets) {
    assert.ok(calls.addedAll[0].includes(`./${asset}`));
    assert.ok(fs.existsSync(path.join(ROOT, asset)), `${asset} should exist`);
  }
});

test("service worker revalidates app code and falls back to its offline cache", async () => {
  const fresh = successfulResponse("fresh");
  const cached = successfulResponse("cached");
  const request = {
    method: "GET",
    mode: "same-origin",
    url: "https://example.test/training/react-app.js",
  };
  const online = runServiceWorker({ fetchImpl: async () => fresh });
  let onlineResponse;

  online.listeners.fetch({
    request,
    respondWith(promise) {
      onlineResponse = promise;
    },
  });

  assert.equal(await onlineResponse, fresh);
  assert.equal(online.calls.fetched.length, 1);
  assert.equal(online.calls.fetched[0][1].cache, "no-cache");
  assert.equal(online.calls.put.length, 1);

  const offline = runServiceWorker({
    fetchImpl: async () => {
      throw new Error("offline");
    },
    matchImpl: async () => cached,
  });
  let offlineResponse;
  offline.listeners.fetch({
    request,
    respondWith(promise) {
      offlineResponse = promise;
    },
  });

  assert.equal(await offlineResponse, cached);
});

test("service worker preserves unrelated caches during version transitions", async () => {
  const { calls, listeners } = runServiceWorker({
    cacheKeys: [
      "crossfit-training-programme-v9",
      "crossfit-training-programme-v10",
      "another-application-v1",
    ],
  });
  let activationPromise;

  listeners.activate({
    waitUntil(promise) {
      activationPromise = promise;
    },
  });
  await activationPromise;

  assert.deepEqual(calls.deleted, [
    "crossfit-training-programme-v9",
    "crossfit-training-programme-v10",
  ]);
});

test("project documentation describes the current feature set", () => {
  const readme = read("README.md");

  assert.match(readme, /Eight-week progression cycle/);
  assert.match(readme, /Needs-based programme generator/);
  assert.match(readme, /Masters 35-39 RX\/Open prep generator/);
  assert.match(readme, /A combined \*\*Progress\*\* view/);
  assert.match(readme, /A \*\*Today\*\* coach/);
  assert.match(readme, /A real dated \*\*Calendar\*\*/);
  assert.match(readme, /JSON backup\/restore/);
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
  const deployedAssets = deployedAssetNames(workflow);
  const htmlAssets = localHtmlAssetNames(read("index.html"));

  assert.match(workflow, /Deploy to GitHub Pages/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches:/);
  assert.match(workflow, /master/);
  assert.match(workflow, /main/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /checks:[\s\S]*npm run check/);
  assert.match(
    workflow,
    /deploy:[\s\S]*if: github\.event_name != 'pull_request'/,
  );
  assert.match(workflow, /database:[\s\S]*supabase\/setup-cli@v2/);
  assert.match(workflow, /database:[\s\S]*SUPABASE_TELEMETRY_DISABLED: "1"/);
  assert.match(workflow, /database:[\s\S]*supabase db start/);
  assert.match(workflow, /database:[\s\S]*supabase test db/);
  assert.match(
    workflow,
    /supabase db lint --local --schema public --level warning --fail-on warning/,
  );
  assert.match(
    workflow,
    /supabase gen types typescript --local --schema public/,
  );
  assert.match(
    workflow,
    /diff -u -B types\/database\.types\.ts \/tmp\/database\.types\.ts/,
  );
  assert.match(workflow, /deploy:[\s\S]*needs: \[checks, database\]/);
  for (const asset of htmlAssets) {
    assert.ok(
      deployedAssets.has(asset),
      `Pages artifact should include local HTML asset ${asset}`,
    );
  }
  for (const asset of ["index.html", "sw.js", "icon.svg"]) {
    assert.ok(
      deployedAssets.has(asset),
      `Pages artifact should include ${asset}`,
    );
  }
});

test("Supabase schema scopes policies to authenticated owners", () => {
  const schema = read("supabase-schema.sql");
  const policies = schema.match(/create policy[\s\S]*?;/g) || [];

  assert.equal(policies.length, 23);
  for (const policy of policies) {
    assert.match(policy, /to authenticated/);
    assert.match(policy, /\(select auth\.uid\(\)\) = user_id/);
  }
  assert.equal(
    (schema.match(/\(select auth\.uid\(\)\) = user_id/g) || []).length,
    29,
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
  assert.match(
    schema,
    /alter table public\.athlete_states enable row level security/,
  );
  assert.match(
    schema,
    /grant select, insert, update on table public\.athlete_states[\s\S]*?to authenticated/,
  );
  assert.match(
    schema,
    /alter table public\.training_events enable row level security/,
  );
  assert.match(
    schema,
    /alter table public\.readiness_checks enable row level security/,
  );
  assert.match(schema, /structured_score jsonb/);
  assert.match(schema, /recommendation_snapshot jsonb/);
  assert.match(schema, /rx_status text/);
});

test("generated Supabase types include the deployed account schema and RPC", () => {
  const databaseTypes = read("types/database.types.ts");

  assert.match(databaseTypes, /competition_proof: Json \| null/);
  assert.match(databaseTypes, /timer_result: Json \| null/);
  assert.match(databaseTypes, /save_pr_attempt:/);
  assert.match(databaseTypes, /p_attempt: Json/);
  assert.match(databaseTypes, /p_personal_record\?: Json/);
  assert.match(databaseTypes, /save_pr_attempt:[\s\S]*?Returns: Json\b/);
  assert.match(databaseTypes, /save_personal_record:/);
  assert.match(databaseTypes, /athlete_states:/);
  assert.match(databaseTypes, /state: Json/);
  assert.match(databaseTypes, /schema_version: number/);
  assert.match(databaseTypes, /training_events:/);
  assert.match(databaseTypes, /readiness_checks:/);
  assert.match(databaseTypes, /structured_score: Json \| null/);
  assert.match(databaseTypes, /recommendation_snapshot: Json \| null/);
});

test("local Supabase Auth redirects match the documented development server", () => {
  const config = read("supabase/config.toml");

  assert.match(config, /site_url = "http:\/\/localhost:4173"/);
  assert.match(
    config,
    /additional_redirect_urls = \["http:\/\/127\.0\.0\.1:4173"\]/,
  );
});
