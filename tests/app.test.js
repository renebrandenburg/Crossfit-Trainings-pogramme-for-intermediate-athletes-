"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ATHLETE_LEVELS,
  applyReadinessVariant,
  DEFAULT_PROFILE,
  DIVISION_LABELS,
  MOVEMENT_CATALOG,
  MOVEMENT_LIBRARY,
  PR_METRICS,
  RX_CATEGORY_WEIGHTS,
  RX_LEVEL_BANDS,
  WEEK_META,
  WOD_SCHEMA_VERSION,
  WORKOUT_DEFINITION_VERSION,
  buildGeneratedProgramme,
  buildOlympicFamilySchedule,
  buildRxReadiness,
  buildSession,
  claimUniqueGeneratedWod,
  clamp,
  cloneDefaultProfile,
  customPlanSegments,
  filterMovementLibrary,
  formatPrValue,
  formatTimerResult,
  generatedProgrammeErrors,
  generatedProgrammeWarnings,
  generatedWeekErrors,
  generatedSessionErrors,
  getProgramDays,
  inferTimerFromText,
  inferWorkoutTimer,
  isBetterPr,
  kg,
  migrateGeneratedProgrammePlans,
  migratePlanState,
  regeneratePlanFrequency,
  normalizeGeneratorOptions,
  normalizePrValue,
  parseTimeToSeconds,
  percent,
  roundToNearest,
  rxLevelBand,
  selectDumbbellSnatchLoad,
  selectActivePlan,
  selectActiveWeekSessions,
  splitLines,
  structuralWodSignature,
  timerDisplaySeconds,
  trimNumber,
  renderWorkoutDescription,
  validateWorkoutDefinition,
  validateGeneratedWeek,
  validateWeeklyPlan,
  weeklyTrainingProgress,
  workoutExpectedDurationSeconds,
  workoutDefinitionErrors,
  workoutItemsForSession,
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

function wodItems(session) {
  return workoutItemsForSession(session);
}

function definitionExercises(definition) {
  const main =
    definition?.format?.type === "emom"
      ? (definition.format.stations || []).flatMap(
          (station) => station.exercises || [],
        )
      : definition?.exercises || [];
  return [
    ...(definition?.buyIn || []),
    ...main,
    ...(definition?.afterEachRound || []),
    ...(definition?.cashOut || []),
  ];
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
      assert.match(segment.items[3], /Scaling:/i);
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
    assert.match(wodItems(plan)[1], /Stimulus:/);
    assert.match(wodItems(plan)[2], /Score:/);
    assert.equal(
      plan.workoutDefinition.schemaVersion,
      WORKOUT_DEFINITION_VERSION,
    );
    assert.equal(Object.hasOwn(plan, "wod"), false);
    assert.equal(JSON.stringify(plan).includes("undefined"), false);
  }

  const dayOneWods = plans
    .filter((plan) => plan.title.includes("D1"))
    .map((plan) => wodItems(plan)[0]);
  assert.equal(new Set(dayOneWods).size, 8);
  assert.match(dayOneWods.join(" "), /AMRAP/);
  assert.match(dayOneWods.join(" "), /Every 3 min/);
  assert.match(dayOneWods.join(" "), /Benchmark/);
  assert.match(JSON.stringify(plans[0]), /Back squat/);
  assert.match(JSON.stringify(plans[0]), /pull-ups and chest-to-bar/);
});

test("two-day generator creates intentional progression weeks without truncation", () => {
  const options = {
    primaryGoal: "stronger",
    secondaryGoal: "endurance",
    programDaysPerWeek: 2,
    weakness: "pulling",
    sessionDuration: 75,
    usesBoxProgramming: true,
    expectedBoxDays: 2,
    preferredProgramDays: ["tuesday", "saturday"],
    availableEquipment: [
      "barbell",
      "rack",
      "pullupBar",
      "dumbbells",
      "kettlebells",
      "box",
      "rings",
      "rower",
      "bike",
      "running",
    ],
    barbellDropPolicy: "allowed",
  };
  const sessions = buildGeneratedProgramme(
    options,
    cloneDefaultProfile(),
    (id) => id,
    "two-day-seed",
  );
  assert.equal(sessions.length, 16);
  for (let week = 1; week <= 8; week += 1) {
    const weekSessions = sessions.filter((session) => session.week === week);
    assert.equal(weekSessions.length, 2);
    assert.ok(weekSessions.every((session) => session.twoDayStrategy));
    assert.match(weekSessions[0].title, /Primary strength \+ skill/);
    assert.match(weekSessions[1].title, /Secondary strength \+ engine/);
    assert.ok(
      weekSessions.every((session) => session.progressionBlocks.length >= 3),
    );
    assert.deepEqual(
      validateWeeklyPlan(weekSessions, {
        requiredTimeDomains: ["short", "long"],
        requireTwoDayStructure: true,
      }).errors,
      [],
    );
  }
});

test("Olympic family schedules use focused two-week microcycles", () => {
  const first = buildOlympicFamilySchedule("family-seed-a");
  const repeat = buildOlympicFamilySchedule("family-seed-a");
  const restricted = buildOlympicFamilySchedule("family-seed-a", 8, ["clean"]);

  assert.deepEqual(first, repeat);
  assert.equal(first.length, 8);
  assert.deepEqual(new Set(first), new Set(["clean", "snatch"]));
  for (let index = 0; index < first.length; index += 2) {
    assert.equal(first[index], first[index + 1]);
    if (index >= 2) assert.notEqual(first[index], first[index - 1]);
  }
  assert.deepEqual(restricted, Array(8).fill("clean"));
});

