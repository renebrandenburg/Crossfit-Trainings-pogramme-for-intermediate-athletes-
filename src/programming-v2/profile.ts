import { getMovement } from "./catalog";
import type {
  AthleteSkillLevels,
  GenerateProgramInput,
  MovementFamilyId,
  ProgrammeDomain,
  ProgrammeEmphasis,
  ProgrammeGenerationSummary,
  ProgrammeIdentityValidation,
  ProgrammeProfile,
  ProgramV2,
  ProgressionTrackType,
  StrictPullupLevel,
  TrainingBlockType,
  V2ProgrammingGoal,
} from "./types";
import type {
  MixedStrengthWeekTemplate,
  TemplateProgressionStep,
} from "./template";

const GOAL_EMPHASIS: Record<V2ProgrammingGoal, ProgrammeEmphasis> = {
  strength: {
    strength: 45,
    gymnastics: 15,
    olympic: 10,
    conditioning: 20,
    accessory: 10,
  },
  endurance: {
    strength: 15,
    gymnastics: 10,
    olympic: 5,
    conditioning: 60,
    accessory: 10,
  },
  gymnastics: {
    strength: 15,
    gymnastics: 50,
    olympic: 5,
    conditioning: 20,
    accessory: 10,
  },
  bar_muscle_up: {
    strength: 15,
    gymnastics: 55,
    olympic: 5,
    conditioning: 15,
    accessory: 10,
  },
  competition: {
    strength: 20,
    gymnastics: 20,
    olympic: 20,
    conditioning: 30,
    accessory: 10,
  },
  open: {
    strength: 15,
    gymnastics: 25,
    olympic: 15,
    conditioning: 35,
    accessory: 10,
  },
  masters_open: {
    strength: 15,
    gymnastics: 25,
    olympic: 10,
    conditioning: 35,
    accessory: 15,
  },
  olympic_lifting: {
    strength: 25,
    gymnastics: 5,
    olympic: 50,
    conditioning: 10,
    accessory: 10,
  },
  general_crossfit: {
    strength: 25,
    gymnastics: 20,
    olympic: 15,
    conditioning: 25,
    accessory: 15,
  },
  mixed: {
    strength: 30,
    gymnastics: 20,
    olympic: 20,
    conditioning: 20,
    accessory: 10,
  },
};

const BLOCK_ADJUSTMENTS: Partial<
  Record<TrainingBlockType, Partial<ProgrammeEmphasis>>
> = {
  gymnastics_capacity: {
    strength: -5,
    gymnastics: 20,
    olympic: -10,
    conditioning: -5,
  },
  aerobic_capacity: {
    strength: -10,
    gymnastics: -5,
    olympic: -10,
    conditioning: 25,
  },
  olympic_lifting_development: {
    strength: 5,
    gymnastics: -10,
    olympic: 25,
    conditioning: -15,
  },
  snatch_development: {
    strength: 5,
    gymnastics: -10,
    olympic: 25,
    conditioning: -15,
  },
  clean_and_jerk_development: {
    strength: 5,
    gymnastics: -10,
    olympic: 25,
    conditioning: -15,
  },
  front_squat_accumulation: {
    strength: 20,
    gymnastics: -5,
    olympic: -5,
    conditioning: -10,
  },
  back_squat_strength: {
    strength: 20,
    gymnastics: -5,
    olympic: -5,
    conditioning: -10,
  },
  competition_preparation: { conditioning: 10, accessory: -5 },
  open_preparation: {
    gymnastics: 10,
    olympic: 5,
    conditioning: 10,
    strength: -10,
  },
  masters_open_preparation: {
    gymnastics: 10,
    conditioning: 10,
    strength: -10,
  },
};

const PHASES: Record<ProgrammeDomain, string[]> = {
  strength: [
    "baseline and movement quality",
    "volume accumulation",
    "volume progression",
    "loading progression",
    "intensity development",
    "heavy submaximal work",
    "taper and opener preparation",
    "strength retest",
  ],
  gymnastics: [
    "baseline and technique",
    "volume accumulation",
    "volume progression",
    "density progression",
    "harder variations",
    "gymnastics under fatigue",
    "peak specific preparation",
    "gymnastics retest",
  ],
  olympic: [
    "positional baseline",
    "technical volume",
    "pulling and receiving positions",
    "complex progression",
    "competition-lift intensity",
    "heavy technical singles",
    "taper and opener preparation",
    "Olympic-lift retest",
  ],
  conditioning: [
    "aerobic baseline",
    "sustainable volume",
    "threshold development",
    "interval density",
    "mixed-modal repeatability",
    "race-pace rehearsal",
    "reduced-volume sharpening",
    "engine retest",
  ],
  accessory: [
    "movement-quality baseline",
    "balanced accumulation",
    "balanced progression",
    "work-capacity density",
    "specific intensity",
    "mixed-modal integration",
    "consolidation",
    "balanced retest",
  ],
};

const STRICT_STRENGTH_PHASES = [
  "foundation and strict movement quality",
  "foundation volume and scapular control",
  "strict strength volume",
  "volume progression",
  "weighted intensification",
  "heavy strict strength",
  "peak strength with reduced accessory volume",
  "pulling and pressing benchmarks",
];

const GOAL_DOMAIN: Record<V2ProgrammingGoal, ProgrammeDomain> = {
  strength: "strength",
  endurance: "conditioning",
  gymnastics: "gymnastics",
  bar_muscle_up: "gymnastics",
  competition: "conditioning",
  open: "conditioning",
  masters_open: "conditioning",
  olympic_lifting: "olympic",
  general_crossfit: "accessory",
  mixed: "accessory",
};

