"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_PROFILE,
  DIVISION_LABELS,
  MOVEMENT_LIBRARY,
  PR_METRICS,
  WEEK_META,
  WOD_SCHEMA_VERSION,
  buildGeneratedProgramme,
  buildRxReadiness,
  buildSession,
  clamp,
  cloneDefaultProfile,
  customPlanSegments,
  filterMovementLibrary,
  formatPrValue,
  formatTimerResult,
  getProgramDays,
  inferTimerFromText,
  inferWorkoutTimer,
  isBetterPr,
  kg,
  migrateGeneratedProgrammePlans,
  migratePlanState,
  normalizePrValue,
  parseTimeToSeconds,
  percent,
  roundToNearest,
  selectActivePlan,
  selectActiveWeekSessions,
  splitLines,
  structuralWodSignature,
  timerDisplaySeconds,
  trimNumber,
} = require("../app.js");

function totalMinutes(session) {
  return session.segments.reduce(
    (sum, segment) => sum + Number(segment.minutes),
    0,
  );
}

function wodSegment(session) {
  return session.segments.find((segment) => /WOD|Engine/.test(segment.title));
}

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test("programme exposes an eight-week cycle", () => {
  assert.equal(WEEK_META.length, 8);
  assert.deepEqual(
    WEEK_META.map((week) => week.week),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.match(WEEK_META[7].title, /Week 8/);
});

test("built-in programme has four complete sessions per week capped at one hour", () => {
  const profile = cloneDefaultProfile();
  const days = getProgramDays();

  assert.equal(days.length, 4);

  for (const week of WEEK_META) {
    for (const day of days) {
      const session = buildSession(day.id, week.week, profile);
      const serialized = JSON.stringify(session);

      assert.equal(session.id, day.id);
      assert.ok(session.shortTitle.length > 0);
      assert.ok(session.focus.length > 0);
      assert.ok(session.segments.length >= 4);
      assert.ok(
        totalMinutes(session) <= 60,
        `${session.shortTitle} week ${week.week} exceeds 60 minutes`,
      );
      assert.equal(
        serialized.includes("undefined"),
        false,
        `${session.shortTitle} week ${week.week} contains undefined text`,
      );
    }
  }
});

test("week 5-8 strength prescriptions create a second build and testing wave", () => {
  const profile = cloneDefaultProfile();
  const weekSevenSquat = buildSession("day1", 7, profile);
  const weekEightEngine = buildSession("day2", 8, profile);
  const weekEightGymnastics = buildSession("day4", 8, profile);

  assert.match(JSON.stringify(weekSevenSquat), /90%/);
  assert.match(JSON.stringify(weekSevenSquat), /9 toes-to-bar/);
  assert.match(JSON.stringify(weekEightEngine), /Benchmark/);
  assert.match(JSON.stringify(weekEightGymnastics), /Benchmark/);
});

test("built-in WODs vary by week and expose stimulus, score, and scaling", () => {
  const profile = cloneDefaultProfile();

  for (const day of getProgramDays()) {
    const wods = WEEK_META.map((week) => {
      const segment = wodSegment(buildSession(day.id, week.week, profile));
      assert.ok(segment, `${day.id} should include a WOD or engine segment`);
      assert.match(segment.items[1], /Stimulus:/);
      assert.match(segment.items[2], /Score:/);
      assert.match(segment.items[2], /scale/i);
      return segment.items[0];
    });

    assert.equal(
      new Set(wods).size,
      8,
      `${day.id} should not repeat the same WOD across weeks`,
    );
    assert.match(wods.join(" "), /AMRAP/);
    assert.match(
      wods.join(" "),
      /Every 3 min|rounds for time|EMOM|ascending ladder|sets, rest|For time|Benchmark/,
    );
  }
});

test("timer helpers infer CrossFit workout formats and format results", () => {
  const profile = cloneDefaultProfile();
  const session = buildSession("day1", 1, profile);
  const inferred = inferWorkoutTimer(session);

  assert.equal(inferred.mode, "amrap");
  assert.equal(inferred.plannedSeconds, 720);
  assert.equal(
    inferTimerFromText("EMOM 16: min 1 row, min 2 rest").mode,
    "emom",
  );
  assert.deepEqual(
    {
      mode: inferTimerFromText("Every 3 min x 5: 15 cal row, 8 burpees").mode,
      plannedSeconds: inferTimerFromText(
        "Every 3 min x 5: 15 cal row, 8 burpees",
      ).plannedSeconds,
      intervalSeconds: inferTimerFromText(
        "Every 3 min x 5: 15 cal row, 8 burpees",
      ).intervalSeconds,
      rounds: inferTimerFromText("Every 3 min x 5: 15 cal row, 8 burpees")
        .rounds,
    },
    { mode: "interval", plannedSeconds: 900, intervalSeconds: 180, rounds: 5 },
  );
  assert.equal(
    inferTimerFromText("4 rounds for time, 15 min cap: row and wall balls")
      .mode,
    "forTime",
  );
  assert.equal(inferTimerFromText("Tabata air squats").plannedSeconds, 240);
  assert.equal(
    inferTimerFromText("5 sets, rest 1:00 between sets").mode,
    "rest",
  );
  assert.equal(
    inferTimerFromText("5 sets, rest 1:00 between sets").plannedSeconds,
    300,
  );
  assert.equal(timerDisplaySeconds("amrap", 900, 900), 0);
  assert.equal(timerDisplaySeconds("amrap", 900, 960), 0);
  assert.equal(timerDisplaySeconds("forTime", 900, 960), 960);
  assert.equal(
    formatTimerResult({ mode: "amrap", elapsedSeconds: 724, splits: [{}, {}] }),
    "AMRAP 12:04, 2 splits",
  );
});

test("load helpers round and format percentages for programmed weights", () => {
  assert.equal(roundToNearest(108.75, 2.5), 110);
  assert.equal(clamp(90, 45, 60), 60);
  assert.equal(kg(DEFAULT_PROFILE.maxes.backSquat, 0.75), "110 kg");
  assert.equal(percent(0.825), "82.5%");
  assert.equal(trimNumber(82.5), "82.5");
  assert.equal(trimNumber(100), "100");
});

test("default profile includes Masters 35-39 RX assessment fields", () => {
  const profile = cloneDefaultProfile();

  assert.equal(profile.age, 36);
  assert.equal(DIVISION_LABELS[profile.division], "Men Masters 35-39");
  assert.equal(profile.maxes.deadlift, 180);
  assert.equal(profile.maxes.strictPress, 60);
  assert.equal(profile.benchmarks.row2k, "7:30");
  assert.equal(profile.benchmarks.doubleUnders, 30);
  assert.ok(PR_METRICS.some((metric) => metric.id === "ringMuscleUp"));
  assert.ok(PR_METRICS.some((metric) => metric.id === "run5k"));
});

test("needs-based generator creates complete eight-week programmes", () => {
  const profile = cloneDefaultProfile();
  const plans = buildGeneratedProgramme(
    { goal: "stronger", daysPerWeek: 4, weakness: "pulling", duration: 60 },
    profile,
    (seed) => seed,
  );

  assert.equal(plans.length, 32);
  assert.deepEqual(
    [...new Set(plans.map((plan) => plan.week))],
    [1, 2, 3, 4, 5, 6, 7, 8],
  );

  for (const plan of plans) {
    assert.equal(plan.generated, true);
    assert.equal(plan.sourceGoal, "stronger");
    assert.equal(plan.sourceWeakness, "pulling");
    assert.ok(plan.duration <= 60);
    assert.equal(
      customPlanSegments(plan).reduce(
        (sum, segment) => sum + Number(segment.minutes),
        0,
      ),
      60,
    );
    assert.match(plan.wod[1], /Stimulus:/);
    assert.match(plan.wod[2], /Score:/);
    assert.equal(JSON.stringify(plan).includes("undefined"), false);
  }

  const dayOneWods = plans
    .filter((plan) => plan.title.includes("D1"))
    .map((plan) => plan.wod[0]);
  assert.equal(new Set(dayOneWods).size, 8);
  assert.match(dayOneWods.join(" "), /AMRAP/);
  assert.match(dayOneWods.join(" "), /Every 3 min/);
  assert.match(dayOneWods.join(" "), /Benchmark/);
  assert.match(JSON.stringify(plans[0]), /Back squat/);
  assert.match(JSON.stringify(plans[0]), /pull-ups and chest-to-bar/);
});

test("needs-based generator changes bias by goal and clamps options", () => {
  const profile = cloneDefaultProfile();
  const endurancePlans = buildGeneratedProgramme(
    { goal: "endurance", daysPerWeek: 9, weakness: "rowing", duration: 90 },
    profile,
    (seed) => seed,
  );
  const gymnasticsPlans = buildGeneratedProgramme(
    { goal: "gymnastics", daysPerWeek: 3, weakness: "muscleup", duration: 45 },
    profile,
    (seed) => seed,
  );

  assert.equal(endurancePlans.length, 40);
  assert.equal(gymnasticsPlans.length, 24);
  assert.match(JSON.stringify(endurancePlans), /5x500 m row|Zone 3 intervals/);
  assert.match(JSON.stringify(gymnasticsPlans), /Muscle-up/);
  assert.equal(endurancePlans[0].duration, 60);
  assert.equal(gymnasticsPlans[0].duration, 45);
});

test("needs-based generator programs running and bodyweight weaknesses directly", () => {
  const profile = cloneDefaultProfile();
  const plans = buildGeneratedProgramme(
    {
      goal: "balanced",
      daysPerWeek: 4,
      weakness: "runningBodyweight",
      duration: 60,
    },
    profile,
    (seed) => seed,
    "running-bodyweight-focus",
  );
  const runningDays = plans.filter((plan) => /\bD(?:2|4):/.test(plan.title));
  const serialized = JSON.stringify(plans);

  assert.equal(plans.length, 32);
  assert.ok(
    runningDays.every((plan) => /\brun\b/i.test(plan.wod[0])),
    "day two and day four conditioning should include running",
  );
  assert.match(serialized, /Running and bodyweight capacity/);
  assert.match(serialized, /200 m relaxed run \+ 8 push-ups \+ 12 air squats/);
  assert.match(serialized, /burpees/);
});

test("generated WODs use calories only for machines", () => {
  const profile = cloneDefaultProfile();
  const plans = [
    "stronger",
    "endurance",
    "gymnastics",
    "balanced",
    "mastersRxOpen",
  ].flatMap((goal) =>
    buildGeneratedProgramme(
      { goal, daysPerWeek: 5, weakness: "pulling", duration: 60 },
      profile,
      (seed) => `${goal}-${seed}`,
      `movement-validity-${goal}`,
    ),
  );
  const workouts = plans.map((plan) => plan.wod[0]).join(" ");

  assert.doesNotMatch(
    workouts,
    /\d+(?:\/\d+)? cal (?:double unders|run|shuttle runs?)/i,
  );
  assert.match(workouts, /30 double unders/);
  assert.match(workouts, /10\/8 cal (?:row|bike|ski)/);
});

test("Masters RX generator creates Open prep sessions with separate add-ons", () => {
  const profile = cloneDefaultProfile();
  const plans = buildGeneratedProgramme(
    {
      goal: "mastersRxOpen",
      daysPerWeek: 4,
      weakness: "muscleup",
      duration: 60,
    },
    profile,
    (seed) => seed,
  );

  assert.equal(plans.length, 32);
  assert.equal(plans[0].sourceGoal, "mastersRxOpen");
  assert.match(plans[0].title, /Squat \+ TTB capacity/);

  for (const plan of plans) {
    assert.equal(plan.generated, true);
    assert.ok(plan.duration <= 60);
    assert.equal(
      customPlanSegments(plan).reduce(
        (sum, segment) => sum + Number(segment.minutes),
        0,
      ),
      60,
    );
    assert.ok(
      Array.isArray(plan.addOns),
      "generated RX plans should expose optional add-ons",
    );
    assert.match(plan.wod[1], /Stimulus:/);
    assert.match(plan.wod[2], /Score:/);
    assert.equal(JSON.stringify(plan).includes("undefined"), false);
  }

  const serialized = JSON.stringify(plans);
  assert.match(serialized, /wall balls|shuttle runs|thrusters|bar muscle-ups/);
  assert.match(serialized, /Optional|add-on|Engine add-on|Skill add-on/i);
});

test("Masters RX last scheduled day uses the selected weakness focus", () => {
  const plans = buildGeneratedProgramme(
    {
      goal: "mastersRxOpen",
      daysPerWeek: 4,
      weakness: "runningBodyweight",
      duration: 60,
    },
    cloneDefaultProfile(),
    (seed) => seed,
    "masters-running-bodyweight",
  );
  const weaknessDays = plans.filter((plan) => /\bD4:/.test(plan.title));

  assert.equal(weaknessDays.length, 8);
  assert.ok(
    weaknessDays.every((plan) =>
      plan.strength.some((item) =>
        /200 m relaxed run \+ 8 push-ups \+ 12 air squats/.test(item),
      ),
    ),
  );
  assert.ok(
    weaknessDays.every((plan) =>
      /running and bodyweight capacity priority/i.test(plan.focus),
    ),
  );
});

test("RX readiness scoring reports RX Level, weakest categories, and missing tests", () => {
  const profile = cloneDefaultProfile();
  const strongProfile = {
    ...profile,
    maxes: {
      ...profile.maxes,
      backSquat: 170,
      frontSquat: 140,
      deadlift: 210,
      strictPress: 75,
      snatch: 95,
      cleanJerk: 120,
      thruster: 90,
    },
    benchmarks: {
      ...profile.benchmarks,
      row1k: "",
      row2k: "7:15",
      run5k: "23:00",
      pullUps: 25,
      chestToBar: 18,
      t2b: 25,
      barMuscleUp: 8,
      ringMuscleUp: 4,
      strictHspu: 8,
      handstandWalk: 15,
      doubleUnders: 100,
    },
  };
  const readiness = buildRxReadiness(strongProfile, [
    { date: daysAgo(1), readiness: "green", rpe: "7", mobilityDone: true },
    { date: daysAgo(3), readiness: "green", rpe: "7.5", mobilityDone: true },
    { date: daysAgo(5), readiness: "amber", rpe: "8", mobilityDone: true },
  ]);
  const incomplete = buildRxReadiness({
    ...profile,
    benchmarks: {
      ...profile.benchmarks,
      row1k: "",
      row2k: "",
      run5k: "",
      pullUps: 1,
      chestToBar: 1,
      t2b: 1,
      doubleUnders: 5,
    },
  });

  assert.equal(readiness.division, "Men Masters 35-39");
  assert.ok(readiness.rxLevel > incomplete.rxLevel);
  assert.ok(readiness.rxLevel <= 100);
  assert.ok(
    readiness.categories.some(
      (category) => category.label === "Strength" && category.score >= 100,
    ),
  );
  assert.ok(
    readiness.categories.some(
      (category) => category.label === "Engine" && category.missing === 1,
    ),
  );
  assert.ok(
    readiness.categories.some(
      (category) =>
        category.label === "Engine" &&
        /1 km row test needed/.test(category.summary),
    ),
  );
  assert.ok(
    readiness.categories.some((category) => category.label === "Consistency"),
  );
  assert.ok(
    readiness.missingTests.some(
      (item) => item.label === "1 km row" && item.categoryLabel === "Engine",
    ),
  );
  assert.equal(readiness.weakest.length, 2);
  assert.match(readiness.recommendation, /Prioritize/);
  assert.match(readiness.recommendation, /Test 1 km row/);
});

test("RX readiness consistency score uses recent workout logs", () => {
  const profile = cloneDefaultProfile();
  const quiet = buildRxReadiness(profile, []);
  const logs = Array.from({ length: 11 }, (_, index) => ({
    date: daysAgo(index * 2),
    readiness: "green",
    rpe: "7",
    mobilityDone: true,
  }));
  logs.push({
    date: "not-a-date",
    createdAt: daysAgoIso(2),
    readiness: "green",
    rpe: "7",
    mobilityDone: true,
  });
  const active = buildRxReadiness(profile, logs);
  const quietConsistency = quiet.categories.find(
    (category) => category.id === "consistency",
  );
  const activeConsistency = active.categories.find(
    (category) => category.id === "consistency",
  );

  assert.equal(quietConsistency.score, 0);
  assert.equal(activeConsistency.score, 100);
  assert.equal(
    activeConsistency.summary,
    "12/12 sessions logged in the last 28 days.",
  );
  assert.ok(active.rxLevel > quiet.rxLevel);
});

test("movement library covers gymnastics and weightlifting with video guides", () => {
  const categories = new Set(
    MOVEMENT_LIBRARY.map((movement) => movement.category),
  );
  const ids = new Set(MOVEMENT_LIBRARY.map((movement) => movement.id));

  assert.ok(MOVEMENT_LIBRARY.length >= 20);
  assert.equal(ids.size, MOVEMENT_LIBRARY.length);
  assert.ok(categories.has("Gymnastics"));
  assert.ok(categories.has("Weightlifting"));
  assert.ok(
    MOVEMENT_LIBRARY.some((movement) => movement.name === "Bar muscle-up"),
  );
  assert.ok(MOVEMENT_LIBRARY.some((movement) => movement.name === "Snatch"));
  assert.ok(
    MOVEMENT_LIBRARY.some((movement) => movement.name === "Clean and jerk"),
  );

  for (const movement of MOVEMENT_LIBRARY) {
    assert.ok(
      movement.cues.length >= 3,
      `${movement.name} should have coaching cues`,
    );
    assert.ok(
      movement.progressions.length >= 4,
      `${movement.name} should have progressions`,
    );
    assert.match(
      movement.videoUrl,
      /^https:\/\/www\.youtube\.com\/@CrossFit\/search/,
    );
    assert.match(movement.sourceUrl, /^https:\/\/www\.crossfit\.com\//);
  }

  assert.equal(
    filterMovementLibrary("Gymnastics", "bar muscle")
      .map((movement) => movement.id)
      .includes("bar-muscle-up"),
    true,
  );
  assert.equal(
    filterMovementLibrary("Weightlifting", "snatch").some(
      (movement) => movement.id === "snatch",
    ),
    true,
  );
  assert.equal(filterMovementLibrary("Gymnastics", "snatch").length, 0);
});

test("generated programme migration refreshes old WOD schema without changing IDs", () => {
  const profile = cloneDefaultProfile();
  const oldPlans = [
    {
      id: "generated-stronger-w2-d3",
      week: 2,
      title: "W2 D3: Front squat and pull",
      generated: true,
      sourceGoal: "stronger",
      sourceWeakness: "pulling",
      duration: 60,
      wod: ["AMRAP 12: same old thing"],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "manual-1",
      title: "Manual session",
      generated: false,
      wod: ["Keep this exact custom WOD"],
    },
  ];

  const migration = migrateGeneratedProgrammePlans(oldPlans, profile);

  assert.equal(migration.migrated, true);
  assert.equal(migration.plans[0].id, "generated-stronger-w2-d3");
  assert.equal(migration.plans[0].createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(migration.plans[0].wodSchemaVersion, WOD_SCHEMA_VERSION);
  assert.match(migration.plans[0].wod[1], /Stimulus:/);
  assert.match(migration.plans[0].wod[2], /Score:/);
  assert.equal(migration.plans[1], oldPlans[1]);
});

test("legacy custom plans migrate once into one canonical plan catalog", () => {
  const legacy = {
    schemaVersion: 2,
    selectedWeek: 2,
    profile: cloneDefaultProfile(),
    customPlans: [
      {
        id: "generated-1",
        week: 2,
        title: "W2 D1: Squat strength",
        generated: true,
        wodSchemaVersion: 4,
        sourceGoal: "stronger",
        sourceWeakness: "pulling",
        duration: 60,
        warmup: ["Original warm-up"],
        strength: ["Original strength"],
        wod: ["Original generated WOD"],
        mobility: ["Original mobility"],
        customized: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "manual-1",
        week: 2,
        title: "Manual session",
        warmup: ["Manual warm-up"],
        strength: [],
        wod: ["Manual WOD stays exact"],
        mobility: [],
        duration: 45,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ],
  };

  const first = migratePlanState(legacy);
  const migratedSessions = first.state.plans.flatMap((plan) => plan.sessions);

  assert.equal(first.migrated, true);
  assert.equal(Object.hasOwn(first.state, "customPlans"), false);
  assert.deepEqual(migratedSessions.map((session) => session.id).sort(), [
    "generated-1",
    "manual-1",
  ]);
  assert.equal(
    migratedSessions.find((session) => session.id === "generated-1").wod[0],
    "Original generated WOD",
  );
  assert.equal(
    migratedSessions.find((session) => session.id === "generated-1").customized,
    true,
  );
  assert.ok(selectActivePlan(first.state));
  assert.ok(selectActiveWeekSessions(first.state, 2).length > 0);

  const second = migratePlanState(first.state);
  assert.equal(second.migrated, false);
  assert.equal(second.state, first.state);
});

test("seeded generation is reproducible, immutable, and materially varied", () => {
  const profile = cloneDefaultProfile();
  const options = {
    goal: "balanced",
    daysPerWeek: 4,
    weakness: "pulling",
    duration: 60,
  };
  const originalProfile = structuredClone(profile);
  const originalOptions = structuredClone(options);
  const ids = (seed) => seed;

  const alpha = buildGeneratedProgramme(options, profile, ids, "seed-alpha");
  const alphaAgain = buildGeneratedProgramme(
    options,
    profile,
    ids,
    "seed-alpha",
  );
  const beta = buildGeneratedProgramme(options, profile, ids, "seed-beta");

  assert.deepEqual(
    alpha.map((session) => session.wod),
    alphaAgain.map((session) => session.wod),
  );
  assert.ok(
    alpha.some((session, index) => session.wod[0] !== beta[index].wod[0]),
    "different seeds must change workout format or movements",
  );
  assert.deepEqual(options, originalOptions);
  assert.deepEqual(profile, originalProfile);
  assert.equal(
    new Set(alpha.map((session) => session.wod[0])).size,
    alpha.length,
  );
  assert.equal(
    new Set(beta.map((session) => session.wod[0])).size,
    beta.length,
  );
});

test("WOD identity ignores numeric targets but preserves format and movements", () => {
  const base = [
    "AMRAP 12: 20 wall balls, 12 box jump-overs, 8 toes-to-bar. Target 80+ wall balls total.",
  ];
  const higherTargets = [
    "AMRAP 18: 30 wall balls, 15 box jump-overs, 10 toes-to-bar. Target 150+ wall balls total.",
  ];

  assert.equal(
    structuralWodSignature(base),
    structuralWodSignature(higherTargets),
  );
  assert.notEqual(
    structuralWodSignature(base),
    structuralWodSignature([
      "Every 3 min x 4: 20 wall balls, 12 box jump-overs, 8 toes-to-bar",
    ]),
  );
  assert.notEqual(
    structuralWodSignature(base),
    structuralWodSignature([
      "AMRAP 12: 8 power cleans, 10 burpees, 12 shuttle runs",
    ]),
  );
});

test("seeded Masters RX generation is structurally unique and changes across cycles", () => {
  const options = {
    goal: "mastersRxOpen",
    daysPerWeek: 5,
    weakness: "pulling",
    duration: 60,
  };
  const profile = cloneDefaultProfile();
  const buildSignatures = (seed, daysPerWeek = 5) =>
    buildGeneratedProgramme(
      { ...options, daysPerWeek },
      profile,
      (id) => id,
      seed,
    ).map((session) => structuralWodSignature(session.wod));
  const alpha = buildSignatures("masters-alpha");
  const alphaAgain = buildSignatures("masters-alpha");
  const beta = buildSignatures("masters-beta");
  const betaSet = new Set(beta);
  const overlap = alpha.filter((signature) => betaSet.has(signature));

  assert.equal(alpha.length, 40);
  assert.equal(new Set(alpha).size, alpha.length);
  assert.equal(new Set(beta).size, beta.length);
  assert.deepEqual(alphaAgain, alpha);
  assert.ok(
    overlap.length < alpha.length / 2,
    "regeneration must change movements, not just reorder the same templates",
  );

  const structuralCatalog = new Set();
  let previousFullCycle = null;
  for (const daysPerWeek of [3, 4, 5]) {
    for (let seedIndex = 0; seedIndex < 32; seedIndex += 1) {
      const signatures = buildSignatures(
        `masters-sweep-${seedIndex}`,
        daysPerWeek,
      );
      assert.equal(signatures.length, daysPerWeek * 8);
      assert.equal(new Set(signatures).size, signatures.length);
      if (daysPerWeek === 5) {
        if (previousFullCycle) {
          const previousOverlap = signatures.filter((signature) =>
            previousFullCycle.has(signature),
          );
          assert.ok(
            previousOverlap.length < signatures.length / 2,
            `seed ${seedIndex} must materially change the prior cycle`,
          );
        }
        signatures.forEach((signature) => structuralCatalog.add(signature));
        previousFullCycle = new Set(signatures);
      }
    }
  }
  assert.ok(
    structuralCatalog.size > 200,
    "the Masters generator should expose a deep cross-cycle workout catalog",
  );
});

test("canonical generated-plan migration is plan-wide, lossless, and idempotent", () => {
  const profile = cloneDefaultProfile();
  const oldSessions = buildGeneratedProgramme(
    {
      goal: "mastersRxOpen",
      daysPerWeek: 5,
      weakness: "pulling",
      duration: 60,
    },
    profile,
    (seed) => seed,
    "seed-195",
  ).map((session, index) => ({
    ...session,
    id: `old-session-${index + 1}`,
    wodSchemaVersion: WOD_SCHEMA_VERSION - 1,
    createdAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
    updatedAt: `2026-02-${String((index % 28) + 1).padStart(2, "0")}T09:00:00.000Z`,
  }));
  const customized = {
    ...oldSessions[0],
    customized: true,
    wod: ["Keep this customized WOD exactly"],
  };
  const manual = {
    id: "manual-session",
    week: 1,
    title: "Manual session",
    focus: "Athlete choice",
    warmup: ["Easy bike"],
    strength: [],
    wod: ["Manual WOD stays exact"],
    mobility: [],
    duration: 45,
    origin: "manual",
    customized: true,
    createdAt: "2026-03-01T08:00:00.000Z",
    updatedAt: "2026-03-02T08:00:00.000Z",
  };
  const sessions = [customized, ...oldSessions.slice(1), manual];
  const source = {
    schemaVersion: 2,
    profile,
    plans: [
      {
        id: "canonical-generated-plan",
        title: "Masters generated plan",
        kind: "generated",
        generatorOptions: {
          goal: "mastersRxOpen",
          daysPerWeek: 5,
          weakness: "pulling",
          duration: 60,
        },
        generationSeed: "seed-195",
        createdAt: "2026-01-01T07:00:00.000Z",
        updatedAt: "2026-03-03T07:00:00.000Z",
        sessions,
      },
    ],
    activePlanId: "canonical-generated-plan",
    selectedWeek: 1,
  };

  const first = migratePlanState(source);
  const migratedPlan = first.state.plans[0];
  const migratedGenerated = migratedPlan.sessions.filter(
    (session) => session.origin === "generated" && !session.customized,
  );

  assert.equal(first.migrated, true);
  assert.equal(migratedPlan.id, source.plans[0].id);
  assert.equal(migratedPlan.createdAt, source.plans[0].createdAt);
  assert.equal(migratedPlan.updatedAt, source.plans[0].updatedAt);
  assert.deepEqual(migratedPlan.sessions[0], customized);
  assert.deepEqual(migratedPlan.sessions.at(-1), manual);
  assert.deepEqual(
    migratedGenerated.map((session) => session.id),
    oldSessions.slice(1).map((session) => session.id),
  );
  assert.deepEqual(
    migratedGenerated.map((session) => session.createdAt),
    oldSessions.slice(1).map((session) => session.createdAt),
  );
  assert.deepEqual(
    migratedGenerated.map((session) => session.updatedAt),
    oldSessions.slice(1).map((session) => session.updatedAt),
  );
  assert.ok(
    migratedGenerated.every(
      (session) => session.wodSchemaVersion === WOD_SCHEMA_VERSION,
    ),
  );
  assert.equal(
    new Set(
      migratedGenerated.map((session) => structuralWodSignature(session.wod)),
    ).size,
    migratedGenerated.length,
  );

  const second = migratePlanState(first.state);
  assert.equal(second.migrated, false);
  assert.equal(second.state, first.state);
});

test("custom programme helpers turn phone text areas into renderable segments", () => {
  const plan = {
    warmup: splitLines("8 min easy row\n\nDynamic shoulders "),
    strength: splitLines("EMOM 10: pull-up skill"),
    wod: splitLines("AMRAP 12: row, DB snatch, burpee"),
    mobility: [],
  };

  const segments = customPlanSegments(plan);

  assert.deepEqual(plan.warmup, ["8 min easy row", "Dynamic shoulders"]);
  assert.deepEqual(
    segments.map((segment) => segment.title),
    ["Warm-up", "Strength and skill", "WOD"],
  );
  assert.equal(segments[0].items.length, 2);
});

test("PR helpers parse times, format results, and compare records", () => {
  const rowMetric = PR_METRICS.find((metric) => metric.id === "row1k");
  const squatMetric = PR_METRICS.find((metric) => metric.id === "backSquat");

  assert.equal(parseTimeToSeconds("3:30"), 210);
  assert.equal(parseTimeToSeconds("1:02:03"), 3723);
  assert.equal(normalizePrValue("145,5", squatMetric), 145.5);
  assert.equal(formatPrValue(210, rowMetric), "3:30");
  assert.equal(formatPrValue(145, squatMetric), "145 kg");
  assert.equal(isBetterPr(205, 210, rowMetric), true);
  assert.equal(isBetterPr(147.5, 145, squatMetric), true);
  assert.equal(isBetterPr(212, 210, rowMetric), false);
});
