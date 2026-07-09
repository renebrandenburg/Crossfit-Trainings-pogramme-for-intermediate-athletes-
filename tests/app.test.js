"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_PROFILE,
  DIVISION_LABELS,
  MOVEMENT_LIBRARY,
  PR_METRICS,
  WEEK_META,
  buildGeneratedProgramme,
  buildRxReadiness,
  buildSession,
  clamp,
  cloneDefaultProfile,
  customPlanSegments,
  filterMovementLibrary,
  formatPrValue,
  getProgramDays,
  isBetterPr,
  kg,
  migrateGeneratedProgrammePlans,
  normalizePrValue,
  parseTimeToSeconds,
  percent,
  roundToNearest,
  splitLines,
  trimNumber
} = require("../app.js");

function totalMinutes(session) {
  return session.segments.reduce((sum, segment) => sum + Number(segment.minutes), 0);
}

function wodSegment(session) {
  return session.segments.find((segment) => /WOD|Engine/.test(segment.title));
}

test("programme exposes an eight-week cycle", () => {
  assert.equal(WEEK_META.length, 8);
  assert.deepEqual(WEEK_META.map((week) => week.week), [1, 2, 3, 4, 5, 6, 7, 8]);
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
      assert.ok(totalMinutes(session) <= 60, `${session.shortTitle} week ${week.week} exceeds 60 minutes`);
      assert.equal(serialized.includes("undefined"), false, `${session.shortTitle} week ${week.week} contains undefined text`);
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

    assert.equal(new Set(wods).size, 8, `${day.id} should not repeat the same WOD across weeks`);
    assert.match(wods.join(" "), /AMRAP/);
    assert.match(wods.join(" "), /Every 3 min|rounds for time|EMOM|ascending ladder|sets, rest|For time|Benchmark/);
  }
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
    (seed) => seed
  );

  assert.equal(plans.length, 32);
  assert.deepEqual([...new Set(plans.map((plan) => plan.week))], [1, 2, 3, 4, 5, 6, 7, 8]);

  for (const plan of plans) {
    assert.equal(plan.generated, true);
    assert.equal(plan.sourceGoal, "stronger");
    assert.equal(plan.sourceWeakness, "pulling");
    assert.ok(plan.duration <= 60);
    assert.equal(customPlanSegments(plan).reduce((sum, segment) => sum + Number(segment.minutes), 0), 60);
    assert.match(plan.wod[1], /Stimulus:/);
    assert.match(plan.wod[2], /Score:/);
    assert.equal(JSON.stringify(plan).includes("undefined"), false);
  }

  const dayOneWods = plans.filter((plan) => plan.title.includes("D1")).map((plan) => plan.wod[0]);
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
    (seed) => seed
  );
  const gymnasticsPlans = buildGeneratedProgramme(
    { goal: "gymnastics", daysPerWeek: 3, weakness: "muscleup", duration: 45 },
    profile,
    (seed) => seed
  );

  assert.equal(endurancePlans.length, 40);
  assert.equal(gymnasticsPlans.length, 24);
  assert.match(JSON.stringify(endurancePlans), /5x500 m row|Zone 3 intervals/);
  assert.match(JSON.stringify(gymnasticsPlans), /Muscle-up/);
  assert.equal(endurancePlans[0].duration, 60);
  assert.equal(gymnasticsPlans[0].duration, 45);
});

test("Masters RX generator creates Open prep sessions with separate add-ons", () => {
  const profile = cloneDefaultProfile();
  const plans = buildGeneratedProgramme(
    { goal: "mastersRxOpen", daysPerWeek: 4, weakness: "muscleup", duration: 60 },
    profile,
    (seed) => seed
  );

  assert.equal(plans.length, 32);
  assert.equal(plans[0].sourceGoal, "mastersRxOpen");
  assert.match(plans[0].title, /Squat \+ TTB capacity/);

  for (const plan of plans) {
    assert.equal(plan.generated, true);
    assert.ok(plan.duration <= 60);
    assert.equal(customPlanSegments(plan).reduce((sum, segment) => sum + Number(segment.minutes), 0), 60);
    assert.ok(Array.isArray(plan.addOns), "generated RX plans should expose optional add-ons");
    assert.match(plan.wod[1], /Stimulus:/);
    assert.match(plan.wod[2], /Score:/);
    assert.equal(JSON.stringify(plan).includes("undefined"), false);
  }

  const serialized = JSON.stringify(plans);
  assert.match(serialized, /wall balls|shuttle runs|thrusters|bar muscle-ups/);
  assert.match(serialized, /Optional|add-on|Engine add-on|Skill add-on/i);
});