function blockFocus(
  blockType: TrainingBlockType,
  goal: V2ProgrammingGoal,
): ProgrammeDomain {
  if (blockType === "gymnastics_capacity") return "gymnastics";
  if (blockType === "aerobic_capacity") return "conditioning";
  if (
    [
      "competition_preparation",
      "open_preparation",
      "masters_open_preparation",
    ].includes(blockType)
  ) {
    return "conditioning";
  }
  if (
    [
      "olympic_lifting_development",
      "snatch_development",
      "clean_and_jerk_development",
    ].includes(blockType)
  ) {
    return "olympic";
  }
  if (
    [
      "front_squat_accumulation",
      "back_squat_strength",
      "mixed_strength",
    ].includes(blockType) &&
    goal === "strength"
  ) {
    return "strength";
  }
  return GOAL_DOMAIN[goal];
}

function normalizedEmphasis(
  goal: V2ProgrammingGoal,
  blockType: TrainingBlockType,
): ProgrammeEmphasis {
  const base = GOAL_EMPHASIS[goal];
  const adjustment = BLOCK_ADJUSTMENTS[blockType] ?? {};
  const values = Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      Math.max(5, value + (adjustment[key as keyof ProgrammeEmphasis] ?? 0)),
    ]),
  ) as unknown as ProgrammeEmphasis;
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const entries = Object.entries(values).map(([key, value]) => [
    key,
    Math.round((value / total) * 100),
  ]);
  const normalized = Object.fromEntries(
    entries,
  ) as unknown as ProgrammeEmphasis;
  normalized.conditioning +=
    100 - Object.values(normalized).reduce((sum, value) => sum + value, 0);
  return normalized;
}

export function normalizeAthleteSkills(
  value: Partial<AthleteSkillLevels> | null | undefined,
): AthleteSkillLevels {
  const number = (candidate: unknown): number =>
    Math.max(0, Number.isFinite(Number(candidate)) ? Number(candidate) : 0);
  return {
    pullUps: number(value?.pullUps),
    chestToBar: number(value?.chestToBar),
    toesToBar: number(value?.toesToBar),
    barMuscleUps: number(value?.barMuscleUps),
    strictHspu: number(value?.strictHspu),
    ringDips: number(value?.ringDips),
    handstandWalkMeters: number(value?.handstandWalkMeters),
  };
}

export function strictPullupLevel(
  input: GenerateProgramInput,
): StrictPullupLevel {
  const pullUps = normalizeAthleteSkills(input.skills).pullUps;
  if (pullUps <= 3) return "developing";
  if (pullUps < 12) return "bodyweight";
  return "weighted";
}

function gymnasticsPullingMovement(
  input: GenerateProgramInput,
  weekNumber: number,
): string {
  const skills = normalizeAthleteSkills(input.skills);
  if (
    input.athleteLevel !== "beginner" &&
    skills.barMuscleUps > 0 &&
    weekNumber >= 5
  ) {
    return "bar_muscle_up";
  }
  if (skills.chestToBar >= 5 && weekNumber >= 4) {
    return "chest_to_bar_pull_up";
  }
  return "strict_pull_up";
}

function gymnasticsMidlineMovement(input: GenerateProgramInput): string {
  return normalizeAthleteSkills(input.skills).toesToBar >= 3
    ? "toes_to_bar"
    : "hanging_knee_raise";
}

function handstandMovement(
  input: GenerateProgramInput,
  weekNumber: number,
): string {
  const skills = normalizeAthleteSkills(input.skills);
  if (skills.strictHspu > 0 && weekNumber >= 4) {
    return "strict_handstand_push_up";
  }
  return "pike_handstand_push_up";
}

function priorities(focus: ProgrammeDomain): MovementFamilyId[] {
  if (focus === "gymnastics") {
    return ["strict_pull", "toes_to_bar", "handstand", "core"];
  }
  if (focus === "olympic") {
    return ["snatch", "clean_and_jerk", "front_squat", "back_squat"];
  }
  if (focus === "strength") {
    return ["back_squat", "hinge", "vertical_press", "strict_pull"];
  }
  if (focus === "conditioning") {
    return ["running", "rowing", "bike", "ski", "burpee"];
  }
  return [
    "back_squat",
    "hinge",
    "vertical_press",
    "strict_pull",
    "snatch",
    "clean_and_jerk",
    "carry",
  ];
}

function exposureTargets(
  focus: ProgrammeDomain,
): ProgrammeProfile["movementExposureTargets"] {
  if (focus === "gymnastics") {
    return {
      toes_to_bar: { minimum: 8, maximum: 16 },
      handstand: { minimum: 8, maximum: 16 },
      core: { minimum: 4, maximum: 16 },
    };
  }
  if (focus === "olympic") {
    return {
      snatch: { minimum: 8, maximum: 16 },
      clean_and_jerk: { minimum: 8, maximum: 16 },
      front_squat: { minimum: 4, maximum: 12 },
      back_squat: { minimum: 4, maximum: 12 },
    };
  }
  if (focus === "strength") {
    return {
      back_squat: { minimum: 8, maximum: 16 },
      hinge: { minimum: 8, maximum: 16 },
      vertical_press: { minimum: 8, maximum: 16 },
      strict_pull: { minimum: 8, maximum: 16 },
    };
  }
  if (focus === "conditioning") return {};
  return {};
}

function movementLimits(
  focus: ProgrammeDomain,
): ProgrammeProfile["movementLimits"] {
  if (focus === "gymnastics") {
    return { front_squat: 3, back_squat: 3, snatch: 2, clean_and_jerk: 2 };
  }
  if (focus === "conditioning") {
    return { front_squat: 4, back_squat: 4, snatch: 2, clean_and_jerk: 2 };
  }
  if (focus === "strength") return { snatch: 2, clean_and_jerk: 2 };
  return {};
}

