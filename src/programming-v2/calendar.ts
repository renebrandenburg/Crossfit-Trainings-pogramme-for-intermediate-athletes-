import type {
  MovementFamilyId,
  ProgramV2,
  TrainingSession,
  TrainingStimulus,
  V2CalendarSession,
  V2GenerationPreferences,
  Weekday,
} from "./types";

export const DEFAULT_V2_GENERATION_PREFERENCES: V2GenerationPreferences = {
  preferredDays: ["tuesday", "saturday"],
  frequency: 2,
  goal: "mixed",
  blockType: "mixed_strength",
  athleteLevel: "intermediate",
  availableEquipment: [
    "barbell",
    "rack",
    "pull-up bar",
    "dumbbell",
    "kettlebell",
    "box",
    "rings",
    "rower",
    "bike",
    "ski erg",
    "band",
    "PVC",
  ],
  weightIncrementKg: 2.5,
  roundingMode: "nearest",
};

const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const FAMILY_STIMULI: Partial<Record<MovementFamilyId, TrainingStimulus[]>> = {
  front_squat: ["squat"],
  back_squat: ["squat"],
  hinge: ["hinge"],
  horizontal_press: ["horizontal_push"],
  vertical_press: ["vertical_push"],
  strict_pull: ["vertical_pull", "gymnastics"],
  kipping_pull: ["vertical_pull", "gymnastics"],
  toes_to_bar: ["vertical_pull", "gymnastics"],
  bar_muscle_up: ["vertical_pull", "gymnastics"],
  ring_muscle_up: ["vertical_pull", "gymnastics"],
  handstand: ["vertical_push", "gymnastics"],
  snatch: ["olympic_lifting"],
  clean: ["olympic_lifting"],
  jerk: ["vertical_push", "olympic_lifting"],
  clean_and_jerk: ["olympic_lifting"],
  running: ["aerobic"],
  rowing: ["aerobic"],
  bike: ["aerobic"],
  ski: ["aerobic"],
  jumping: ["squat"],
  burpee: ["horizontal_push"],
};

function normalizedPreferredDays(
  value: unknown,
  frequency: 2 | 3 | 4,
): Weekday[] {
  const requested = Array.isArray(value)
    ? [...new Set(value.map(String))].filter((day): day is Weekday =>
        WEEKDAYS.includes(day as Weekday),
      )
    : [];
  if (requested.length !== frequency) {
    const defaults = DEFAULT_V2_GENERATION_PREFERENCES.preferredDays;
    return frequency === 2 ? [...defaults] : WEEKDAYS.slice(0, frequency);
  }
  requested.sort(
    (left, right) => WEEKDAYS.indexOf(left) - WEEKDAYS.indexOf(right),
  );
  return requested;
}

export function normalizeV2GenerationPreferences(
  value: Partial<V2GenerationPreferences> | null | undefined,
): V2GenerationPreferences {
  const athleteLevel = ["beginner", "intermediate", "advanced"].includes(
    String(value?.athleteLevel),
  )
    ? (value?.athleteLevel as V2GenerationPreferences["athleteLevel"])
    : DEFAULT_V2_GENERATION_PREFERENCES.athleteLevel;
  const increment = Number(value?.weightIncrementKg);
  const weightIncrementKg = [1, 2, 2.5, 5].includes(increment)
    ? (increment as V2GenerationPreferences["weightIncrementKg"])
    : DEFAULT_V2_GENERATION_PREFERENCES.weightIncrementKg;
  const roundingMode = ["nearest", "down", "up"].includes(
    String(value?.roundingMode),
  )
    ? (value?.roundingMode as V2GenerationPreferences["roundingMode"])
    : DEFAULT_V2_GENERATION_PREFERENCES.roundingMode;
  const requestedFrequency = Number(value?.frequency);
  const frequency = [2, 3, 4].includes(requestedFrequency)
    ? (requestedFrequency as V2GenerationPreferences["frequency"])
    : Array.isArray(value?.preferredDays) &&
        [3, 4].includes(
          new Set(
            value.preferredDays
              .map(String)
              .filter((day) => WEEKDAYS.includes(day as Weekday)),
          ).size,
        )
      ? (new Set(
          value.preferredDays
            .map(String)
            .filter((day) => WEEKDAYS.includes(day as Weekday)),
        ).size as V2GenerationPreferences["frequency"])
      : DEFAULT_V2_GENERATION_PREFERENCES.frequency;
  const goal = [
    "strength",
    "endurance",
    "gymnastics",
    "bar_muscle_up",
    "competition",
    "open",
    "masters_open",
    "olympic_lifting",
    "general_crossfit",
    "mixed",
  ].includes(String(value?.goal))
    ? (value?.goal as V2GenerationPreferences["goal"])
    : DEFAULT_V2_GENERATION_PREFERENCES.goal;
  const blockTypes = [
    "mixed_strength",
    "front_squat_accumulation",
    "back_squat_strength",
    "olympic_lifting_development",
    "snatch_development",
    "clean_and_jerk_development",
    "gymnastics_capacity",
    "aerobic_capacity",
    "competition_preparation",
    "open_preparation",
    "masters_open_preparation",
    "deload",
  ];
  const blockType = blockTypes.includes(String(value?.blockType))
    ? (value?.blockType as V2GenerationPreferences["blockType"])
    : DEFAULT_V2_GENERATION_PREFERENCES.blockType;
  const availableEquipment = Array.isArray(value?.availableEquipment)
    ? [...new Set(value.availableEquipment.map(String).filter(Boolean))]
    : [...DEFAULT_V2_GENERATION_PREFERENCES.availableEquipment];
  return {
    preferredDays: normalizedPreferredDays(value?.preferredDays, frequency),
    frequency,
    goal,
    blockType,
    athleteLevel,
    availableEquipment,
    weightIncrementKg,
    roundingMode,
    templateId:
      typeof value?.templateId === "string" && value.templateId.length > 0
        ? value.templateId
        : blockType === "competition_preparation"
          ? "competition_preparation_6w"
          : blockType === "open_preparation"
            ? "open_preparation_6w"
            : blockType === "masters_open_preparation"
              ? "masters_open_preparation_6w"
              : "mixed_strength_6w",
  };
}

