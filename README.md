# Forge Hour

A phone-first CrossFit training programme and PR tracker for intermediate athletes.

## What is included

- Four-day CrossFit programme capped at 60 minutes per session.
- Eight-week progression cycle with recalculated loads from the athlete's 1RMs.
- Needs-based programme generator for strength, endurance, gymnastics, or all-round goals.
- WOD variation across time domains and formats: AMRAP, intervals, for-time, EMOM, ladder, repeat sets, chipper, and benchmark.
- Manual training programme builder for adding your own sessions.
- Movement library for gymnastics and weightlifting skills with cues, progressions, scaling, and video guide links.
- Workout logging for readiness, RPE, strength or skill results, WOD score, notes, and mobility.
- PR tracker for major lifts, rowing, Murph, and gymnastics benchmarks.
- React-powered phone-first UI mounted into a static app shell.
- Light, dark, and system theme setting saved locally.
- Local-first storage in the browser with a simple PWA manifest and offline cache.

## Run locally

Install the test dependencies once:

```sh
npm install
```

Open `index.html` directly in a browser, or serve the folder for full PWA behavior:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

Run the unit and React Testing Library tests with:

```sh
npm test
```

## Host on GitHub Pages

The project includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
After the repository is pushed to GitHub, enable Pages with **GitHub Actions** as
the source in the repository settings. Every push to `master` or `main` will run
the test suite and deploy the static app.

The deployed app keeps the same local-first behavior: workout logs, generated
programmes, PRs, and training maxes stay in the user's browser storage.