export function createProgrammeProfile(
  input: GenerateProgramInput,
  fallbackBlockType: TrainingBlockType,
): ProgrammeProfile {
  const strictStrength = input.templateId === "strict_strength_8w";
  const primaryGoal = strictStrength ? "strength" : (input.goal ?? "mixed");
  const trainingBlock = strictStrength
    ? "mixed_strength"
    : (input.blockType ?? fallbackBlockType);
  const focus = blockFocus(trainingBlock, primaryGoal);
  const emphasis = normalizedEmphasis(primaryGoal, trainingBlock);
  const skills = normalizeAthleteSkills(input.skills);
  const gymnasticsTest =
    skills.barMuscleUps > 0 && input.athleteLevel !== "beginner"
      ? "bar_muscle_up"
      : skills.chestToBar >= 5
        ? "chest_to_bar_pull_up"
        : "strict_pull_up";
  const openProfile =
    ["open", "masters_open"].includes(primaryGoal) ||
    ["open_preparation", "masters_open_preparation"].includes(trainingBlock);
  const testingTargets = strictStrength
    ? [
        strictPullupLevel(input) === "weighted"
          ? "weighted_pull_up"
          : "strict_pull_up",
        "strict_press",
      ]
    : openProfile
      ? [gymnasticsTest, gymnasticsMidlineMovement(input)]
      : focus === "gymnastics"
        ? [gymnasticsTest, handstandMovement(input, 8)]
        : focus === "olympic"
          ? ["snatch", "clean_and_jerk"]
          : focus === "strength"
            ? ["back_squat", "strict_press"]
            : focus === "conditioning"
              ? ["row", "bike"]
              : ["back_squat", gymnasticsTest];
  const conditioningStyle = openProfile
    ? "open"
    : primaryGoal === "competition" ||
        trainingBlock === "competition_preparation"
      ? "competition"
      : focus === "conditioning"
        ? "engine"
        : "general";
  return {
    primaryGoal,
    secondaryGoals:
      focus === GOAL_DOMAIN[primaryGoal]
        ? []
        : [
            focus === "gymnastics"
              ? "gymnastics"
              : focus === "olympic"
                ? "olympic_lifting"
                : focus === "conditioning"
                  ? "endurance"
                  : "strength",
          ],
    trainingBlock,
    focus,
    movementPriorities: strictStrength
      ? [
          "strict_pull",
          "vertical_press",
          "handstand",
          "horizontal_press",
          "core",
        ]
      : priorities(focus),
    strengthPriority: emphasis.strength,
    gymnasticsPriority: emphasis.gymnastics,
    olympicPriority: emphasis.olympic,
    enginePriority: emphasis.conditioning,
    skillPriority: Math.max(emphasis.gymnastics, emphasis.olympic),
    conditioningPriority: emphasis.conditioning,
    testingTargets,
    movementExposureTargets: strictStrength
      ? {
          strict_pull: { minimum: 16, maximum: 16 },
          vertical_press: { minimum: 8, maximum: 8 },
          handstand: { minimum: 8, maximum: 8 },
          horizontal_press: { minimum: 8, maximum: 8 },
        }
      : exposureTargets(focus),
    movementLimits: strictStrength
      ? { kipping_pull: 0, toes_to_bar: 0, bar_muscle_up: 0 }
      : movementLimits(focus),
    progressionPhases: strictStrength
      ? [...STRICT_STRENGTH_PHASES]
      : [...PHASES[focus]],
    conditioningStyle,
  };
}

function progressionStep(
  weekNumber: number,
  sessionNumber: 1 | 2,
  role: "primary" | "secondary",
  trackType: ProgressionTrackType,
  movementFamilyId: MovementFamilyId,
  movementId: string,
  options: {
    sets?: number;
    reps?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
    durationSeconds?: number | null;
    intensityMethod?: TemplateProgressionStep["intensityMethod"];
    intensityMin?: number | null;
    intensityMax?: number | null;
    restSeconds?: number;
    intent: string;
    objective: string;
    stoppingRule?: string | null;
    minutes?: number;
  },
): TemplateProgressionStep {
  return {
    weekNumber,
    sessionNumber,
    role,
    trackType,
    movementFamilyId,
    movementId,
    sets: options.sets ?? 4,
    reps: options.reps ?? null,
    repRangeMin: options.repRangeMin ?? null,
    repRangeMax: options.repRangeMax ?? null,
    durationSeconds: options.durationSeconds ?? null,
    intensityMethod: options.intensityMethod ?? "bodyweight",
    intensityMin: options.intensityMin ?? null,
    intensityMax: options.intensityMax ?? null,
    restSeconds: options.restSeconds ?? 75,
    technicalIntent: options.intent,
    progressionObjective: options.objective,
    stoppingRule: options.stoppingRule ?? null,
    estimatedDurationMinutes: options.minutes ?? (role === "primary" ? 14 : 9),
  };
}

function loadedOptions(
  weekNumber: number,
  objective: string,
  intent: string,
  minutes = 14,
): Parameters<typeof progressionStep>[6] {
  const percentages = [65, 68, 72, 75, 78, 82, 70, 85];
  const reps = [5, 5, 4, 4, 3, 2, 2, 1];
  return {
    sets: weekNumber === 7 ? 3 : weekNumber === 8 ? 3 : 4,
    reps: reps[weekNumber - 1] ?? 3,
    intensityMethod: "percentage_1rm",
    intensityMin: percentages[weekNumber - 1] ?? 70,
    intensityMax: (percentages[weekNumber - 1] ?? 70) + 5,
    restSeconds: weekNumber >= 5 ? 120 : 90,
    intent,
    objective,
    minutes,
  };
}

function gymnasticsOptions(
  weekNumber: number,
  objective: string,
  intent: string,
  minutes = 11,
): Parameters<typeof progressionStep>[6] {
  const minimum = [4, 5, 6, 6, 3, 4, 3, 1][weekNumber - 1] ?? 4;
  return {
    sets: [3, 4, 4, 5, 5, 4, 3, 1][weekNumber - 1] ?? 4,
    reps: null,
    repRangeMin: minimum,
    repRangeMax: weekNumber === 8 ? minimum + 12 : minimum + 3,
    intensityMethod: "bodyweight",
    restSeconds: weekNumber === 8 ? 180 : weekNumber >= 5 ? 90 : 75,
    intent,
    objective,
    stoppingRule:
      "Stop before movement quality, hollow-body position, or rep speed deteriorates.",
    minutes,
  };
}