test("two-day Olympic weakness balances clean and snatch across the full block", () => {
  const options = {
    primaryGoal: "balanced",
    secondaryGoal: "endurance",
    programDaysPerWeek: 2,
    usesBoxProgramming: true,
    expectedBoxDays: 2,
    weakness: "olympic",
    sessionDuration: 60,
    athleteLevel: "intermediate",
    barbellDropPolicy: "allowed",
  };
  const familyByMovementId = new Map(
    MOVEMENT_CATALOG.map((movement) => [movement.id, movement.olympicFamily]),
  );

  for (const seed of [
    "olympic-balance-a",
    "olympic-balance-b",
    "olympic-balance-c",
  ]) {
    const sessions = buildGeneratedProgramme(
      options,
      cloneDefaultProfile(),
      (id) => id,
      seed,
    );
    const weeklyFamilies = Array.from({ length: 8 }, (_value, index) => {
      const families = new Set(
        sessions
          .filter((session) => session.week === index + 1)
          .flatMap((session) => session.olympicExposureMovementIds)
          .map((movementId) => familyByMovementId.get(movementId)),
      );
      assert.equal(families.size, 1);
      return [...families][0];
    });

    assert.deepEqual(new Set(weeklyFamilies), new Set(["clean", "snatch"]));
    assert.deepEqual(generatedProgrammeErrors(sessions, options), []);
    assert.deepEqual(generatedProgrammeWarnings(sessions, options), []);
    assert.ok(
      sessions.some((session) =>
        session.strength.some((item) => /Hang clean 6x2/.test(item)),
      ),
    );
    assert.ok(
      sessions.some((session) =>
        session.strength.some((item) => /Hang snatch 6x2/.test(item)),
      ),
    );
    const olympicWodMovements = sessions
      .flatMap((session) => definitionExercises(session.workoutDefinition))
      .filter((exercise) =>
        /hang power (?:cleans|snatches)/i.test(exercise.movement),
      );
    assert.ok(
      olympicWodMovements.some(
        (exercise) => exercise.movementId === "hang-power-cleans",
      ),
    );
    assert.ok(
      olympicWodMovements.some(
        (exercise) => exercise.movementId === "hang-power-snatches",
      ),
    );
    olympicWodMovements.forEach((exercise) => {
      assert.match(exercise.load?.display || "", /^\d+(?:\.\d+)? kg$/);
      assert.doesNotMatch(exercise.movement, /drills?/i);
    });
    assert.doesNotMatch(
      JSON.stringify(sessions),
      /clean pulls or snatch pulls|tall clean\/snatch pulls|overhead or front rack holds|hang power clean drills/i,
    );
    sessions.forEach((session) => {
      assert.equal(session.duration, 60);
      assert.deepEqual(generatedSessionErrors(session), []);
    });
  }
});

test("Olympic block validation detects missing families and honors eligibility restrictions", () => {
  const options = {
    goal: "balanced",
    weakness: "olympic",
    daysPerWeek: 2,
    duration: 60,
  };
  const sessions = buildGeneratedProgramme(
    options,
    cloneDefaultProfile(),
    (id) => id,
    "olympic-validator",
  );
  const cleanOnly = sessions.map((session) =>
    session.olympicFamily === "snatch"
      ? { ...session, olympicExposureMovementIds: [] }
      : session,
  );

  assert.match(
    generatedProgrammeErrors(cleanOnly, options).join(" "),
    /missing snatch-family exposure/,
  );
  const longGap = Array.from({ length: 8 }, (_value, index) => ({
    week: index + 1,
    olympicFamily: index === 3 ? "clean" : "snatch",
    olympicExposureMovementIds: [
      index === 3 ? "tall-clean-pulls" : "tall-snatch-pulls",
    ],
  }));
  assert.match(
    generatedProgrammeErrors(longGap, options).join(" "),
    /clean-family exposure is absent for 4 consecutive weeks/,
  );
  assert.deepEqual(
    generatedProgrammeErrors(cleanOnly, options, {
      eligibleOlympicFamilies: ["clean"],
    }),
    [],
  );
  assert.match(
    generatedProgrammeWarnings(cleanOnly, options, {
      eligibleOlympicFamilies: ["clean"],
    }).join(" "),
    /intentionally relaxed/,
  );
  assert.deepEqual(
    generatedProgrammeErrors(cleanOnly, { ...options, weakness: "rowing" }),
    [],
  );
});

test("two-day readiness and frequency changes preserve canonical history", () => {
  const profile = cloneDefaultProfile();
  const fourDay = buildGeneratedProgramme(
    { goal: "balanced", daysPerWeek: 4, weakness: "pulling", duration: 60 },
    profile,
    (id) => id,
    "frequency-seed",
  );
  const completed = fourDay.find(
    (session) => session.week === 2 && /D1:/.test(session.title),
  );
  const plan = {
    id: "active-plan",
    title: "Balanced programme",
    kind: "generated",
    generatorOptions: {
      goal: "balanced",
      daysPerWeek: 4,
      weakness: "pulling",
      duration: 60,
    },
    generationSeed: "frequency-seed",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    sessions: fourDay,
  };
  const nextPlan = regeneratePlanFrequency({
    plan,
    options: {
      ...plan.generatorOptions,
      programDaysPerWeek: 2,
      sessionDuration: 75,
      usesBoxProgramming: true,
      expectedBoxDays: 2,
      preferredProgramDays: ["tuesday", "saturday"],
    },
    profile,
    selectedWeek: 2,
    logs: [
      {
        id: "completed-log",
        week: 2,
        dayId: completed.id,
        workoutSource: "app",
      },
    ],
    idFactory: (id) => id,
  });
  assert.equal(
    nextPlan.sessions.find((session) => session.id === completed.id),
    completed,
  );
  assert.equal(
    nextPlan.sessions.filter((session) => session.week === 2).length,
    2,
  );
  assert.equal(
    nextPlan.sessions.filter((session) => session.week === 3).length,
    2,
  );

  const progress = weeklyTrainingProgress(
    nextPlan,
    [
      {
        id: "completed-log",
        week: 2,
        dayId: completed.id,
        workoutSource: "app",
      },
      { id: "box-log", week: 2, dayId: "box-1", workoutSource: "box" },
    ],
    2,
  );
  assert.equal(progress.completedProgramWorkouts, 1);
  assert.equal(progress.completedBoxWorkouts, 1);
  assert.equal(progress.totalCompleted, 2);
  assert.equal(progress.progressionComplete, false);

  const low = applyReadinessVariant(
    nextPlan.sessions.find((session) => session.twoDayStrategy),
    "low",
  );
  assert.equal(low.runtimeVolumeMultiplier, 0.75);
  assert.equal(
    nextPlan.sessions.find((session) => session.twoDayStrategy)
      .runtimeVolumeMultiplier,
    undefined,
  );
});

