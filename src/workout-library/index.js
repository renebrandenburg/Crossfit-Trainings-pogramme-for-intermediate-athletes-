/* global module */
"use strict";

(function exposeWorkoutLibrary(globalScope) {
  const CATEGORIES = [
    {
      id: "emom-40",
      name: "40-Minute EMOMs",
      description:
        "Generated four-station EMOMs built around your current profile.",
      icon: "⏱",
      sortOrder: 1,
      generatorType: "emom",
    },
    {
      id: "open",
      name: "CrossFit Open Workouts",
      description: "Searchable Open workouts with RX and scaled standards.",
      icon: "🏋",
      sortOrder: 2,
      generatorType: "catalog",
    },
    {
      id: "benchmarks",
      name: "Benchmark Workouts",
      description: "Classic tests for conditioning, strength, and gymnastics.",
      icon: "🏆",
      sortOrder: 3,
      generatorType: "catalog",
    },
  ];

  const OPEN_WORKOUTS = [
    {
      id: "open-2025-25.1",
      categoryId: "open",
      title: "25.1",
      year: 2025,
      number: "25.1",
      difficulty: "intermediate",
      equipment: ["dumbbell", "pullupBar"],
      movements: [
        "dumbbell hang clean",
        "dumbbell overhead lunge",
        "burpee box jump-over",
      ],
      rx: "15-minute AMRAP: 3 dumbbell hang clean and jerks, 6 dumbbell overhead walking lunges, 9 burpee box jump-overs; add 3 reps each round.",
      scaled:
        "Use a lighter dumbbell, front-rack lunges, and a lower box as needed.",
      standards:
        "Dumbbell must reach the shoulder before each rep; both feet must touch the top of the box.",
    },
    {
      id: "open-2025-25.2",
      categoryId: "open",
      title: "25.2",
      year: 2025,
      number: "25.2",
      difficulty: "intermediate",
      equipment: ["barbell", "pullupBar"],
      movements: ["barbell snatch", "bar-facing burpee"],
      rx: "21-15-9 barbell snatches and bar-facing burpees, with a 15-minute cap.",
      scaled:
        "Use the prescribed scaled loading and step over the bar for burpees.",
      standards:
        "Snatch starts from the floor; chest and thighs contact the floor on each burpee.",
    },
    {
      id: "open-2025-25.3",
      categoryId: "open",
      title: "25.3",
      year: 2025,
      number: "25.3",
      difficulty: "advanced",
      equipment: ["barbell", "pullupBar"],
      movements: [
        "wall walk",
        "clean and jerk",
        "handstand push-up",
        "pull-up",
      ],
      rx: "For time: wall walks, clean and jerks, handstand push-ups, and chest-to-bar pull-ups in the published rep scheme.",
      scaled:
        "Reduce the wall-walk distance, use lighter loading, and substitute a box or regular pull-up variation.",
      standards:
        "Follow the official wall-walk line, lock out the barbell overhead, and meet the division-specific gymnastics standard.",
    },
    {
      id: "open-2024-24.1",
      categoryId: "open",
      title: "24.1",
      year: 2024,
      number: "24.1",
      difficulty: "intermediate",
      equipment: ["dumbbell"],
      movements: ["dumbbell snatch", "burpee"],
      rx: "15-12-9-6-3 dumbbell snatches and lateral burpees over the dumbbell, then repeat ascending.",
      scaled: "Use a lighter dumbbell and step over the dumbbell.",
      standards:
        "Alternate arms on snatches; the burpee requires a two-foot takeoff and landing over the dumbbell.",
    },
    {
      id: "open-2024-24.2",
      categoryId: "open",
      title: "24.2",
      year: 2024,
      number: "24.2",
      difficulty: "intermediate",
      equipment: ["barbell", "rower", "plates"],
      movements: ["row", "deadlift", "double-under"],
      rx: "Every 4 minutes for 20 minutes: 300-meter row, 10 deadlifts, 50 double-unders; add 10 deadlifts and 50 double-unders each round.",
      scaled: "Use single-unders and the published scaled deadlift loading.",
      standards:
        "Complete the row distance and lock out every deadlift before beginning the next movement.",
    },
    {
      id: "open-2024-24.3",
      categoryId: "open",
      title: "24.3",
      year: 2024,
      number: "24.3",
      difficulty: "advanced",
      equipment: ["barbell", "pullupBar"],
      movements: ["thruster", "chest-to-bar pull-up", "bar muscle-up"],
      rx: "For time: two ascending couplets of thrusters and gymnastics pulling with a 15-minute cap.",
      scaled:
        "Use the scaled gymnastics movement and appropriate thruster loading.",
      standards:
        "Meet the division-specific pull-up range of motion and lock out each thruster overhead.",
    },
  ];

  const BENCHMARK_GROUPS = [
    [
      "girls",
      "Girls",
      [
        [
          "fran",
          "Fran",
          "21-15-9 thrusters and pull-ups",
          "time",
          ["barbell", "pullupBar"],
        ],
        ["grace", "Grace", "30 clean and jerks for time", "time", ["barbell"]],
        [
          "diane",
          "Diane",
          "21-15-9 deadlifts and handstand push-ups",
          "time",
          ["barbell"],
        ],
        [
          "helen",
          "Helen",
          "3 rounds: 400-meter run, 21 kettlebell swings, 12 pull-ups",
          "time",
          ["kettlebell", "pullupBar"],
        ],
        ["isabel", "Isabel", "30 snatches for time", "time", ["barbell"]],
        [
          "elizabeth",
          "Elizabeth",
          "21-15-9 cleans and ring dips",
          "time",
          ["barbell", "rings"],
        ],
        [
          "karen",
          "Karen",
          "150 wall-ball shots for time",
          "time",
          ["wallBall"],
        ],
        [
          "jackie",
          "Jackie",
          "1,000-meter row, 50 thrusters, 30 pull-ups",
          "time",
          ["rower", "barbell", "pullupBar"],
        ],
        [
          "nancy",
          "Nancy",
          "5 rounds: 400-meter run, 15 overhead squats",
          "time",
          ["barbell"],
        ],
        [
          "annie",
          "Annie",
          "50-40-30-20-10 double-unders and sit-ups",
          "time",
          ["jumpRope"],
        ],
      ],
    ],
    [
      "strength",
      "Strength",
      [
        [
          "back-squat",
          "Back Squat",
          "Find a heavy single or tested 1RM",
          "load",
          ["barbell", "rack"],
        ],
        [
          "deadlift",
          "Deadlift",
          "Find a heavy single or tested 1RM",
          "load",
          ["barbell"],
        ],
        [
          "front-squat",
          "Front Squat",
          "Find a heavy single or tested 1RM",
          "load",
          ["barbell", "rack"],
        ],
        [
          "snatch",
          "Snatch",
          "Find a heavy single or tested 1RM",
          "load",
          ["barbell"],
        ],
        [
          "clean-and-jerk",
          "Clean & Jerk",
          "Find a heavy single or tested 1RM",
          "load",
          ["barbell"],
        ],
        [
          "press",
          "Press",
          "Find a heavy single or tested 1RM",
          "load",
          ["barbell", "rack"],
        ],
      ],
    ],
    [
      "conditioning",
      "Conditioning",
      [
        ["row-2k", "2k Row", "2,000-meter row for time", "time", ["rower"]],
        ["row-5k", "5k Row", "5,000-meter row for time", "time", ["rower"]],
        ["run-5k", "5k Run", "5,000-meter run for time", "time", []],
        ["run-10k", "10k Run", "10,000-meter run for time", "time", []],
        [
          "assault-bike-10",
          "Assault Bike Test",
          "10-minute assault bike for max calories",
          "calories",
          ["bike"],
        ],
      ],
    ],
    [
      "gymnastics",
      "Gymnastics",
      [
        [
          "max-pull-ups",
          "Max Pull-ups",
          "One unbroken set of strict or kipping pull-ups",
          "reps",
          ["pullupBar"],
        ],
        [
          "max-ring-muscle-ups",
          "Max Ring Muscle-ups",
          "One unbroken set of ring muscle-ups",
          "reps",
          ["rings"],
        ],
        [
          "max-hspu",
          "Max Handstand Push-ups",
          "One unbroken set of handstand push-ups",
          "reps",
          [],
        ],
        [
          "max-t2b",
          "Max Toes-to-Bar",
          "One unbroken set of toes-to-bar",
          "reps",
          ["pullupBar"],
        ],
      ],
    ],
  ];

  const BENCHMARKS = BENCHMARK_GROUPS.flatMap(([groupId, groupName, items]) =>
    items.map(([id, title, description, scoreType, equipment]) => ({
      id: `benchmark-${id}`,
      categoryId: "benchmarks",
      groupId,
      groupName,
      title,
      description,
      scoreType,
      equipment,
      movements: [title.toLowerCase()],
      difficulty: "intermediate",
    })),
  );

  const STATIONS = {
    engine: [
      {
        movement: "row",
        reps: "12 calories",
        equipment: "rower",
        stimulus: "aerobic",
      },
      {
        movement: "burpees",
        reps: "10 reps",
        equipment: null,
        stimulus: "medium_conditioning",
      },
      {
        movement: "run",
        reps: "45 seconds",
        equipment: null,
        stimulus: "aerobic",
      },
      {
        movement: "rest",
        reps: "easy breathing",
        equipment: null,
        stimulus: "aerobic",
      },
    ],
    mixed: [
      {
        movement: "wall balls",
        reps: "12 reps",
        equipment: "wallBall",
        stimulus: "short_conditioning",
      },
      {
        movement: "kettlebell swings",
        reps: "12 reps",
        equipment: "kettlebell",
        stimulus: "hinge",
      },
      {
        movement: "push-ups",
        reps: "10 reps",
        equipment: null,
        stimulus: "horizontal_push",
      },
      {
        movement: "row",
        reps: "10 calories",
        equipment: "rower",
        stimulus: "aerobic",
      },
    ],
    olympic: [
      {
        movement: "power clean",
        reps: "3 reps",
        equipment: "barbell",
        stimulus: "olympic_lifting",
      },
      {
        movement: "hang snatch",
        reps: "3 reps",
        equipment: "barbell",
        stimulus: "olympic_lifting",
      },
      {
        movement: "overhead squat",
        reps: "5 reps",
        equipment: "barbell",
        stimulus: "squat",
      },
      {
        movement: "box jump",
        reps: "8 reps",
        equipment: "box",
        stimulus: "short_conditioning",
      },
    ],
    gymnastics: [
      {
        movement: "toes-to-bar",
        reps: "8 reps",
        equipment: "pullupBar",
        stimulus: "gymnastics",
      },
      {
        movement: "handstand push-ups",
        reps: "6 reps",
        equipment: null,
        stimulus: "gymnastics",
      },
      {
        movement: "pull-ups",
        reps: "6 reps",
        equipment: "pullupBar",
        stimulus: "vertical_pull",
      },
      {
        movement: "hollow rocks",
        reps: "20 reps",
        equipment: null,
        stimulus: "gymnastics",
      },
    ],
    strength_endurance: [
      {
        movement: "front-rack reverse lunges",
        reps: "8 reps",
        equipment: "barbell",
        stimulus: "squat",
      },
      {
        movement: "hand-release push-ups",
        reps: "10 reps",
        equipment: null,
        stimulus: "horizontal_push",
      },
      {
        movement: "deadlift",
        reps: "6 reps",
        equipment: "barbell",
        stimulus: "hinge",
      },
      {
        movement: "bike",
        reps: "12 calories",
        equipment: "bike",
        stimulus: "short_conditioning",
      },
    ],
    open_prep: [
      {
        movement: "burpees",
        reps: "8 reps",
        equipment: null,
        stimulus: "short_conditioning",
      },
      {
        movement: "dumbbell snatch",
        reps: "8 reps",
        equipment: "dumbbell",
        stimulus: "olympic_lifting",
      },
      {
        movement: "double-unders",
        reps: "30 reps",
        equipment: "jumpRope",
        stimulus: "gymnastics",
      },
      {
        movement: "wall walks",
        reps: "3 reps",
        equipment: null,
        stimulus: "gymnastics",
      },
    ],
  };

  function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value))
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  }

  function available(profile) {
    return new Set(
      profile?.availableEquipment || [
        "barbell",
        "rack",
        "pullupBar",
        "rower",
        "kettlebell",
        "dumbbell",
        "jumpRope",
        "wallBall",
        "bike",
        "box",
      ],
    );
  }

  function generateEmom({
    focus = "mixed",
    profile = {},
    seed = "library",
  } = {}) {
    const key = STATIONS[focus] ? focus : "mixed";
    const equipment = available(profile);
    const source = STATIONS[key].filter(
      (station) => !station.equipment || equipment.has(station.equipment),
    );
    const stations =
      source.length >= 4
        ? source
        : STATIONS.mixed.filter(
            (station) => !station.equipment || equipment.has(station.equipment),
          );
    const offset = hashSeed(`${seed}:${key}`) % stations.length;
    const ordered = stations.map(
      (_, index) => stations[(index + offset) % stations.length],
    );
    const title = `40-Minute EMOM · ${key === "open_prep" ? "Open Prep" : key === "strength_endurance" ? "Strength Endurance" : key[0].toUpperCase() + key.slice(1)}`;
    return {
      id: `generated-emom-${hashSeed(`${seed}:${key}`)}`,
      categoryId: "emom-40",
      title,
      type: "generated",
      difficulty: "intermediate",
      durationMinutes: 40,
      seed: String(seed),
      focus: key,
      rounds: 10,
      stations: ordered.map((station, index) => ({
        ...station,
        minute: index + 1,
      })),
      description:
        "Complete one station at the start of each minute. Use the remaining time to recover before the next minute.",
      scoreType: "rounds_reps",
      movements: ordered.map((station) => station.movement),
    };
  }

  function filterCatalog(items, filters = {}) {
    const query = String(filters.query || "")
      .trim()
      .toLowerCase();
    return items.filter(
      (item) =>
        (!filters.year || item.year === Number(filters.year)) &&
        (!filters.number || item.number === filters.number) &&
        (!filters.movement ||
          item.movements?.some((movement) =>
            movement
              .toLowerCase()
              .includes(String(filters.movement).toLowerCase()),
          )) &&
        (!filters.equipment || item.equipment?.includes(filters.equipment)) &&
        (!query ||
          `${item.title} ${item.description || ""} ${(item.movements || []).join(" ")}`
            .toLowerCase()
            .includes(query)),
    );
  }

  const api = Object.freeze({
    BENCHMARKS,
    CATEGORIES,
    OPEN_WORKOUTS,
    generateEmom,
    filterCatalog,
  });
  globalScope.ForgeHourWorkoutLibrary = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
