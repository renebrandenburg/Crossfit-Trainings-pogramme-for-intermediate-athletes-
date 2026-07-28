# Playwright end-to-end testing

The Playwright suite exercises authentication, custom-plan lifecycle, generator consistency, workout safety rules, and backend error states. Pull requests use a deterministic browser-side Supabase double. This keeps the critical suite isolated, fast, and safe while still exercising the real UI and persistence code.

## Install and run

Install the pinned dependencies and browser binaries:

```bash
npm ci
npx playwright install chromium
```

Run the pull-request smoke and critical suite:

```bash
npm run test:e2e:critical
```

Other useful commands:

```bash
npm run test:e2e:smoke
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:headed
npx playwright test e2e/plans/custom-plan.spec.js --project=chromium
npx playwright test --project=chromium --grep "edits a plan"
npx playwright show-trace test-results/<test-folder>/trace.zip
npm run test:e2e:report
```

Install all three browser engines before running the complete local matrix:

```bash
npx playwright install chromium firefox webkit
```

## Default mock environment

Copy `.env.example` values into your shell or local untracked environment file when overrides are needed. With no E2E environment variables, Playwright uses:

- `http://127.0.0.1:4173` and the repository's static server;
- a dedicated mock athlete (`e2e-athlete@example.test`);
- a browser-local Supabase double;
- locally installed React, ReactDOM, and Supabase browser assets, so test behavior does not depend on CDNs;
- one clean browser context per test, based on reusable authenticated storage state.

The auth state is written to `playwright/.auth/` and is ignored by Git. Mock database records live only in the test browser's local storage. Each test uses UUID-based plan and session names, so tests do not depend on order and can run in parallel.

## Staging Supabase mode

Real authentication and database checks are opt-in. Use only a dedicated non-production project and E2E account:

```bash
E2E_MODE=staging \
PLAYWRIGHT_BASE_URL=https://staging.example.test \
E2E_SUPABASE_URL=https://your-test-project.supabase.co \
E2E_SUPABASE_ANON_KEY=... \
E2E_SUPABASE_SERVICE_ROLE_KEY=... \
E2E_USER_EMAIL=e2e-athlete@example.test \
npm run test:e2e:smoke
```

The app uses passwordless magic-link authentication, so `E2E_USER_PASSWORD` is documented for compatibility but is not used. The service-role key generates a test magic link in Node and is never injected into the page, screenshot, video, trace, or report.

Cleanup is disabled unless `E2E_ENABLE_REMOTE_CLEANUP=true`. Cleanup targets only records owned by the dedicated E2E user. It refuses the production project URL hardcoded by the application. For a project URL that does not visibly contain `test`, `staging`, `preview`, `dev`, or `local`, also set:

```bash
E2E_ALLOW_NON_PRODUCTION_SUPABASE=I_UNDERSTAND_THIS_IS_NOT_PRODUCTION
```

That acknowledgement does not override the explicit production-project block.

## Failures and traces

Screenshots are captured only on failure, videos are retained on failure, and traces are collected on the first retry. Reports are written to `playwright-report/`; raw artifacts are written to `test-results/`. CI uploads both directories when a job fails or is cancelled.

Tests wait for visible UI, browser validity, persisted state, or backend state. Do not add fixed sleeps. Prefer `getByRole`, `getByLabel`, and other accessible locators. Page objects belong in `e2e/pages/`, shared fixtures in `e2e/fixtures/`, and setup/cleanup utilities in `e2e/helpers/`.

## Current product boundaries

The builder currently exposes goal, days per week, weakness or bar-muscle-up level, athlete level, and maximum session duration. It does not expose selectable equipment, included/excluded movement lists, a separate conditioning-duration selector, or a user-entered dumbbell maximum. The suite therefore verifies the implemented structured workout rules: athlete-level dumbbell caps, explicit movement identifiers, consistent ladder assignments, valid units, and weekly short/medium/long coverage.

When those controls are added, extend the generated-plan fixture and assert their saved structured values plus every generated workout's equipment and movement requirements. Avoid validating one large rendered prose block when structured workout data is available.