test("RX readiness scoring reports weakest categories and missing tests", () => {
  const profile = cloneDefaultProfile();
  const readiness = buildRxReadiness({
    ...profile,
    maxes: {
      ...profile.maxes,
      backSquat: 170,
      frontSquat: 140,
      deadlift: 210,
      strictPress: 75,
      snatch: 95,
      cleanJerk: 120,
      thruster: 90
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
      doubleUnders: 100
    }
  });

  assert.equal(readiness.division, "Men Masters 35-39");
  assert.ok(readiness.categories.some((category) => category.label === "Strength" && category.score >= 100));
  assert.ok(readiness.categories.some((category) => category.label === "Engine" && category.missing === 1));
  assert.equal(readiness.weakest.length, 2);
  assert.match(readiness.recommendation, /Prioritize/);
});

test("movement library covers gymnastics and weightlifting with video guides", () => {
  const categories = new Set(MOVEMENT_LIBRARY.map((movement) => movement.category));
  const ids = new Set(MOVEMENT_LIBRARY.map((movement) => movement.id));

  assert.ok(MOVEMENT_LIBRARY.length >= 20);
  assert.equal(ids.size, MOVEMENT_LIBRARY.length);
  assert.ok(categories.has("Gymnastics"));
  assert.ok(categories.has("Weightlifting"));
  assert.ok(MOVEMENT_LIBRARY.some((movement) => movement.name === "Bar muscle-up"));
  assert.ok(MOVEMENT_LIBRARY.some((movement) => movement.name === "Snatch"));
  assert.ok(MOVEMENT_LIBRARY.some((movement) => movement.name === "Clean and jerk"));

  for (const movement of MOVEMENT_LIBRARY) {
    assert.ok(movement.cues.length >= 3, `${movement.name} should have coaching cues`);
    assert.ok(movement.progressions.length >= 4, `${movement.name} should have progressions`);
    assert.match(movement.videoUrl, /^https:\/\/www\.youtube\.com\/@CrossFit\/search/);
    assert.match(movement.sourceUrl, /^https:\/\/www\.crossfit\.com\//);
  }

  assert.equal(filterMovementLibrary("Gymnastics", "bar muscle").map((movement) => movement.id).includes("bar-muscle-up"), true);
  assert.equal(filterMovementLibrary("Weightlifting", "snatch").some((movement) => movement.id === "snatch"), true);
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
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "manual-1",
      title: "Manual session",
      generated: false,
      wod: ["Keep this exact custom WOD"]
    }
  ];

  const migration = migrateGeneratedProgrammePlans(oldPlans, profile);

  assert.equal(migration.migrated, true);
  assert.equal(migration.plans[0].id, "generated-stronger-w2-d3");
  assert.equal(migration.plans[0].createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(migration.plans[0].wodSchemaVersion, 2);
  assert.match(migration.plans[0].wod[1], /Stimulus:/);
  assert.match(migration.plans[0].wod[2], /Score:/);
  assert.equal(migration.plans[1], oldPlans[1]);
});

test("custom programme helpers turn phone text areas into renderable segments", () => {
  const plan = {
    warmup: splitLines("8 min easy row\n\nDynamic shoulders "),
    strength: splitLines("EMOM 10: pull-up skill"),
    wod: splitLines("AMRAP 12: row, DB snatch, burpee"),
    mobility: []
  };

  const segments = customPlanSegments(plan);

  assert.deepEqual(plan.warmup, ["8 min easy row", "Dynamic shoulders"]);
  assert.deepEqual(segments.map((segment) => segment.title), ["Warm-up", "Strength and skill", "WOD"]);
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