function strictPressOptions(
  weekNumber: number,
): Parameters<typeof progressionStep>[6] {
  const sets = [4, 4, 5, 5, 5, 5, 3, 3];
  const reps = [6, 6, 5, 4, 4, 3, 2, 1];
  const minimums = [65, 68, 70, 75, 78, 82, 87, 85];
  const maximums = [70, 72, 75, 80, 82, 85, 92, 90];
  return {
    sets: sets[weekNumber - 1] ?? 4,
    reps: reps[weekNumber - 1] ?? 4,
    intensityMethod: "percentage_1rm",
    intensityMin: minimums[weekNumber - 1] ?? 70,
    intensityMax: maximums[weekNumber - 1] ?? 75,
    restSeconds: weekNumber >= 5 ? 120 : 90,
    intent: "Press from a braced trunk and finish over the mid-foot.",
    objective: "Build measurable strict-press strength for HSPU development.",
    stoppingRule:
      "Leave 1–2 reps in reserve; stop before a grinding repetition.",
    minutes: weekNumber === 7 ? 11 : 13,
  };
}

function strictPullOptions(
  input: GenerateProgramInput,
  weekNumber: number,
  secondary: boolean,
): { movementId: string; options: Parameters<typeof progressionStep>[6] } {
  const skills = normalizeAthleteSkills(input.skills);
  const level = strictPullupLevel(input);
  const hasBand = input.equipment.some((item) => item.toLowerCase() === "band");
  let movementId = "strict_pull_up";
  let reps = [3, 4, 4, 5, 4, 3, 2, 2][weekNumber - 1] ?? 3;
  let intensityMethod: "bodyweight" | "rir" | "rpe" = "rir";
  let intensityMin: number | null = 2;
  let intensityMax: number | null = null;
  const bodyweightBenchmark =
    weekNumber === 8 && !secondary && level !== "weighted";

  if (bodyweightBenchmark) {
    movementId =
      skills.pullUps > 0
        ? "strict_pull_up"
        : hasBand
          ? "assisted_strict_pull_up"
          : "eccentric_pull_up";
    reps = 0;
    intensityMethod = "bodyweight";
    intensityMin = null;
  } else if (level === "developing") {
    movementId =
      weekNumber <= 2 && hasBand
        ? "assisted_strict_pull_up"
        : skills.pullUps > 0 && weekNumber >= 4
          ? "strict_pull_up"
          : "eccentric_pull_up";
    reps = movementId === "strict_pull_up" ? 1 : Math.min(3, weekNumber + 1);
  } else if (level === "bodyweight") {
    movementId =
      weekNumber >= 5
        ? skills.pullUps >= 10 && weekNumber === 7
          ? "strict_chest_to_bar_pull_up"
          : "tempo_strict_pull_up"
        : "strict_pull_up";
    reps = Math.min(reps, Math.max(2, skills.pullUps - 2));
  } else if (weekNumber >= 5 && weekNumber <= 8) {
    movementId = "weighted_pull_up";
    reps = weekNumber >= 7 ? 2 : 3;
    intensityMethod = "rpe";
    intensityMin = weekNumber >= 7 ? 8 : 7;
    intensityMax = weekNumber >= 7 ? 9 : 8;
  } else {
    movementId = weekNumber >= 3 ? "tempo_strict_pull_up" : "strict_pull_up";
    reps = weekNumber === 1 ? 5 : 4;
  }

  return {
    movementId,
    options: {
      sets: bodyweightBenchmark
        ? 1
        : Math.max(
            3,
            [4, 4, 5, 5, 5, 5, 3, 3][weekNumber - 1]! - (secondary ? 1 : 0),
          ),
      reps: bodyweightBenchmark
        ? null
        : secondary
          ? Math.max(1, reps - 1)
          : reps,
      repRangeMin: bodyweightBenchmark ? 1 : null,
      repRangeMax: bodyweightBenchmark ? Math.max(3, skills.pullUps + 3) : null,
      intensityMethod,
      intensityMin,
      intensityMax,
      restSeconds: secondary ? 75 : weekNumber >= 5 ? 120 : 90,
      intent:
        "Start from an active hang, keep the trunk hollow, and use no kip.",
      objective: bodyweightBenchmark
        ? "Test one maximum-quality strict pulling set and record completed repetitions."
        : secondary
          ? "Accumulate a second weekly strict-pulling exposure without failure."
          : "Progress strict pulling from controlled bodyweight work to appropriate loading.",
      stoppingRule: bodyweightBenchmark
        ? "End the benchmark when the chin no longer clears the bar without kipping; record only strict repetitions."
        : "Leave 1–3 reps in reserve and stop when rep speed slows.",
      minutes: secondary ? 7 : weekNumber === 7 ? 13 : 15,
    },
  };
}

