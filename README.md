# CrossFit Training Programme

A phone-first CrossFit training programme and PR tracker for intermediate athletes.

## What is included

- Four-day CrossFit programme capped at 60 minutes per session.
- Eight-week progression cycle with recalculated loads from the athlete's 1RMs.
- Needs-based programme generator for strength, endurance, gymnastics, or all-round goals.
- Masters 35-39 RX/Open prep generator with readiness targets, assessment fields, and optional engine or skill add-ons.
- WOD variation across time domains and formats: AMRAP, intervals, for-time, EMOM, ladder, repeat sets, chipper, and benchmark.
- Manual training programme builder for adding your own sessions.
- Movement library for gymnastics and weightlifting skills with cues, progressions, scaling, and video guide links.
- Workout logging for readiness, RPE, strength or skill results, WOD score, notes, and mobility.
- iPhone Competition Proof recording with a synchronized timer overlay, local video preview, and save/share controls.
- PR tracker for major lifts, rowing, Murph, and gymnastics benchmarks.
- RX readiness dashboard for strength, Olympic lifting, engine, gymnastics, Open skills, and recovery focus areas.
- React-powered phone-first UI mounted into a static app shell.
- Light, dark, and system theme setting saved locally.
- Optional Supabase Postgres sync for workout logs and PR records.
- Local-first storage in the browser with a simple PWA manifest and offline cache.

## Competition Proof recording

Open the **Proof** tab, choose a programmed or saved session or enter a custom
competition workout, then configure the timer mode, duration or time cap,
interval length, and countdown. Opening the camera requests the rear camera and
microphone and starts the configured timer and video together. On supported
browsers, the athlete, workout, timer, round, and recording state are embedded
into the exported video. Review the result before saving or sharing it from the
iPhone, then continue to the workout log to store the timer and proof metadata.

Recording requires a current iPhone browser, camera and microphone permission,
and an HTTPS deployment such as GitHub Pages. Keep the app in the foreground and
disable Auto-Lock for long workouts. Backgrounding or locking the phone is
marked as an interruption. Recording chunks use temporary private browser file
storage when available and are deleted after export or discard. Browsers without
that capability use a lower-resolution in-memory fallback and show a warning.
Videos are never uploaded to Supabase or added to the offline cache. Browser
proof recording is not an official competition certification or an automatic
submission to an event platform.

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

## Supabase database sync

Workout logs, PR attempts, and current PRs can sync to Supabase Postgres after
sign-in. Profile settings, generated/custom programmes, selected week, and theme
remain local to the browser.

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. In `supabase-config.js`, set your project URL and public anon key. Never put
   a Supabase service-role key in this static app.
4. In Supabase Auth settings, allow both `http://localhost:4173` and your
   deployed GitHub Pages URL as redirect URLs.
5. Keep Row Level Security enabled on the Supabase tables. The provided schema
   restricts reads and writes to authenticated users where `auth.uid()` matches
   the row `user_id`.
6. Review Supabase Auth rate limits and CAPTCHA settings before making a public
   deployment.
7. Serve or deploy the app, then use the Database sync panel to email a sign-in
   link and upload existing local scores.

Run the updated `supabase-schema.sql` again on an existing project to add the
nullable `competition_proof` metadata column. The script uses idempotent
`add column if not exists` statements and does not create video storage.

## Host on GitHub Pages

The project includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
After the repository is pushed to GitHub, enable Pages with **GitHub Actions** as
the source in the repository settings. Every push to `master` or `main` will run
the test suite and deploy the static app.

The deployed app keeps local-first behavior for generated programmes, training
maxes, and theme settings. Signed-in users can persist workout logs and PR data
in Supabase across devices and deployments.
