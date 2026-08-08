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
    handstandWalkMeters: number(value?.handstandWalkMeters),
  };
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
  const primaryGoal = input.goal ?? "mixed";
  const trainingBlock = input.blockType ?? fallbackBlockType;
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
  const testingTargets = openProfile
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
    movementPriorities: priorities(focus),
    strengthPriority: emphasis.strength,
    gymnasticsPriority: emphasis.gymnastics,
    olympicPriority: emphasis.olympic,
    enginePriority: emphasis.conditioning,
    skillPriority: Math.max(emphasis.gymnastics, emphasis.olympic),
    conditioningPriority: emphasis.conditioning,
    testingTargets,
    movementExposureTargets: exposureTargets(focus),
    movementLimits: movementLimits(focus),
    progressionPhases: [...PHASES[focus]],
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
    durationSeconds: null,
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