function strictHspuOptions(
  input: GenerateProgramInput,
  weekNumber: number,
): { movementId: string; options: Parameters<typeof progressionStep>[6] } {
  const skills = normalizeAthleteSkills(input.skills);
  const hasBox = input.equipment.some((item) => item.toLowerCase() === "box");
  let movementId = "floor_pike_handstand_push_up";
  if (skills.strictHspu === 0) {
    movementId =
      weekNumber >= 5
        ? "wall_strict_hspu_eccentric"
        : weekNumber >= 3 && hasBox
          ? "pike_handstand_push_up"
          : "floor_pike_handstand_push_up";
  } else if (
    skills.strictHspu >= 8 &&
    input.athleteLevel !== "beginner" &&
    weekNumber >= 5 &&
    weekNumber <= 7
  ) {
    movementId = "deficit_strict_handstand_push_up";
  } else {
    movementId =
      weekNumber <= 2 && skills.strictHspu < 3
        ? "wall_strict_hspu_eccentric"
        : "strict_handstand_push_up";
  }
  const reps =
    movementId === "wall_strict_hspu_eccentric"
      ? 2
      : movementId === "strict_handstand_push_up"
        ? Math.max(1, Math.min(4, skills.strictHspu - 1))
        : ([5, 6, 6, 7, 4, 4, 3, 3][weekNumber - 1] ?? 4);
  return {
    movementId,
    options: {
      sets: [4, 4, 5, 5, 5, 4, 3, 3][weekNumber - 1] ?? 4,
      reps,
      intensityMethod: "rir",
      intensityMin: 2,
      restSeconds: weekNumber >= 5 ? 105 : 90,
      intent: "Keep the shoulders stacked and control the full range.",
      objective:
        "Progress strict inverted pressing without kipping or failure.",
      stoppingRule:
        "Leave about 2 reps in reserve; stop if the head or spine position changes.",
      minutes: weekNumber === 7 ? 11 : 13,
    },
  };
}

function dipOptions(
  input: GenerateProgramInput,
  weekNumber: number,
): { movementId: string; options: Parameters<typeof progressionStep>[6] } {
  const ringDips = normalizeAthleteSkills(input.skills).ringDips;
  const hasBand = input.equipment.some((item) => item.toLowerCase() === "band");
  let movementId = "ring_dip";
  if (ringDips === 0) {
    movementId =
      weekNumber >= 3 && hasBand ? "assisted_ring_dip" : "ring_support_hold";
  } else if (ringDips >= 8 && weekNumber >= 5 && weekNumber <= 7) {
    movementId = "weighted_dip";
  } else if (weekNumber >= 5 && weekNumber <= 7) {
    movementId = "tempo_ring_dip";
  }
  const isHold = movementId === "ring_support_hold";
  const loaded = movementId === "weighted_dip";
  return {
    movementId,
    options: {
      sets: [3, 4, 4, 5, 5, 4, 3, 3][weekNumber - 1] ?? 4,
      reps: isHold
        ? null
        : movementId === "assisted_ring_dip"
          ? 4
          : Math.max(1, Math.min(6, ringDips - 2)),
      durationSeconds: isHold ? (weekNumber === 1 ? 20 : 30) : null,
      intensityMethod: loaded ? "rpe" : "rir",
      intensityMin: loaded ? (weekNumber >= 7 ? 8 : 7) : 2,
      intensityMax: loaded ? (weekNumber >= 7 ? 9 : 8) : null,
      restSeconds: loaded ? 120 : 75,
      intent: "Keep the rings close, shoulders controlled, and lockout stable.",
      objective:
        "Progress support strength into controlled dip strength and loading.",
      stoppingRule:
        "Leave 1–3 reps in reserve; stop before shoulder position deteriorates.",
      minutes: weekNumber === 7 ? 7 : 9,
    },
  };
}

export function buildStrictStrengthWeekTemplates(
  input: GenerateProgramInput,
): ReadonlyArray<MixedStrengthWeekTemplate> {
  const themes = [
    "Foundation · strict positions and scapular control",
    "Foundation · repeatable strict volume",
    "Volume · pulling and pressing accumulation",
    "Volume · higher quality work capacity",
    "Intensification · harder variations and loading",
    "Intensification · heavy strict strength",
    "Peak · high intensity and reduced accessories",
    "Test · pulling and pressing benchmarks",
  ];
  return Object.freeze(
    themes.map((theme, index) => {
      const weekNumber = index + 1;
      const primaryPull = strictPullOptions(input, weekNumber, false);
      const secondaryPull = strictPullOptions(input, weekNumber, true);
      const hspu = strictHspuOptions(input, weekNumber);
      const dip = dipOptions(input, weekNumber);
      return {
        weekNumber,
        theme,
        day1ConditioningMinutes: 10,
        day2ConditioningMinutes: weekNumber === 8 ? 10 : 12,
        steps: [
          progressionStep(
            weekNumber,
            1,
            "primary",
            "strict_pull",
            "strict_pull",
            primaryPull.movementId,
            primaryPull.options,
          ),
          progressionStep(
            weekNumber,
            1,
            "secondary",
            "upper_body_press",
            "vertical_press",
            "strict_press",
            strictPressOptions(weekNumber),
          ),
          progressionStep(
            weekNumber,
            2,
            "primary",
            "handstand",
            "handstand",
            hspu.movementId,
            hspu.options,
          ),
          progressionStep(
            weekNumber,
            2,
            "secondary",
            "dip",
            "horizontal_press",
            dip.movementId,
            dip.options,
          ),
          progressionStep(
            weekNumber,
            2,
            "secondary",
            "gymnastics_skill",
            "strict_pull",
            secondaryPull.movementId,
            secondaryPull.options,
          ),
        ],
      };
    }),
  );
}