test("weekly progress counts custom sessions by source and de-duplicates programme logs", () => {
  const customPlan = {
    id: "custom-plan",
    kind: "custom",
    sessions: [{ id: "custom-day", week: 1 }],
  };
  const customProgress = weeklyTrainingProgress(
    customPlan,
    [
      {
        id: "custom-log",
        week: 1,
        dayId: "custom-day",
        workoutSource: "custom",
      },
    ],
    1,
  );
  assert.equal(customProgress.completedProgramWorkouts, 1);
  assert.equal(customProgress.totalCompleted, 1);
  assert.equal(customProgress.totalTarget, 1);
  assert.equal(customProgress.progressionComplete, true);

  const generatedPlan = {
    id: "generated-plan",
    kind: "generated",
    generatorOptions: { programDaysPerWeek: 2 },
    sessions: [
      { id: "day-one", week: 1 },
      { id: "day-two", week: 1 },
    ],
  };
  const duplicateProgress = weeklyTrainingProgress(
    generatedPlan,
    [
      { id: "first", week: 1, dayId: "day-one", workoutSource: "app" },
      { id: "retry", week: 1, dayId: "day-one", workoutSource: "app" },
    ],
    1,
  );
  assert.equal(duplicateProgress.completedProgramWorkouts, 1);
  assert.equal(duplicateProgress.totalCompleted, 1);
  assert.equal(duplicateProgress.progressionComplete, false);
});

test("generator options derive total training days from app and box frequency", () => {
  assert.deepEqual(
    normalizeGeneratorOptions({
      programDaysPerWeek: 2,
      usesBoxProgramming: false,
      expectedBoxDays: 5,
      totalTrainingDays: 7,
    }).totalTrainingDays,
    2,
  );
  assert.deepEqual(
    normalizeGeneratorOptions({
      programDaysPerWeek: 2,
      usesBoxProgramming: true,
      expectedBoxDays: 2,
      totalTrainingDays: 6,
    }).totalTrainingDays,
    4,
  );
});

test("two-day generation respects minimal equipment and restricted barbell dropping", () => {
  const availableEquipment = ["barbell", "rack", "pullupBar"];
  const sessions = buildGeneratedProgramme(
    {
      primaryGoal: "endurance",
      secondaryGoal: "olympicLifting",
      programDaysPerWeek: 2,
      weakness: "rowing",
      sessionDuration: 75,
      availableEquipment,
      barbellDropPolicy: "drop_pads_only",
    },
    cloneDefaultProfile(),
    (id) => id,
    "minimal-equipment-no-drop",
  );
  const unavailable =
    /row|bike|run|shuttle|dumbbell|\bDB\b|kettlebell|\bKB\b|box (?:jump|step)|ring/i;
  sessions.forEach((session) => {
    assert.deepEqual(session.availableEquipment, availableEquipment);
    definitionExercises(session.workoutDefinition).forEach((exercise) => {
      assert.doesNotMatch(exercise.movement, unavailable);
      const movement = String(exercise.movement || "");
      const loadedBarbell =
        exercise.load &&
        !/dumbbell|\bDB\b|kettlebell|\bKB\b|sandbag/i.test(movement) &&
        /clean|snatch|deadlift|barbell|front squat|overhead squat|thruster|push press|jerk/i.test(
          movement,
        );
      assert.equal(Boolean(loadedBarbell), false);
    });
  });
  for (let week = 1; week <= 8; week += 1) {
    assert.deepEqual(
      validateWeeklyPlan(
        sessions.filter((session) => session.week === week),
        {
          requiredTimeDomains: ["short", "long"],
          requireTwoDayStructure: true,
        },
      ).errors,
      [],
    );
  }
});

test("generated weeks satisfy short, medium, and long time domains", () => {
  const sessions = buildGeneratedProgramme(
    {
      goal: "endurance",
      daysPerWeek: 5,
      weakness: "rowing",
      duration: 60,
      athleteLevel: "intermediate",
    },
    cloneDefaultProfile(),
    (id) => id,
    "time-domain-distribution",
  );

  for (let week = 1; week <= 8; week += 1) {
    const weekSessions = sessions.filter((session) => session.week === week);
    const represented = new Set(
      weekSessions.map((session) => session.workoutDefinition.timeDomain),
    );

    assert.doesNotThrow(() => validateGeneratedWeek(weekSessions));
    assert.ok(represented.has("short"));
    assert.ok(represented.has("medium"));
    assert.ok(represented.has("long"));
    assert.ok(represented.has("extraLong"));
    weekSessions
      .filter((session) =>
        ["long", "extraLong"].includes(session.workoutDefinition.timeDomain),
      )
      .forEach((session) => {
        assert.ok(
          workoutExpectedDurationSeconds(session.workoutDefinition) >= 20 * 60,
        );
      });

    const amrapDurations = weekSessions
      .filter((session) => session.workoutDefinition.format.type === "amrap")
      .map((session) => session.workoutDefinition.format.durationSeconds);
    assert.equal(new Set(amrapDurations).size, amrapDurations.length);
  }
});

