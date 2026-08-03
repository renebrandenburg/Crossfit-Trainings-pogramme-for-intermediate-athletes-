# Repository Guidelines

## Project Structure

The static app entry points are `index.html`, `app.js`, `react-app.js`, and
`styles.css`. The deterministic V2 engine lives in `src/programming-v2/`;
keep progression, validation, duration, persistence adapters, and formatting
there rather than in React components. Legacy V1 readers and migration helpers
remain in `app.js`. Tests are in `tests/`, with browser coverage in `e2e/`.
Supabase SQL and deployment helpers are kept in `supabase/` and the repository
root.

## Build, Test, and Development Commands

- `npm run dev` starts the local static development server.
- `npm run build:v2` bundles the strict-TypeScript V2 engine into `build/`.
- `npm run typecheck` checks both JavaScript declarations and V2 TypeScript.
- `npm test` builds V2 and runs the Node test suite.
- `npx playwright test` runs browser regression tests.

Run typechecking and focused tests before opening a pull request. The app is
local-first, so browser tests should clear storage between scenarios.

## Coding Style and Naming

Use two-space indentation, semicolons, and double-quoted strings in JavaScript
and TypeScript. Prefer pure functions and strict domain types. Use `camelCase`
for values/functions, `PascalCase` for React components and types, and stable
descriptive IDs for persisted V2 entities. Keep business logic out of JSX.

## Testing Guidelines

Node tests use `node:test` and `assert/strict`; name cases by observable
behavior. V2 tests should cover invariants such as movement-family separation,
load/rest guidance, validation gates, duration ceilings, regeneration, and
completion. React tests use Testing Library; Playwright tests verify visible
DOM text and reload persistence.

## Commits and Pull Requests

Use imperative, scoped messages such as `feat: add V2 template registry` or
`fix: preserve V1 migration state`. Pull requests should explain behavior
changes, list validation commands, link the issue, and include screenshots for
UI changes. Do not remove V1 readers or data migrations without a documented
rollback path.

## Architecture and Safety

V2 is the only generator for new programmes. V1 remains readable and
migratable. Never save or render a programme with validation errors, and never
reinterpret ambiguous legacy free text as structured prescriptions. Avoid
destructive database migrations until rollout parity and rollback tests pass.