function profileSteps(
  profile: ProgrammeProfile,
  input: GenerateProgramInput,
  weekNumber: number,
): TemplateProgressionStep[] {
  const phase = profile.progressionPhases[weekNumber - 1] ?? "progression";
  if (profile.focus === "gymnastics") {
    const pull = gymnasticsPullingMovement(input, weekNumber);
    const pullFamily = getMovement(pull)?.familyId ?? "strict_pull";
    const midline = gymnasticsMidlineMovement(input);
    return [
      progressionStep(
        weekNumber,
        1,
        "primary",
        "strict_pull",
        pullFamily,
        pull,
        gymnasticsOptions(
          weekNumber,
          `${phase}: progress vertical pulling capacity.`,
          "Use repeatable strict or skilled pulling with consistent body shape.",
          14,
        ),
      ),
      progressionStep(
        weekNumber,
        1,
        "secondary",
        "toes_to_bar",
        "toes_to_bar",
        midline,
        gymnasticsOptions(
          weekNumber,
          `${phase}: progress hanging midline capacity.`,
          "Control the kip or strict raise without losing the hollow-to-arch rhythm.",
          9,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "primary",
        "handstand",
        "handstand",
        handstandMovement(input, weekNumber),
        gymnasticsOptions(
          weekNumber,
          `${phase}: progress handstand pressing and inversion skill.`,
          "Maintain stacked shoulders and finish every repetition under control.",
          13,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "secondary",
        "upper_body_press",
        "vertical_press",
        "strict_press",
        loadedOptions(
          weekNumber,
          "Build pressing strength that supports handstand and HSPU capacity.",
          "Press from a braced trunk without leaning back.",
          10,
        ),
      ),
    ];
  }
  if (profile.focus === "olympic") {
    return [
      progressionStep(
        weekNumber,
        1,
        "primary",
        "snatch",
        "snatch",
        weekNumber <= 2 ? "hang_power_snatch" : "snatch",
        loadedOptions(
          weekNumber,
          `${phase}: progress snatch positions and competition-lift quality.`,
          "Keep the bar close and receive with balanced feet.",
          15,
        ),
      ),
      progressionStep(
        weekNumber,
        1,
        "secondary",
        "front_squat",
        "front_squat",
        "front_squat",
        loadedOptions(
          weekNumber,
          "Build squat strength that supports the clean and snatch receiving position.",
          "Stay braced and upright through the full range.",
          11,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "primary",
        "clean_and_jerk",
        "clean_and_jerk",
        weekNumber <= 2 ? "hang_clean_and_jerk" : "clean_and_jerk",
        loadedOptions(
          weekNumber,
          `${phase}: progress clean-and-jerk timing and stability.`,
          "Complete the clean before driving into a balanced jerk.",
          16,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "secondary",
        "back_squat",
        "back_squat",
        "back_squat",
        loadedOptions(
          weekNumber,
          "Build leg strength without compromising Olympic-lift speed.",
          "Use controlled depth and accelerate through the sticking point.",
          10,
        ),
      ),
    ];
  }
  if (profile.focus === "strength") {
    return [
      progressionStep(
        weekNumber,
        1,
        "primary",
        "back_squat",
        "back_squat",
        "back_squat",
        loadedOptions(
          weekNumber,
          `${phase}: progress back-squat strength.`,
          "Brace before descending and drive evenly through both feet.",
          16,
        ),
      ),
      progressionStep(
        weekNumber,
        1,
        "secondary",
        "hinge",
        "hinge",
        "deadlift",
        loadedOptions(
          weekNumber,
          `${phase}: progress hinge strength.`,
          "Keep the bar close and finish with the hips without overextending.",
          12,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "primary",
        "upper_body_press",
        "vertical_press",
        "strict_press",
        loadedOptions(
          weekNumber,
          `${phase}: progress strict pressing strength.`,
          "Brace the trunk and finish with the bar over the mid-foot.",
          14,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "secondary",
        "strict_pull",
        "strict_pull",
        "weighted_pull_up",
        {
          ...gymnasticsOptions(
            weekNumber,
            "Build upper-body pulling strength alongside pressing.",
            "Use a full hang and finish with the chin clearly over the bar.",
            11,
          ),
          intensityMethod: "rpe",
          intensityMin: 6,
          intensityMax: 8,
        },
      ),
    ];
  }
  if (profile.focus === "conditioning") {
    return [
      progressionStep(
        weekNumber,
        1,
        "primary",
        weekNumber % 2 ? "back_squat" : "hinge",
        weekNumber % 2 ? "back_squat" : "hinge",
        weekNumber % 2 ? "back_squat" : "deadlift",
        loadedOptions(
          weekNumber,
          "Maintain lower-body strength with low volume.",
          "Finish every set with two technically sound repetitions in reserve.",
          10,
        ),
      ),
      progressionStep(
        weekNumber,
        1,
        "secondary",
        "strict_pull",
        "strict_pull",
        "strict_pull_up",
        gymnasticsOptions(
          weekNumber,
          "Maintain strict pulling capacity without adding grip fatigue.",
          "Use submaximal sets and stop well before failure.",
          7,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "primary",
        "upper_body_press",
        "vertical_press",
        "strict_press",
        loadedOptions(
          weekNumber,
          "Maintain pressing strength while engine volume rises.",
          "Keep every repetition crisp and submaximal.",
          9,
        ),
      ),
      progressionStep(
        weekNumber,
        2,
        "secondary",
        "handstand",
        "handstand",
        "pike_handstand_push_up",
        gymnasticsOptions(
          weekNumber,
          "Maintain inversion and shoulder endurance.",
          "Hold a stacked position without accumulating fatigue.",
          7,
        ),
      ),
    ];
  }

  const oddWeek = weekNumber % 2 === 1;
  return [
    progressionStep(
      weekNumber,
      1,
      "primary",
      oddWeek ? "back_squat" : "hinge",
      oddWeek ? "back_squat" : "hinge",
      oddWeek ? "back_squat" : "deadlift",
      loadedOptions(
        weekNumber,
        `${phase}: build balanced lower-body strength.`,
        "Use controlled, repeatable strength work without grinding.",
        13,
      ),
    ),
    progressionStep(
      weekNumber,
      1,
      "secondary",
      "strict_pull",
      "strict_pull",
      "strict_pull_up",
      gymnasticsOptions(
        weekNumber,
        "Build repeatable pulling and gymnastics strength.",
        "Maintain an active shoulder and stable hollow position.",
        9,
      ),
    ),
    progressionStep(
      weekNumber,
      2,
      "primary",
      oddWeek ? "upper_body_press" : "handstand",
      oddWeek ? "vertical_press" : "handstand",
      oddWeek ? "strict_press" : handstandMovement(input, weekNumber),
      oddWeek
        ? loadedOptions(
            weekNumber,
            "Build balanced vertical pressing strength.",
            "Press from a braced, stable base.",
            12,
          )
        : gymnasticsOptions(
            weekNumber,
            "Build handstand pressing and inversion skill.",
            "Maintain stacked shoulders and controlled positions.",
            11,
          ),
    ),
    progressionStep(
      weekNumber,
      2,
      "secondary",
      oddWeek ? "snatch" : "clean_and_jerk",
      oddWeek ? "snatch" : "clean_and_jerk",
      oddWeek ? "hang_power_snatch" : "hang_clean_and_jerk",
      loadedOptions(
        weekNumber,
        "Develop Olympic-lifting technique without letting it dominate the cycle.",
        "Prioritize timing and stable receiving positions over load.",
        9,
      ),
    ),
  ];
}

export function buildProfileWeekTemplates(
  profile: ProgrammeProfile,
  input: GenerateProgramInput,
  durationWeeks: number,
): ReadonlyArray<MixedStrengthWeekTemplate> {
  return Object.freeze(
    Array.from({ length: durationWeeks }, (_, index) => {
      const weekNumber = index + 1;
      const recovery = weekNumber === durationWeeks;
      const [day1, day2] =
        profile.focus === "conditioning"
          ? [20, 22]
          : profile.conditioningStyle === "open" ||
              profile.conditioningStyle === "competition"
            ? [14, 14]
            : profile.focus === "olympic"
              ? [7, 7]
              : profile.focus === "strength"
                ? [8, 10]
                : profile.focus === "gymnastics"
                  ? [10, 12]
                  : [12, 14];
      return {
        weekNumber,
        theme: `${profile.primaryGoal.replaceAll("_", " ")} · ${profile.trainingBlock.replaceAll("_", " ")} · ${profile.progressionPhases[index]}`,
        day1ConditioningMinutes: recovery ? Math.min(day1, 8) : day1,
        day2ConditioningMinutes: recovery ? Math.min(day2, 8) : day2,
        steps: profileSteps(profile, input, weekNumber),
      };
    }),
  );
}

export function programmeMovementExposures(
  program: ProgramV2,
): Record<string, number> {
  const exposures: Record<string, number> = {};
  const sessions = program.trainingBlocks.flatMap((block) =>
    block.trainingWeeks.flatMap((week) => week.sessions),
  );
  for (const session of sessions) {
    const familyIds = new Set([
      ...session.exercises.map((exercise) => exercise.movementFamilyId),
      ...(session.conditioning?.movements.map(
        (movement) => movement.movementFamilyId,
      ) ?? []),
    ]);
    for (const familyId of familyIds) {
      exposures[familyId] = (exposures[familyId] ?? 0) + 1;
    }
    if (
      session.exercises.some(
        (exercise) => getMovement(exercise.movementId)?.unilateral,
      )
    ) {
      exposures.unilateral = (exposures.unilateral ?? 0) + 1;
    }
    exposures.conditioning_minutes =
      (exposures.conditioning_minutes ?? 0) +
      (session.conditioning?.estimatedDurationMinutes ?? 0);
  }
  exposures.conditioning_variety = new Set(
    sessions.flatMap(
      (session) =>
        session.conditioning?.movements
          .filter((movement) =>
            ["running", "rowing", "bike", "ski"].includes(
              movement.movementFamilyId,
            ),
          )
          .map((movement) => movement.movementFamilyId) ?? [],
    ),
  ).size;
  return exposures;
}

function programmeProgressionExposures(
  program: ProgramV2,
): Record<string, number> {
  const exposures: Record<string, number> = {};
  const sessions = program.trainingBlocks.flatMap((block) =>
    block.trainingWeeks.flatMap((week) => week.sessions),
  );
  for (const session of sessions) {
    const familyIds = new Set(
      session.exercises
        .filter((exercise) => exercise.progressionTrackId)
        .map((exercise) => exercise.movementFamilyId),
    );
    for (const familyId of familyIds) {
      exposures[familyId] = (exposures[familyId] ?? 0) + 1;
    }
  }
  return exposures;
}

function generatedEmphasis(program: ProgramV2): ProgrammeEmphasis {
  const counts: ProgrammeEmphasis = {
    strength: 0,
    gymnastics: 0,
    olympic: 0,
    conditioning: 0,
    accessory: 0,
  };
  const sessions = program.trainingBlocks.flatMap((block) =>
    block.trainingWeeks.flatMap((week) => week.sessions),
  );
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const category = getMovement(exercise.movementId)?.category;
      const minutes = Math.max(1, exercise.estimatedDurationMinutes);
      if (category === "olympic_lifting") counts.olympic += minutes;
      else if (category) counts[category] += minutes;
    }
    counts.conditioning += session.conditioning?.estimatedDurationMinutes ?? 0;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!total) return counts;
  const result = Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [
      key,
      Math.round((value / total) * 100),
    ]),
  ) as unknown as ProgrammeEmphasis;
  result.conditioning +=
    100 - Object.values(result).reduce((sum, value) => sum + value, 0);
  return result;
}

export function validateProgrammeIdentity(
  program: ProgramV2,
  profile: ProgrammeProfile,
): ProgrammeIdentityValidation {
  const problems: string[] = [];
  const exposures = programmeMovementExposures(program);
  const progressionExposures = programmeProgressionExposures(program);
  const block = program.trainingBlocks[0];
  const sessions = block?.trainingWeeks.flatMap((week) => week.sessions) ?? [];
  for (const [familyId, target] of Object.entries(
    profile.movementExposureTargets,
  )) {
    if (!target) continue;
    const actual =
      familyId === "core"
        ? (exposures[familyId] ?? 0)
        : (progressionExposures[familyId] ?? 0);
    const minimum = Math.min(
      target.minimum,
      block?.durationWeeks ?? target.minimum,
    );
    if (actual < minimum) {
      problems.push(
        `${familyId} appears in ${actual} sessions; profile minimum is ${minimum}.`,
      );
    }
    if (actual > target.maximum) {
      problems.push(
        `${familyId} appears in ${actual} sessions; profile maximum is ${target.maximum}.`,
      );
    }
  }
  for (const [familyId, maximum] of Object.entries(profile.movementLimits)) {
    const actual = progressionExposures[familyId] ?? 0;
    if (maximum != null && actual > maximum) {
      problems.push(
        `${familyId} appears in ${actual} sessions; profile limit is ${maximum}.`,
      );
    }
  }
  if (profile.focus === "gymnastics") {
    const gymnasticsFamilies = [
      "strict_pull",
      "kipping_pull",
      "bar_muscle_up",
      "toes_to_bar",
      "handstand",
      "core",
    ].filter((family) => (exposures[family] ?? 0) > 0);
    if (gymnasticsFamilies.length < 3) {
      problems.push(
        "Gymnastics capacity requires at least three gymnastics movement families.",
      );
    }
    const pullingExposure = [
      "strict_pull",
      "kipping_pull",
      "bar_muscle_up",
    ].reduce((total, family) => total + (progressionExposures[family] ?? 0), 0);
    if (pullingExposure < (block?.durationWeeks ?? 0)) {
      problems.push(
        "Gymnastics capacity lacks a vertical-pulling progression every week.",
      );
    }
    for (const week of block?.trainingWeeks ?? []) {
      if (
        !week.sessions.some((session) =>
          session.exercises.some(
            (exercise) =>
              getMovement(exercise.movementId)?.category === "gymnastics",
          ),
        )
      ) {
        problems.push(`Week ${week.weekNumber} has no gymnastics progression.`);
      }
    }
  }
  if (profile.focus === "olympic") {
    const olympicSessions = sessions.filter((session) =>
      session.exercises.some(
        (exercise) =>
          getMovement(exercise.movementId)?.category === "olympic_lifting",
      ),
    ).length;
    if (olympicSessions < (block?.durationWeeks ?? 0) * 2) {
      problems.push(
        "Olympic-lifting development is missing weekly snatch or clean-and-jerk exposure.",
      );
    }
  }
  if (profile.focus === "strength") {
    const strengthSessions = sessions.filter((session) =>
      session.exercises.some(
        (exercise) => getMovement(exercise.movementId)?.category === "strength",
      ),
    ).length;
    if (strengthSessions < (block?.durationWeeks ?? 0) * 2) {
      problems.push(
        "Strength development lacks a planned strength progression in every session.",
      );
    }
  }
  if (profile.focus === "conditioning") {
    const averageMinutes = sessions.length
      ? (exposures.conditioning_minutes ?? 0) / sessions.length
      : 0;
    if (averageMinutes < 12) {
      problems.push(
        `Engine development averages only ${Math.round(averageMinutes)} conditioning minutes.`,
      );
    }
    if ((exposures.conditioning_variety ?? 0) < 2) {
      problems.push(
        "Engine development uses fewer than two monostructural modalities.",
      );
    }
  }
  if (
    profile.conditioningStyle === "open" &&
    !sessions.some(
      (session) => session.conditioning?.competitionMetadata?.competitionStyle,
    )
  ) {
    problems.push("Open preparation has no scored Open-style conditioning.");
  }
  if (profile.focus === "accessory") {
    if (!((exposures.front_squat ?? 0) + (exposures.back_squat ?? 0))) {
      problems.push("General CrossFit is missing squat exposure.");
    }
    for (const family of ["hinge", "strict_pull", "snatch", "clean_and_jerk"]) {
      if (!((exposures[family] ?? 0) > 0)) {
        problems.push(`General CrossFit is missing ${family} exposure.`);
      }
    }
    if (!((exposures.carry ?? 0) > 0) || !((exposures.unilateral ?? 0) > 0)) {
      problems.push(
        "General CrossFit requires both carry and unilateral exposure.",
      );
    }
  }
  return { valid: problems.length === 0, problems };
}

export function createProgrammeGenerationSummary(
  program: ProgramV2,
  profile: ProgrammeProfile,
): ProgrammeGenerationSummary {
  return {
    programme: profile.primaryGoal,
    block: profile.trainingBlock,
    generatedEmphasis: generatedEmphasis(program),
    movementExposures: programmeMovementExposures(program),
    identityValidation: validateProgrammeIdentity(program, profile),
  };
}

export function programmeSimilarity(left: ProgramV2, right: ProgramV2): number {
  const leftValues = programmeMovementExposures(left);
  const rightValues = programmeMovementExposures(right);
  const keys = [
    ...new Set(
      [...Object.keys(leftValues), ...Object.keys(rightValues)].filter(
        (key) => key !== "conditioning_minutes",
      ),
    ),
  ];
  const dot = keys.reduce(
    (sum, key) => sum + (leftValues[key] ?? 0) * (rightValues[key] ?? 0),
    0,
  );
  const magnitude = (values: Record<string, number>): number =>
    Math.sqrt(keys.reduce((sum, key) => sum + (values[key] ?? 0) ** 2, 0));
  const denominator = magnitude(leftValues) * magnitude(rightValues);
  return denominator ? Math.round((dot / denominator) * 1000) / 1000 : 0;
}

export function validateProgrammeDifferentiation(
  programmes: ProgramV2[],
): ProgrammeIdentityValidation {
  const problems: string[] = [];
  for (let left = 0; left < programmes.length; left += 1) {
    for (let right = left + 1; right < programmes.length; right += 1) {
      const first = programmes[left]!;
      const second = programmes[right]!;
      if (
        first.programmeProfile?.focus !== second.programmeProfile?.focus &&
        programmeSimilarity(first, second) >= 0.92
      ) {
        problems.push(
          `${first.programmeProfile?.focus} and ${second.programmeProfile?.focus} programmes are near-identical.`,
        );
      }
    }
  }
  return { valid: problems.length === 0, problems };
}