export function flattenV2ProgramSessions(
  program: ProgramV2 | null | undefined,
): TrainingSession[] {
  if (!program) return [];
  return program.trainingBlocks.flatMap((block) =>
    block.trainingWeeks.flatMap((week) => week.sessions),
  );
}

function conditioningStimulus(session: TrainingSession): TrainingStimulus {
  const duration =
    session.conditioning?.durationMinutes ??
    session.conditioning?.timeCapMinutes ??
    session.conditioning?.estimatedDurationMinutes ??
    0;
  if (duration <= 10) return "short_conditioning";
  if (duration <= 15) return "medium_conditioning";
  return "long_conditioning";
}

export function v2SessionStimuli(session: TrainingSession): TrainingStimulus[] {
  const stimuli = new Set<TrainingStimulus>();
  const families = [
    ...session.exercises.map((exercise) => exercise.movementFamilyId),
    ...(session.conditioning?.movements.map(
      (movement) => movement.movementFamilyId,
    ) ?? []),
  ];
  families.forEach((family) =>
    (FAMILY_STIMULI[family] ?? []).forEach((stimulus) => stimuli.add(stimulus)),
  );
  if (session.conditioning) stimuli.add(conditioningStimulus(session));
  return [...stimuli];
}

function weekdayLabel(day: Weekday): string {
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
}

export function adaptV2ProgramToCalendarSessions(
  program: ProgramV2 | null | undefined,
  preferences: Partial<V2GenerationPreferences> | null | undefined,
): V2CalendarSession[] {
  const normalized = normalizeV2GenerationPreferences(preferences);
  return flattenV2ProgramSessions(program).map((session) => {
    const preferredDay =
      normalized.preferredDays[Math.max(0, session.sessionNumber - 1)] ??
      normalized.preferredDays[0] ??
      "monday";
    return {
      id: session.id,
      engineVersion: "v2",
      week: session.weekNumber,
      weekNumber: session.weekNumber,
      sessionNumber: session.sessionNumber,
      preferredDay,
      weekday: weekdayLabel(preferredDay),
      title: session.objective,
      shortTitle: session.objective,
      focus: session.intendedStimulus,
      duration: session.estimatedDurationMinutes,
      status: session.status,
      movementPatterns: v2SessionStimuli(session),
      v2Session: session,
    };
  });
}

export function summarizeV2Program(program: ProgramV2 | null | undefined): {
  weeks: number;
  sessions: number;
  exercises: number;
} {
  const sessions = flattenV2ProgramSessions(program);
  return {
    weeks: program?.trainingBlocks[0]?.trainingWeeks.length ?? 0,
    sessions: sessions.length,
    exercises: sessions.reduce(
      (total, session) => total + session.exercises.length,
      0,
    ),
  };
}