test("a generated long AMRAP can never fall back to 12 minutes", () => {
  const sessions = buildGeneratedProgramme(
    {
      goal: "balanced",
      daysPerWeek: 4,
      weakness: "pulling",
      duration: 60,
    },
    cloneDefaultProfile(),
    (id) => id,
  );
  const longAmraps = sessions.filter(
    (session) =>
      session.workoutDefinition.timeDomain === "long" &&
      session.workoutDefinition.format.type === "amrap",
  );

  assert.ok(longAmraps.length > 0);
  longAmraps.forEach((session) => {
    assert.notEqual(session.workoutDefinition.format.durationSeconds, 12 * 60);
    assert.ok(session.workoutDefinition.format.durationSeconds >= 20 * 60);
  });
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
  assert.ok(
    endurancePlans.some((plan) =>
      plan.workoutDefinition.exercises?.some(
        (exercise) => exercise.movement === "row",
      ),
    ),
  );
  assert.match(JSON.stringify(gymnasticsPlans), /Muscle-up/);
  assert.equal(endurancePlans[0].duration, 60);
  assert.equal(gymnasticsPlans[0].duration, 45);
});

test("bar muscle-up goal creates three level-aware skill exposures per week", () => {
  const profile = cloneDefaultProfile();

  for (const level of ["highPull", "assisted", "singles"]) {
    const plans = buildGeneratedProgramme(
      {
        goal: "barMuscleUp",
        barMuscleUpLevel: level,
        daysPerWeek: 5,
        weakness: "rowing",
        duration: 60,
      },
      profile,
      (id) => `${level}-${id}`,
      `bar-muscle-up-${level}`,
    );

    assert.equal(plans.length, 40);
    assert.ok(
      plans.every(
        (plan) =>
          plan.sourceGoal === "barMuscleUp" &&
          plan.sourceWeakness === "muscleup" &&
          plan.sourceBarMuscleUpLevel === level,
      ),
    );
    assert.ok(
      plans.every(
        (plan) =>
          customPlanSegments(plan).reduce(
            (total, segment) => total + Number(segment.minutes),
            0,
          ) === 60,
      ),
    );

    for (let week = 1; week <= 8; week += 1) {
      const weekPlans = plans.filter((plan) => plan.week === week);
      assert.equal(
        weekPlans.filter((plan) => plan.focus.startsWith("Bar muscle-up focus"))
          .length,
        3,
      );
      assert.ok(
        weekPlans
          .filter((plan) => /\bD(?:4|5):/.test(plan.title))
          .every((plan) => plan.focus.startsWith("Bar muscle-up support day")),
      );
    }

    assert.match(
      JSON.stringify(plans.filter((plan) => plan.week === 4)),
      /Deload rule/,
    );
    assert.match(
      JSON.stringify(plans.filter((plan) => plan.week === 8)),
      /Test:/,
    );

    const workoutDefinitions = JSON.stringify(
      plans.map((plan) => plan.workoutDefinition),
    );
    if (level === "singles") {
      assert.match(workoutDefinitions, /"movement":"bar muscle-ups"/);
      plans.forEach((plan) => {
        const directRepTargets = JSON.stringify(
          plan.workoutDefinition,
        ).matchAll(
          /"movement":"bar muscle-ups","target":\{"type":"reps","value":(\d+)/g,
        );
        for (const match of directRepTargets) {
          assert.ok(Number(match[1]) <= 3);
        }
      });
    } else {
      assert.doesNotMatch(workoutDefinitions, /"movement":"bar muscle-ups"/);
    }
  }
});

test("bar muscle-up generator defaults unknown levels to the high-pull track", () => {
  const plans = buildGeneratedProgramme(
    {
      goal: "barMuscleUp",
      barMuscleUpLevel: "unknown",
      daysPerWeek: 3,
      weakness: "squat",
      duration: 45,
    },
    cloneDefaultProfile(),
    (id) => id,
  );

  assert.equal(plans.length, 24);
  assert.ok(
    plans.every(
      (plan) =>
        plan.sourceBarMuscleUpLevel === "highPull" &&
        plan.sourceWeakness === "muscleup",
    ),
  );
  assert.match(plans[0].focus, /chest-to-bar \/ high pull, no turnover/i);
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
    runningDays.every((plan) => /\brun\b/i.test(wodItems(plan)[0])),
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
    "barMuscleUp",
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
  const workouts = plans.map((plan) => wodItems(plan)[0]).join(" ");

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
    assert.match(wodItems(plan)[1], /Stimulus:/);
    assert.match(wodItems(plan)[2], /Score:/);
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

test("RX readiness uses documented weights and a moderate coverage penalty", () => {
  assert.equal(
    Object.values(RX_CATEGORY_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    100,
  );

  const profile = cloneDefaultProfile();
  profile.benchmarks = {
    ...profile.benchmarks,
    row1k: "",
    row2k: "",
    run5k: "",
    bike10MinCalories: 160,
  };
  const readiness = buildRxReadiness(profile, []);
  const engine = readiness.categories.find(
    (category) => category.id === "engine",
  );
  const weightedScore = Math.round(
    readiness.categories.reduce(
      (sum, category) => sum + category.score * category.weight,
      0,
    ) / 100,
  );

  assert.equal(engine.tested, 1);
  assert.equal(engine.total, 4);
  assert.equal(engine.coverageMultiplier, 0.625);
  assert.equal(engine.score, 63);
  assert.equal(readiness.rxLevel, weightedScore);
  assert.match(engine.explanation, /adjusted to 63% for test coverage/);
});

test("RX Level bands cover every 1-100 boundary", () => {
  assert.deepEqual(
    RX_LEVEL_BANDS.map((band) => [band.min, band.max]),
    [
      [1, 49],
      [50, 69],
      [70, 84],
      [85, 100],
    ],
  );
  assert.equal(rxLevelBand(1).label, "Building");
  assert.equal(rxLevelBand(49).label, "Building");
  assert.equal(rxLevelBand(50).label, "Developing");
  assert.equal(rxLevelBand(69).label, "Developing");
  assert.equal(rxLevelBand(70).label, "RX-ready");
  assert.equal(rxLevelBand(84).label, "RX-ready");
  assert.equal(rxLevelBand(85).label, "QF-ready");
  assert.equal(rxLevelBand(100).label, "QF-ready");
});

test("RX readiness weaknesses and guidance change with profile metrics", () => {
  const profile = cloneDefaultProfile();
  const logs = Array.from({ length: 12 }, (_, index) => ({
    date: daysAgo(index * 2),
    readiness: "green",
    rpe: "7",
    mobilityDone: true,
  }));
  const before = buildRxReadiness(profile, logs);
  const improved = cloneDefaultProfile();
  improved.benchmarks = {
    ...improved.benchmarks,
    pullUps: 25,
    chestToBar: 18,
    t2b: 25,
    barMuscleUp: 8,
    ringMuscleUp: 4,
    strictHspu: 8,
    handstandWalk: 15,
    doubleUnders: 100,
  };
  const after = buildRxReadiness(improved, logs);

  assert.ok(before.weakest.some((category) => category.id === "gymnastics"));
  assert.ok(after.rxLevel > before.rxLevel);
  assert.notDeepEqual(
    after.weakest.map((category) => category.id),
    before.weakest.map((category) => category.id),
  );
  assert.notEqual(after.recommendation, before.recommendation);
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
  assert.match(wodItems(migration.plans[0])[1], /Stimulus:/);
  assert.match(wodItems(migration.plans[0])[2], /Score:/);
  assert.equal(Object.hasOwn(migration.plans[0], "wod"), false);
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
    alpha.map((session) => session.workoutDefinition),
    alphaAgain.map((session) => session.workoutDefinition),
  );
  assert.ok(
    alpha.some(
      (session, index) => wodItems(session)[0] !== wodItems(beta[index])[0],
    ),
    "different seeds must change workout format or movements",
  );
  assert.deepEqual(options, originalOptions);
  assert.deepEqual(profile, originalProfile);
  assert.equal(
    new Set(alpha.map((session) => wodItems(session)[0])).size,
    alpha.length,
  );
  assert.equal(
    new Set(beta.map((session) => wodItems(session)[0])).size,
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
    ).map((session) => structuralWodSignature(session));
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
    new Set(migratedGenerated.map((session) => structuralWodSignature(session)))
      .size,
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

function semanticWorkout(overrides = {}) {
  return {
    schemaVersion: WORKOUT_DEFINITION_VERSION,
    format: { type: "amrap", durationSeconds: 12 * 60 },
    progression: { type: "none" },
    buyIn: [],
    exercises: [
      {
        id: "squats",
        movementId: "air-squats",
        movement: "air squats",
        target: { type: "reps", value: 12 },
      },
    ],
    afterEachRound: [],
    cashOut: [],
    stimulus: "steady movement",
    score: "completed work",
    scaling: "Scale before changing the format.",
    ...overrides,
  };
}

function dumbbellSnatchWorkout({
  athleteLevel = "rxPlus",
  reps = 5,
  loadingIntent = "heavy",
  format = {
    type: "intervals",
    intervalSeconds: 180,
    rounds: 3,
    restRemaining: true,
  },
  timeDomain = "short",
  stimulus = "heavy repeat efforts with planned rest",
  extraExercises = [],
} = {}) {
  const snatches = {
    id: "dumbbell-snatches",
    movementId: "single-arm-dumbbell-snatches",
    movement: "single-arm dumbbell snatches",
    target: { type: "reps", value: reps },
  };
  const definition = semanticWorkout({
    format,
    exercises: [snatches, ...extraExercises],
    athleteLevel,
    loadingIntent,
    timeDomain,
    expectedDurationSeconds:
      format.type === "intervals"
        ? format.intervalSeconds * format.rounds
        : format.durationSeconds,
    stimulus,
  });
  return { definition, snatches };
}

test("high-repetition conditioning lowers dumbbell snatches below 35 kg", () => {
  const { definition, snatches } = dumbbellSnatchWorkout({
    reps: 15,
    format: { type: "amrap", durationSeconds: 24 * 60 },
    timeDomain: "long",
    loadingIntent: "conditioning",
    stimulus: "continuous movement with quick transitions",
    extraExercises: [
      {
        id: "pull-ups",
        movementId: "pull-ups",
        movement: "pull-ups",
        target: { type: "reps", value: 12 },
      },
    ],
  });

  const load = selectDumbbellSnatchLoad(definition, snatches);
  assert.ok(load >= 12.5 && load <= 22.5);
  assert.notEqual(load, 35);
});

test("35 kg dumbbell snatches require explicit heavy low-volume RX+ work", () => {
  assert.equal(ATHLETE_LEVELS.rxPlus, "RX+");
  const heavy = dumbbellSnatchWorkout();
  assert.equal(selectDumbbellSnatchLoad(heavy.definition, heavy.snatches), 35);

  const notAdvanced = dumbbellSnatchWorkout({ athleteLevel: "intermediate" });
  assert.notEqual(
    selectDumbbellSnatchLoad(notAdvanced.definition, notAdvanced.snatches),
    35,
  );
  const notHeavy = dumbbellSnatchWorkout({ loadingIntent: "conditioning" });
  assert.notEqual(
    selectDumbbellSnatchLoad(notHeavy.definition, notHeavy.snatches),
    35,
  );
  const tooMuchVolume = dumbbellSnatchWorkout({ reps: 12 });
  assert.notEqual(
    selectDumbbellSnatchLoad(tooMuchVolume.definition, tooMuchVolume.snatches),
    35,
  );
});

test("weekly validation rejects repeated AMRAP durations", () => {
  const sessions = buildGeneratedProgramme(
    { goal: "balanced", daysPerWeek: 4, duration: 60 },
    cloneDefaultProfile(),
    (id) => id,
  ).filter((session) => session.week === 1);
  const amraps = sessions.filter(
    (session) => session.workoutDefinition.format.type === "amrap",
  );
  assert.ok(amraps.length >= 2);

  const invalid = structuredClone(sessions);
  const invalidAmraps = invalid.filter(
    (session) => session.workoutDefinition.format.type === "amrap",
  );
  invalidAmraps[1].workoutDefinition.format.durationSeconds =
    invalidAmraps[0].workoutDefinition.format.durationSeconds;
  invalidAmraps[1].workoutDefinition.expectedDurationSeconds =
    invalidAmraps[0].workoutDefinition.format.durationSeconds;
  invalidAmraps[1].workoutDefinition.timeDomain =
    invalidAmraps[0].workoutDefinition.timeDomain;
  invalidAmraps[1].segmentMinutes.wod =
    invalidAmraps[0].workoutDefinition.format.durationSeconds / 60;

  assert.ok(
    generatedWeekErrors(invalid).some((error) =>
      /repeats a .*minute AMRAP/.test(error),
    ),
  );
});

function progressiveCouplet(progression) {
  return semanticWorkout({
    progression: {
      ...progression,
      appliesTo: ["cleans", "burpees"],
    },
    exercises: [
      {
        id: "cleans",
        movementId: "power-cleans",
        movement: "power cleans",
        target: { type: "progressive_reps" },
        load: { display: "45 kg" },
      },
      {
        id: "burpees",
        movementId: "burpees",
        movement: "burpees",
        target: { type: "progressive_reps" },
      },
    ],
  });
}

test("semantic workout validator accepts every supported progression and format", () => {
  const validDefinitions = [
    progressiveCouplet({ type: "ascending_ladder", start: 2, increment: 2 }),
    progressiveCouplet({
      type: "descending_ladder",
      start: 10,
      decrement: 2,
      end: 2,
    }),
    progressiveCouplet({
      type: "pyramid",
      start: 2,
      increment: 2,
      peak: 10,
      decrement: 2,
      end: 2,
    }),
    progressiveCouplet({
      type: "build_up",
      start: 40,
      increment: 5,
      rounds: 5,
    }),
    semanticWorkout({
      format: { type: "fixed_rounds", rounds: 5, durationSeconds: 15 * 60 },
    }),
    semanticWorkout(),
    semanticWorkout({
      format: {
        type: "emom",
        rounds: 5,
        intervalSeconds: 60,
        stations: [
          {
            type: "work",
            exercises: [
              {
                id: "row",
                movementId: "row",
                movement: "row",
                target: { type: "calories", value: 12 },
              },
            ],
          },
          { type: "rest" },
        ],
      },
      exercises: [],
    }),
    semanticWorkout({ format: { type: "chipper", durationSeconds: 20 * 60 } }),
    semanticWorkout({
      format: { type: "for_time", durationSeconds: 15 * 60 },
      buyIn: [
        {
          id: "buy-in",
          movementId: "row",
          movement: "row",
          target: { type: "distance_m", value: 500 },
        },
      ],
      cashOut: [
        {
          id: "cash-out",
          movementId: "run",
          movement: "run",
          target: { type: "distance_m", value: 400 },
        },
      ],
    }),
    {
      ...progressiveCouplet({
        type: "ascending_ladder",
        start: 2,
        increment: 2,
      }),
      afterEachRound: [
        {
          id: "row",
          movementId: "row",
          movement: "row",
          target: { type: "distance_m", value: 150 },
        },
      ],
    },
  ];

  validDefinitions.forEach((definition) => {
    assert.equal(validateWorkoutDefinition(definition), definition);
    assert.equal(workoutDefinitionErrors(definition).length, 0);
    assert.ok(renderWorkoutDescription(definition).length > 0);
  });
});

test("semantic workout validator rejects contradictory and incomplete structures", () => {
  const validLadder = progressiveCouplet({
    type: "ascending_ladder",
    start: 2,
    increment: 2,
  });
  const invalidDefinitions = [
    {
      ...validLadder,
      exercises: validLadder.exercises.map((exercise) => ({
        ...exercise,
        target: { type: "reps", value: exercise.id === "cleans" ? 5 : 8 },
      })),
    },
    {
      ...validLadder,
      progression: { ...validLadder.progression, appliesTo: ["missing"] },
    },
    progressiveCouplet({ type: "ascending_ladder", start: 0, increment: 2 }),
    progressiveCouplet({
      type: "descending_ladder",
      start: 10,
      decrement: 3,
      end: 2,
    }),
    progressiveCouplet({
      type: "pyramid",
      start: 2,
      increment: 3,
      peak: 10,
      decrement: 2,
      end: 2,
    }),
    {
      ...validLadder,
      format: { type: "fixed_rounds", rounds: 3 },
    },
    semanticWorkout({
      format: { type: "chipper", durationSeconds: 15 * 60 },
      afterEachRound: [
        {
          id: "row",
          movement: "row",
          target: { type: "distance_m", value: 150 },
        },
      ],
    }),
    {
      ...validLadder,
      afterEachRound: [
        {
          id: "row",
          movement: "row",
          target: { type: "progressive_reps" },
        },
      ],
    },
    semanticWorkout({
      format: { type: "emom", rounds: 10, intervalSeconds: 60, stations: [] },
      exercises: [],
    }),
    semanticWorkout({
      exercises: [
        {
          id: "duplicate",
          movement: "row",
          target: { type: "distance_m", value: 100 },
        },
        {
          id: "duplicate",
          movement: "burpees",
          target: { type: "reps", value: 10 },
        },
      ],
    }),
  ];

  invalidDefinitions.forEach((definition) => {
    assert.ok(workoutDefinitionErrors(definition).length > 0);
    assert.throws(
      () => validateWorkoutDefinition(definition),
      /Invalid workout/,
    );
  });
});

test("generated Olympic prescriptions resolve one coherent family", () => {
  const cleanSessions = buildGeneratedProgramme(
    { goal: "stronger", weakness: "olympic", daysPerWeek: 4, duration: 60 },
    cloneDefaultProfile(),
    (id) => id,
    "clean-coherence-regression",
  );
  const snatchSessions = buildGeneratedProgramme(
    { goal: "gymnastics", weakness: "olympic", daysPerWeek: 4, duration: 60 },
    cloneDefaultProfile(),
    (id) => id,
    "snatch-coherence-regression",
  );
  const sessions = [...cleanSessions, ...snatchSessions];

  assert.ok(
    sessions.some((session) =>
      session.strength.some((item) =>
        /3 tall clean pulls \+ 20-second front-rack hold/.test(item),
      ),
    ),
  );
  assert.ok(
    sessions.some((session) =>
      session.strength.some((item) =>
        /3 tall snatch pulls \+ 20-second overhead hold/.test(item),
      ),
    ),
  );
  sessions.forEach((session) => {
    assert.deepEqual(generatedSessionErrors(session), []);
    assert.doesNotMatch(
      [...session.strength, ...workoutItemsForSession(session)].join(" "),
      /tall clean\/snatch pulls|overhead or front rack holds/i,
    );
  });
});

test("movement semantics reject drills, alternatives, and accidental WOD duplicates", () => {
  const drill = semanticWorkout({
    format: { type: "for_time", durationSeconds: 10 * 60 },
    exercises: [
      {
        id: "clean-drill",
        movementId: "hang-power-clean-drill",
        movement: "hang power clean drills",
        target: { type: "reps", value: 10 },
      },
    ],
  });
  assert.match(
    workoutDefinitionErrors(drill).join(" "),
    /not valid for conditioning/,
  );

  const ambiguous = semanticWorkout({
    exercises: [
      {
        id: "choice",
        movementId: "row-or-bike",
        movement: "row or bike",
        target: { type: "calories", value: 10 },
      },
    ],
  });
  assert.match(
    workoutDefinitionErrors(ambiguous).join(" "),
    /unresolved movement alternative/,
  );

  const duplicate = semanticWorkout({
    format: { type: "chipper", durationSeconds: 15 * 60 },
    exercises: [
      {
        id: "squats-40",
        movementId: "air-squats",
        movement: "air squats",
        target: { type: "reps", value: 40 },
      },
      {
        id: "squats-30",
        movementId: "air-squats",
        movement: "air squats",
        target: { type: "reps", value: 30 },
      },
    ],
  });
  assert.match(workoutDefinitionErrors(duplicate).join(" "), /duplicated/);

  const scalingAlternative = semanticWorkout({
    scaling: "Scaling: use ring rows or banded pull-ups.",
  });
  assert.deepEqual(workoutDefinitionErrors(scalingAlternative), []);

  const legacyCustomMovement = semanticWorkout({
    exercises: [
      {
        id: "custom-crawl",
        movementId: "custom-crawl",
        movement: "custom crawl",
        target: { type: "reps", value: 10 },
      },
    ],
  });
  assert.deepEqual(workoutDefinitionErrors(legacyCustomMovement), []);
  assert.match(
    generatedSessionErrors({
      workoutDefinition: legacyCustomMovement,
      warmup: [],
      strength: [],
    }).join(" "),
    /generated movement is not registered: custom-crawl/,
  );

  const mixedOlympicFamily = semanticWorkout({
    olympicFamily: "clean",
    exercises: [
      {
        id: "snatch-pulls",
        movementId: "snatch-pulls",
        movement: "snatch pulls",
        target: { type: "reps", value: 5 },
      },
    ],
  });
  assert.match(
    workoutDefinitionErrors(mixedOlympicFamily).join(" "),
    /incompatible with the clean family/,
  );

  const intentionalStructuralRepeat = semanticWorkout({
    format: { type: "chipper", durationSeconds: 15 * 60 },
    buyIn: [
      {
        id: "buy-in-squats",
        movementId: "air-squats",
        movement: "air squats",
        target: { type: "reps", value: 20 },
      },
    ],
    exercises: [
      {
        id: "main-squats",
        movementId: "air-squats",
        movement: "air squats",
        target: { type: "reps", value: 30 },
      },
    ],
    cashOut: [
      {
        id: "cash-out-squats",
        movementId: "air-squats",
        movement: "air squats",
        target: { type: "reps", value: 40 },
      },
    ],
  });
  assert.deepEqual(workoutDefinitionErrors(intentionalStructuralRepeat), []);
});

test("Olympic WOD weakness work is executable and loaded", () => {
  const sessions = buildGeneratedProgramme(
    { goal: "balanced", weakness: "olympic", daysPerWeek: 4, duration: 60 },
    cloneDefaultProfile(),
    (id) => id,
    "olympic-wod-regression",
  );
  const olympicWeaknessExercises = sessions.flatMap((session) =>
    definitionExercises(session.workoutDefinition).filter((exercise) =>
      /hang power (?:cleans|snatches)/i.test(exercise.movement),
    ),
  );

  assert.ok(olympicWeaknessExercises.length > 0);
  olympicWeaknessExercises.forEach((exercise) => {
    assert.equal(exercise.target.type, "reps");
    assert.match(exercise.load.display, /^\d+(?:\.\d+)? kg$/);
    assert.doesNotMatch(exercise.movement, /drill/i);
  });
});

test("generated chippers combine consecutive duplicate air squats", () => {
  const sessions = buildGeneratedProgramme(
    { goal: "endurance", weakness: "squat", daysPerWeek: 4, duration: 60 },
    cloneDefaultProfile(),
    (id) => id,
    "dup-0",
  );
  const combinedChipper = sessions
    .filter((session) => session.workoutDefinition.format.type === "chipper")
    .find((session) =>
      session.workoutDefinition.exercises.some(
        (exercise) =>
          exercise.movementId === "air-squats" &&
          exercise.target.type === "reps" &&
          exercise.target.value === 70,
      ),
    );

  assert.ok(combinedChipper);
  assert.equal(
    combinedChipper.workoutDefinition.exercises.filter(
      (exercise) => exercise.movementId === "air-squats",
    ).length,
    1,
  );
  assert.doesNotMatch(
    renderWorkoutDescription(combinedChipper.workoutDefinition),
    /40 air squats.*30 air squats/i,
  );
});

test("ladders render deterministically from explicit exercise assignments", () => {
  const definition = {
    ...progressiveCouplet({ type: "ascending_ladder", start: 2, increment: 2 }),
    format: { type: "amrap", durationSeconds: 23 * 60 },
    afterEachRound: [
      {
        id: "row",
        movementId: "row",
        movement: "row",
        target: { type: "distance_m", value: 150 },
      },
    ],
  };
  const rendered = renderWorkoutDescription(definition);

  assert.equal(
    rendered,
    "23 min ascending ladder: 2-4-6-8... power cleans at 45 kg and burpees; after each round complete 150 m row",
  );
  assert.doesNotMatch(rendered, /\.\.\.\s+5 power cleans|and 8 burpees/);
  assert.equal(renderWorkoutDescription(structuredClone(definition)), rendered);
  assert.deepEqual(
    {
      mode: inferWorkoutTimer({ workoutDefinition: definition }).mode,
      plannedSeconds: inferWorkoutTimer({ workoutDefinition: definition })
        .plannedSeconds,
    },
    { mode: "amrap", plannedSeconds: 23 * 60 },
  );
});

test("generation retries invalid candidates and rejects exhausted output", () => {
  const valid = semanticWorkout();
  let attempts = 0;
  const selected = claimUniqueGeneratedWod(
    () => {
      attempts += 1;
      return attempts === 1
        ? semanticWorkout({ format: { type: "amrap", durationSeconds: 0 } })
        : valid;
    },
    { usedWodSignatures: new Set() },
  );

  assert.equal(selected, valid);
  assert.equal(attempts, 2);
  assert.throws(
    () =>
      claimUniqueGeneratedWod(
        () =>
          semanticWorkout({ format: { type: "amrap", durationSeconds: 0 } }),
        { usedWodSignatures: new Set() },
      ),
    /valid, unique workout/,
  );
});

test("table-driven generation sweep persists only valid structured workouts", () => {
  const goals = [
    "stronger",
    "endurance",
    "gymnastics",
    "barMuscleUp",
    "balanced",
    "mastersRxOpen",
  ];
  const weaknesses = [
    "squat",
    "olympic",
    "rowing",
    "running",
    "runningBodyweight",
    "pulling",
    "muscleup",
    "t2b",
  ];
  const profile = cloneDefaultProfile();

  for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
    const goal = goals[seedIndex % goals.length];
    const weakness = weaknesses[seedIndex % weaknesses.length];
    const daysPerWeek = 3 + (seedIndex % 3);
    const sessions = buildGeneratedProgramme(
      { goal, weakness, daysPerWeek, duration: 60 },
      profile,
      (id) => id,
      `semantic-sweep-${seedIndex}`,
    );
    assert.equal(sessions.length, daysPerWeek * 8);
    sessions.forEach((session) => {
      assert.equal(
        workoutDefinitionErrors(session.workoutDefinition).length,
        0,
      );
      assert.equal(Object.hasOwn(session, "wod"), false);
      assert.doesNotMatch(
        workoutItemsForSession(session)[0],
        /(?:^|[:,;]\s|and\s|min\s+\d+\s+)\d+\s+(?:bike|row|ski)\b/i,
      );
      assert.deepEqual(
        workoutItemsForSession(JSON.parse(JSON.stringify(session))),
        workoutItemsForSession(session),
      );
    });
  }
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
