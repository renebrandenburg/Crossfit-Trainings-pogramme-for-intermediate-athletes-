import { getMovement, movementAllowed } from "./catalog";
import {
  calculateExerciseDurationMinutes,
  calculateSessionDuration,
  calculateWorkingWeight,
  durationStatus,
  equipmentTransitionMinutes,
} from "./duration";
import {
  MIXED_STRENGTH_TEMPLATE,
  TRACK_ORDER,
  getV2TemplateDefinition,
  type MixedStrengthWeekTemplate,
  type TemplateProgressionStep,
} from "./template";
import type {
  ConditioningMovement,
  ConditioningPrescription,
  EquipmentTransition,
  ExercisePrescription,
  GenerateProgramInput,
  MovementFamilyId,
  ProgramV2,
  ProgressionStep,
  ProgressionTrack,
  ProgressionTrackType,
  ScalingOption,
  SessionSection,
  SessionStress,
  TrackAssignment,
  TrainingBlock,
  TrainingSession,
  TrainingWeek,
  WarmupExercise,
  WarmupPrescription,
} from "./types";
import {
  CATALOG_VERSION,
  ENGINE_VERSION,
  PROGRAM_SCHEMA_VERSION,
  TEMPLATE_VERSION,
  VALIDATOR_VERSION,
} from "./types";
import { assertValidProgram, validateProgram } from "./validation";

function hash32(value: string, seed = 2166136261): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stableUuid(...parts: Array<string | number>): string {
  const source = parts.join(":"),
    a = hash32(source, 2166136261),
    b = hash32(source, 2246822519),
    c = hash32(source, 3266489917),
    d = hash32(source, 668265263);
  const hex = [a, b, c, d]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function seededIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  return hash32(seed) % length;
}

function maxForTrack(
  input: GenerateProgramInput,
  trackType: ProgressionTrackType,
): number | null {
  const value =
    trackType === "front_squat"
      ? input.maxes.front_squat
      : trackType === "back_squat"
        ? input.maxes.back_squat
        : trackType === "snatch"
          ? input.maxes.snatch
          : trackType === "clean_and_jerk"
            ? input.maxes.clean_and_jerk
            : null;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function referenceLift(trackType: ProgressionTrackType): string | null {
  if (trackType === "front_squat") return "front squat";
  if (trackType === "back_squat") return "back squat";
  if (trackType === "snatch") return "snatch";
  if (trackType === "clean_and_jerk") return "clean and jerk";
  if (trackType === "upper_body_press") return "strict press";
  return null;
}

function fallbackRpe(intensityMin: number | null): [number, number] {
  if (intensityMin == null || intensityMin <= 65) return [5, 6];
  if (intensityMin <= 75) return [6, 7];
  if (intensityMin <= 85) return [7, 8];
  return [8, 8];
}

function gymnasticsScaling(): ScalingOption[] {
  return [
    {
      level: "scaled",
      movementId: "ring_row",
      movementName: "Ring row",
      prescriptionAdjustment:
        "Replace strict pull-ups with 8–12 ring rows per round.",
      measurableTarget:
        "Finish every set with two technically sound repetitions in reserve.",
    },
  ];
}

function defaultScaling(movementName: string): ScalingOption[] {
  return [
    {
      level: "scaled",
      movementId: null,
      movementName,
      prescriptionAdjustment: "Use the bottom of the prescribed range.",
      measurableTarget:
        "Complete every set at or below the programmed RPE ceiling.",
    },
  ];
}

function createProgressionExercise(
  input: GenerateProgramInput,
  sessionId: string,
  track: ProgressionTrack,
  templateStep: TemplateProgressionStep,
  stepNumber: number,
): ExercisePrescription {
  const movement = getMovement(templateStep.movementId);
  if (!movement) {
    throw new Error(`Unknown template movement ${templateStep.movementId}.`);
  }
  if (
    !movementAllowed(
      movement.id,
      templateStep.role,
      input.equipment,
      input.restrictions,
    )
  ) {
    throw new Error(
      `REQUIRED_MOVEMENT_UNAVAILABLE: ${movement.name} is unavailable for the mixed-strength template.`,
    );
  }

  const referenceMaxKg = maxForTrack(input, templateStep.trackType);
  let intensityMethod = templateStep.intensityMethod;
  let intensityValue = templateStep.intensityMin;
  let intensityMax = templateStep.intensityMax;
  let loadKg: number | null = null;
  const reference = referenceLift(templateStep.trackType);
  if (intensityMethod === "percentage_1rm" && referenceMaxKg == null) {
    const [minimumRpe, maximumRpe] = fallbackRpe(templateStep.intensityMin);
    intensityMethod = "rpe";
    intensityValue = minimumRpe;
    intensityMax = maximumRpe;
  } else if (
    intensityMethod === "percentage_1rm" &&
    referenceMaxKg != null &&
    intensityValue != null
  ) {
    loadKg = calculateWorkingWeight({
      maxKg: referenceMaxKg,
      percentage: intensityValue,
      incrementKg: input.weightIncrementKg,
      roundingMode: input.roundingMode,
    });
  }

  const prescription: ExercisePrescription = {
    id: stableUuid(sessionId, "exercise", track.id, stepNumber),
    sessionId,
    progressionTrackId: track.id,
    progressionStepNumber: stepNumber,
    groupId:
      movement.category === "gymnastics"
        ? stableUuid(sessionId, "gymnastics", track.id)
        : null,
    section: templateStep.role,
    movementId: movement.id,
    movementName: movement.name,
    movementFamilyId: movement.familyId,
    sets: templateStep.sets,
    reps: templateStep.reps,
    repRangeMin: templateStep.repRangeMin,
    repRangeMax: templateStep.repRangeMax,
    durationSeconds: templateStep.durationSeconds,
    distanceMeters: null,
    calories: null,
    intensityMethod,
    intensityValue,
    intensityMax,
    loadKg,
    referenceMaxKg,
    referenceLift: reference,
    restSeconds: templateStep.restSeconds,
    tempo: null,
    pauseDescription: null,
    technicalIntent: templateStep.technicalIntent,
    progressionObjective: templateStep.progressionObjective,
    stoppingRule: templateStep.stoppingRule,
    coachingCues:
      templateStep.trackType === "front_squat"
        ? [
            "Brace before descending.",
            "Drive the elbows up through the sticking point.",
          ]
        : templateStep.trackType === "snatch"
          ? [
              "Keep the bar close.",
              "Receive with active shoulders and balanced feet.",
            ]
          : templateStep.trackType === "clean_and_jerk"
            ? [
                "Finish the clean before standing.",
                "Hold the jerk catch until balanced.",
              ]
            : [
                "Start each rep from an active shoulder.",
                "Keep ribs down and legs quiet.",
              ],
    scalingOptions:
      movement.category === "gymnastics"
        ? gymnasticsScaling()
        : defaultScaling(movement.name),
    equipment: movement.equipment,
    warmupSetCount:
      templateStep.role === "primary"
        ? templateStep.weekNumber === 6
          ? 2
          : 4
        : movement.loadable
          ? 2
          : 0,
    setupMinutes: templateStep.role === "primary" ? 2 : 1,
    estimatedDurationMinutes: templateStep.estimatedDurationMinutes,
  };
  return {
    ...prescription,
    estimatedDurationMinutes: calculateExerciseDurationMinutes(prescription),
  };
}

function createGymnasticsShapeExercises(
  input: GenerateProgramInput,
  sessionId: string,
  anchor: ExercisePrescription,
): ExercisePrescription[] {
  const specs: Array<{
    movementId: string;
    reps: number | null;
    repRangeMin: number | null;
    repRangeMax: number | null;
    durationSeconds: number | null;
    cue: string;
  }> = [
    {
      movementId: "hollow_hold",
      reps: null,
      repRangeMin: null,
      repRangeMax: null,
      durationSeconds: 20,
      cue: "Press the lower back into the floor and keep the ribs down.",
    },
    {
      movementId: "arch_hold",
      reps: null,
      repRangeMin: null,
      repRangeMax: null,
      durationSeconds: 20,
      cue: "Reach long through the fingertips and toes without overextending the neck.",
    },
    {
      movementId: "hanging_knee_raise",
      reps: null,
      repRangeMin: 8,
      repRangeMax: 12,
      durationSeconds: null,
      cue: "Initiate with the abs and finish each rep without swinging.",
    },
  ];
  return specs
    .filter((spec) =>
      movementAllowed(
        spec.movementId,
        "secondary",
        input.equipment,
        input.restrictions,
      ),
    )
    .map((spec, index) => {
      const movement = getMovement(spec.movementId);
      if (!movement)
        throw new Error(`Unknown gymnastics movement ${spec.movementId}.`);
      const exercise: ExercisePrescription = {
        id: stableUuid(sessionId, "gymnastics-shape", index),
        sessionId,
        progressionTrackId: null,
        progressionStepNumber: null,
        groupId: anchor.groupId,
        section: "secondary",
        movementId: movement.id,
        movementName: movement.name,
        movementFamilyId: movement.familyId,
        sets: anchor.sets,
        reps: spec.reps,
        repRangeMin: spec.repRangeMin,
        repRangeMax: spec.repRangeMax,
        durationSeconds: spec.durationSeconds,
        distanceMeters: null,
        calories: null,
        intensityMethod: "bodyweight",
        intensityValue: null,
        intensityMax: null,
        loadKg: null,
        referenceMaxKg: null,
        referenceLift: null,
        restSeconds: anchor.restSeconds,
        tempo: "controlled",
        pauseDescription: null,
        technicalIntent: anchor.technicalIntent,
        progressionObjective: anchor.progressionObjective,
        stoppingRule: anchor.stoppingRule,
        coachingCues: [spec.cue],
        scalingOptions: [
          {
            level: "scaled",
            movementId: movement.id,
            movementName: movement.name,
            prescriptionAdjustment:
              spec.durationSeconds != null
                ? "Reduce each hold to 10–15 seconds."
                : "Reduce to 6–8 controlled repetitions.",
            measurableTarget:
              "Finish every interval without losing trunk position.",
          },
        ],
        equipment: movement.equipment,
        warmupSetCount: 0,
        setupMinutes: 0,
        estimatedDurationMinutes: 1,
      };
      return {
        ...exercise,
        estimatedDurationMinutes: calculateExerciseDurationMinutes(exercise),
      };
    });
}

function createAccessoryExercise(
  input: GenerateProgramInput,
  sessionId: string,
  weekNumber: number,
  sessionNumber: 1 | 2,
): ExercisePrescription {
  const day1Ids = [
    "romanian_deadlift",
    "reverse_lunge",
    "romanian_deadlift",
    "side_plank",
    "dead_bug",
    "side_plank",
  ];
  const day2Ids = [
    "dead_bug",
    "farmer_carry",
    "side_plank",
    "farmer_carry",
    "band_face_pull",
    "dead_bug",
  ];
  const preferredMovementId =
    (sessionNumber === 1 ? day1Ids : day2Ids)[weekNumber - 1] ?? "dead_bug";
  const movementId = movementAllowed(
    preferredMovementId,
    "accessory",
    input.equipment,
    input.restrictions,
  )
    ? preferredMovementId
    : (["dead_bug", "side_plank"].find((candidate) =>
        movementAllowed(
          candidate,
          "accessory",
          input.equipment,
          input.restrictions,
        ),
      ) ?? "dead_bug");
  const movement = getMovement(movementId);
  if (!movement) throw new Error(`Unknown accessory movement ${movementId}.`);
  const isCarry = movement.familyId === "carry";
  const isHold = movement.isIsometric === true;
  const isLoaded = movement.loadable;
  const exercise: ExercisePrescription = {
    id: stableUuid(sessionId, "accessory"),
    sessionId,
    progressionTrackId: null,
    progressionStepNumber: null,
    groupId: null,
    section: "accessory",
    movementId: movement.id,
    movementName: movement.name,
    movementFamilyId: movement.familyId,
    sets: weekNumber === 6 ? 2 : 2,
    reps: isCarry || isHold ? null : 8,
    repRangeMin: isLoaded && !isCarry ? 8 : null,
    repRangeMax: isLoaded && !isCarry ? 10 : null,
    durationSeconds: isHold ? 25 : null,
    distanceMeters: isCarry ? 30 : null,
    calories: null,
    intensityMethod: isLoaded ? "rpe" : "bodyweight",
    intensityValue: isLoaded ? 5 : null,
    intensityMax: isLoaded ? 6 : null,
    loadKg: null,
    referenceMaxKg: null,
    referenceLift: null,
    restSeconds: 45,
    tempo: movement.id === "romanian_deadlift" ? "31X1" : "controlled",
    pauseDescription: null,
    technicalIntent:
      movement.familyId === "carry"
        ? "Walk tall with quiet steps and uninterrupted trunk bracing."
        : "Build resilient trunk and accessory strength without adding excessive fatigue.",
    progressionObjective: null,
    stoppingRule: null,
    coachingCues: ["Leave two technically sound repetitions in reserve."],
    scalingOptions: defaultScaling(movement.name),
    equipment: movement.equipment,
    warmupSetCount: 0,
    setupMinutes: 0.5,
    estimatedDurationMinutes: 4,
  };
  return {
    ...exercise,
    estimatedDurationMinutes: calculateExerciseDurationMinutes(exercise),
  };
}

function conditioningMovement(
  movementId: string,
  target: {
    reps?: number;
    calories?: number;
    distanceMeters?: number;
    durationSeconds?: number;
  },
): ConditioningMovement {
  const movement = getMovement(movementId);
  if (!movement)
    throw new Error(`Unknown conditioning movement ${movementId}.`);
  return {
    movementId,
    movementName: movement.name,
    movementFamilyId: movement.familyId,
    reps: target.reps ?? null,
    calories: target.calories ?? null,
    distanceMeters: target.distanceMeters ?? null,
    durationSeconds: target.durationSeconds ?? null,
    loadKg: null,
    percentageReference: null,
    equipment: movement.equipment,
  };
}

function engineMovementId(input: GenerateProgramInput, seed: string): string {
  const candidates = ["row", "bike", "ski", "run"].filter((movementId) =>
    movementAllowed(
      movementId,
      "conditioning",
      input.equipment,
      input.restrictions,
    ),
  );
  if (!candidates.length) return "run";
  return (
    candidates[seededIndex(seed, candidates.length)] ?? candidates[0] ?? "run"
  );
}

function measurableConditioningScaling(): ScalingOption[] {
  return [
    {
      level: "scaled",
      movementId: null,
      movementName: "Conditioning volume",
      prescriptionAdjustment:
        "Reduce repetitions, calories, or distance by 20%. Maintain the programmed clock.",
      measurableTarget:
        "Finish each round within the target range while staying at or below RPE 8.",
    },
  ];
}

function createConditioning(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
): ConditioningPrescription {
  const engineId = engineMovementId(input, `${variantSeed}:engine`);
  const stepUpId = movementAllowed(
    "box_step_up",
    "conditioning",
    input.equipment,
    input.restrictions,
  )
    ? "box_step_up"
    : "air_squat";
  const isMachine = engineId !== "run";
  const target = (
    value: number,
  ): { calories?: number; distanceMeters?: number } =>
    isMachine ? { calories: value } : { distanceMeters: value * 20 };
  const id = stableUuid(sessionId, "conditioning", variantSeed);
  const base = {
    id,
    sessionId,
    intervalSeconds: null,
    executionMode: null,
    stations: [],
    scalingOptions: measurableConditioningScaling(),
  };

  if (sessionNumber === 1) {
    if (week.weekNumber === 2) {
      const movements = [
        conditioningMovement(engineId, target(10)),
        conditioningMovement("push_up", { reps: 8 }),
        conditioningMovement(stepUpId, { reps: 12 }),
      ];
      return {
        ...base,
        format: "emom",
        durationMinutes: 9,
        rounds: 3,
        intervalSeconds: 60,
        executionMode: "rotate",
        stations: movements.map((movement, index) => ({
          minute: index + 1,
          movement,
        })),
        timeCapMinutes: null,
        workSeconds: null,
        restSeconds: null,
        intendedStimulus:
          "Sustainable repeatable work with at least 10 seconds available to transition each minute.",
        targetDurationMin: null,
        targetDurationMax: null,
        targetRpe: 7,
        movements,
        estimatedDurationMinutes: 9,
      };
    }
    if (week.weekNumber === 3) {
      return {
        ...base,
        format: "for_time",
        durationMinutes: null,
        rounds: 4,
        timeCapMinutes: 11,
        workSeconds: null,
        restSeconds: null,
        intendedStimulus:
          "Finish four smooth rounds without sprinting the opening round.",
        targetDurationMin: 8,
        targetDurationMax: 10,
        targetRpe: 8,
        movements: [
          conditioningMovement(engineId, target(8)),
          conditioningMovement("burpee", { reps: 6 }),
          conditioningMovement("air_squat", { reps: 12 }),
        ],
        estimatedDurationMinutes: 11,
      };
    }
    if (week.weekNumber === 5) {
      return {
        ...base,
        format: "intervals",
        durationMinutes: 9,
        rounds: 6,
        timeCapMinutes: null,
        workSeconds: 45,
        restSeconds: 45,
        intendedStimulus:
          "Repeat six aerobic-power efforts without a drop greater than 10%.",
        targetDurationMin: null,
        targetDurationMax: null,
        targetRpe: 8,
        movements: [conditioningMovement(engineId, { durationSeconds: 45 })],
        estimatedDurationMinutes: 9,
      };
    }
    if (week.weekNumber === 6) {
      return {
        ...base,
        format: "zone_2",
        durationMinutes: 10,
        rounds: null,
        timeCapMinutes: null,
        workSeconds: null,
        restSeconds: null,
        intendedStimulus:
          "Easy nasal-breathing work at RPE 4–5 for the full duration.",
        targetDurationMin: null,
        targetDurationMax: null,
        targetRpe: 5,
        movements: [conditioningMovement(engineId, { durationSeconds: 600 })],
        estimatedDurationMinutes: 10,
      };
    }
    return {
      ...base,
      format: "amrap",
      durationMinutes: week.day1ConditioningMinutes,
      rounds: null,
      timeCapMinutes: null,
      workSeconds: null,
      restSeconds: null,
      intendedStimulus:
        "Continuous mixed-modal work with unbroken movement quality at RPE 7–8.",
      targetDurationMin: null,
      targetDurationMax: null,
      targetRpe: 8,
      movements: [
        conditioningMovement(engineId, target(8)),
        conditioningMovement("burpee", { reps: 6 }),
        conditioningMovement("air_squat", { reps: 12 }),
      ],
      estimatedDurationMinutes: week.day1ConditioningMinutes,
    };
  }

  if ([1, 3].includes(week.weekNumber)) {
    const rounds = week.weekNumber === 1 ? 5 : 5;
    const workSeconds = week.weekNumber === 1 ? 90 : 120;
    const restSeconds = week.weekNumber === 1 ? 60 : 60;
    return {
      ...base,
      format: "intervals",
      durationMinutes: week.day2ConditioningMinutes,
      rounds,
      timeCapMinutes: null,
      workSeconds,
      restSeconds,
      intendedStimulus:
        "Hold an even aerobic output across every interval with less than 10% pace decay.",
      targetDurationMin: null,
      targetDurationMax: null,
      targetRpe: 7,
      movements: [
        conditioningMovement(engineId, { durationSeconds: workSeconds }),
      ],
      estimatedDurationMinutes: week.day2ConditioningMinutes,
    };
  }
  if ([5, 6].includes(week.weekNumber)) {
    const seconds = week.day2ConditioningMinutes * 60;
    return {
      ...base,
      format: "zone_2",
      durationMinutes: week.day2ConditioningMinutes,
      rounds: null,
      timeCapMinutes: null,
      workSeconds: null,
      restSeconds: null,
      intendedStimulus:
        week.weekNumber === 6
          ? "Easy conversational work at RPE 4–5 for the full duration."
          : "Steady aerobic work at RPE 6 with no late-session pace drop.",
      targetDurationMin: null,
      targetDurationMax: null,
      targetRpe: week.weekNumber === 6 ? 5 : 6,
      movements: [conditioningMovement(engineId, { durationSeconds: seconds })],
      estimatedDurationMinutes: week.day2ConditioningMinutes,
    };
  }
  return {
    ...base,
    format: "amrap",
    durationMinutes: week.day2ConditioningMinutes,
    rounds: null,
    timeCapMinutes: null,
    workSeconds: null,
    restSeconds: null,
    intendedStimulus:
      "Move continuously at RPE 7 while preserving push-up and step-up mechanics.",
    targetDurationMin: null,
    targetDurationMax: null,
    targetRpe: 7,
    movements: [
      conditioningMovement(engineId, target(10)),
      conditioningMovement(stepUpId, { reps: 12 }),
      conditioningMovement("push_up", { reps: 8 }),
    ],
    estimatedDurationMinutes: week.day2ConditioningMinutes,
  };
}

function warmupExercise(
  movementId: string,
  target: {
    reps?: number;
    durationSeconds?: number;
    distanceMeters?: number;
  },
): WarmupExercise {
  const movement = getMovement(movementId);
  if (!movement) throw new Error(`Unknown warm-up movement ${movementId}.`);
  return {
    movementId,
    movementName: movement.name,
    reps: target.reps ?? null,
    durationSeconds: target.durationSeconds ?? null,
    distanceMeters: target.distanceMeters ?? null,
    equipment: movement.equipment,
  };
}

function createWarmup(
  input: GenerateProgramInput,
  sessionId: string,
  weekNumber: number,
  sessionNumber: 1 | 2,
  variantSeed: string,
): WarmupPrescription {
  const engineId = engineMovementId(input, `${variantSeed}:warmup`);
  const engineTarget =
    engineId === "run" ? { distanceMeters: 150 } : { durationSeconds: 45 };
  const candidateExercises =
    sessionNumber === 1
      ? [
          warmupExercise(engineId, engineTarget),
          warmupExercise("air_squat", { reps: 8 }),
          warmupExercise("glute_bridge", { reps: 10 }),
          warmupExercise("pvc_pass_through", { reps: 8 }),
          warmupExercise("empty_bar_overhead_squat", { reps: 5 }),
        ]
      : [
          warmupExercise(engineId, engineTarget),
          warmupExercise("glute_bridge", { reps: 10 }),
          warmupExercise("scapular_pull_up", { reps: 6 }),
          warmupExercise("hollow_hold", { durationSeconds: 15 }),
          warmupExercise("empty_bar_clean_and_jerk", { reps: 4 }),
        ];
  const exercises = candidateExercises.filter((exercise) =>
    movementAllowed(
      exercise.movementId,
      "warmup",
      input.equipment,
      input.restrictions,
    ),
  );
  return {
    id: stableUuid(sessionId, "warmup", variantSeed),
    sessionId,
    durationMinutes: weekNumber === 6 ? 8 : 9,
    rounds: 2,
    exercises,
    purpose:
      sessionNumber === 1
        ? "Prepare squat depth, trunk bracing, overhead position, and the conditioning engine."
        : "Prepare clean-and-jerk positions, strict pulling, midline control, and the conditioning engine.",
  };
}

function unionEquipment(values: string[][]): string[] {
  return [...new Set(values.flat())];
}

function createTransitions(
  warmup: WarmupPrescription,
  exercises: ExercisePrescription[],
  conditioning: ConditioningPrescription,
): EquipmentTransition[] {
  const primary = unionEquipment(
    exercises
      .filter((item) => item.section === "primary")
      .map((item) => item.equipment),
  );
  const secondary = unionEquipment(
    exercises
      .filter((item) => item.section === "secondary")
      .map((item) => item.equipment),
  );
  const accessory = unionEquipment(
    exercises
      .filter((item) => item.section === "accessory")
      .map((item) => item.equipment),
  );
  const sequence = [
    unionEquipment(warmup.exercises.map((item) => item.equipment)),
    primary,
    secondary,
    unionEquipment(conditioning.movements.map((item) => item.equipment)),
    accessory,
  ];
  const transitions: EquipmentTransition[] = [];
  for (let index = 1; index < sequence.length; index += 1) {
    const fromEquipment = sequence[index - 1] ?? [];
    const toEquipment = sequence[index] ?? [];
    transitions.push({
      fromEquipment,
      toEquipment,
      estimatedMinutes: equipmentTransitionMinutes(fromEquipment, toEquipment),
    });
  }
  return transitions;
}

function sectionDuration(
  exercises: ExercisePrescription[],
  section: "primary" | "secondary" | "accessory",
): number {
  const selected = exercises.filter((item) => item.section === section);
  const estimate = calculateSessionDuration({
    exercises: selected,
    conditioning: null,
    equipmentTransitions: [],
    warmupMinutes: 0,
    cooldownMinutes: 0,
  });
  return Math.max(
    1,
    Math.round((estimate.workMinutes + estimate.restMinutes) * 10) / 10,
  );
}

function createSections(
  sessionId: string,
  warmup: WarmupPrescription,
  exercises: ExercisePrescription[],
  conditioning: ConditioningPrescription,
  transitions: EquipmentTransition[],
): SessionSection[] {
  const transitionMinutes =
    Math.round(
      transitions.reduce((sum, item) => sum + item.estimatedMinutes, 0) * 10,
    ) / 10;
  return [
    {
      id: stableUuid(sessionId, "section", "warmup"),
      sessionId,
      section: "warmup",
      order: 1,
      estimatedDurationMinutes: warmup.durationMinutes,
    },
    {
      id: stableUuid(sessionId, "section", "primary"),
      sessionId,
      section: "primary",
      order: 2,
      estimatedDurationMinutes: sectionDuration(exercises, "primary"),
    },
    {
      id: stableUuid(sessionId, "section", "secondary"),
      sessionId,
      section: "secondary",
      order: 3,
      estimatedDurationMinutes: sectionDuration(exercises, "secondary"),
    },
    {
      id: stableUuid(sessionId, "section", "conditioning"),
      sessionId,
      section: "conditioning",
      order: 4,
      estimatedDurationMinutes: conditioning.estimatedDurationMinutes,
    },
    {
      id: stableUuid(sessionId, "section", "accessory"),
      sessionId,
      section: "accessory",
      order: 5,
      estimatedDurationMinutes: sectionDuration(exercises, "accessory"),
    },
    {
      id: stableUuid(sessionId, "section", "transition"),
      sessionId,
      section: "transition",
      order: 6,
      estimatedDurationMinutes: transitionMinutes,
    },
  ];
}

function sessionStress(
  weekNumber: number,
  sessionNumber: 1 | 2,
  conditioningMinutes: number,
): SessionStress {
  const deload = weekNumber === 6;
  const lowerBody = deload
    ? 3
    : sessionNumber === 1
      ? weekNumber >= 4
        ? 8
        : 7
      : 5;
  const upperBody = deload ? 3 : sessionNumber === 2 ? 6 : 3;
  const grip = deload ? 3 : sessionNumber === 2 ? 6 : 4;
  const complexity = deload ? 3 : weekNumber >= 4 ? 7 : 5;
  const conditioning = deload
    ? 3
    : Math.min(8, Math.round(conditioningMinutes / 2));
  return {
    lowerBodyVolumeScore: lowerBody,
    upperBodyVolumeScore: upperBody,
    gripVolumeScore: grip,
    skillComplexityScore: complexity,
    conditioningStressScore: conditioning,
    totalStressScore: lowerBody + upperBody + grip + complexity + conditioning,
  };
}

function expectedFatigue(stress: SessionStress): "low" | "moderate" | "high" {
  if (stress.totalStressScore < 15) return "low";
  if (stress.totalStressScore >= 32) return "high";
  return "moderate";
}

function recalculateSession(session: TrainingSession): TrainingSession {
  const transitions = createTransitions(
    session.warmup,
    session.exercises,
    session.conditioning as ConditioningPrescription,
  );
  const estimate = calculateSessionDuration({
    exercises: session.exercises,
    conditioning: session.conditioning,
    equipmentTransitions: transitions,
    warmupMinutes: session.warmup.durationMinutes,
    cooldownMinutes: 0,
  });
  const sections = createSections(
    session.id,
    session.warmup,
    session.exercises,
    session.conditioning as ConditioningPrescription,
    transitions,
  );
  return {
    ...session,
    equipmentTransitions: transitions,
    sections,
    estimatedDurationMinutes: estimate.totalMinutes,
    durationValidationStatus: durationStatus(
      estimate.totalMinutes,
      session.weekNumber === 6,
    ),
  };
}

function adjustSessionToDuration(session: TrainingSession): TrainingSession {
  let next = recalculateSession(session);
  if (next.estimatedDurationMinutes <= 65) return next;

  next = recalculateSession({
    ...next,
    exercises: next.exercises.filter((item) => item.section !== "accessory"),
  });
  if (next.estimatedDurationMinutes <= 65) return next;

  if (next.conditioning && next.conditioning.estimatedDurationMinutes > 8) {
    const reducedMinutes = Math.max(
      8,
      next.conditioning.estimatedDurationMinutes - 2,
    );
    next = recalculateSession({
      ...next,
      conditioning: {
        ...next.conditioning,
        durationMinutes:
          next.conditioning.durationMinutes == null ? null : reducedMinutes,
        timeCapMinutes:
          next.conditioning.timeCapMinutes == null ? null : reducedMinutes,
        estimatedDurationMinutes: reducedMinutes,
      },
    });
  }
  if (next.estimatedDurationMinutes <= 65) return next;

  next = recalculateSession({
    ...next,
    exercises: next.exercises.map((exercise) =>
      exercise.section === "secondary" && (exercise.sets ?? 0) > 3
        ? { ...exercise, sets: (exercise.sets ?? 1) - 1 }
        : exercise,
    ),
  });
  return next;
}

function trackMapForBlock(
  blockId: string,
  createdAt: string,
): Map<ProgressionTrackType, ProgressionTrack> {
  const map = new Map<ProgressionTrackType, ProgressionTrack>();
  for (const trackType of TRACK_ORDER) {
    const templateSteps = MIXED_STRENGTH_TEMPLATE.flatMap(
      (week) => week.steps,
    ).filter((item) => item.trackType === trackType);
    if (!templateSteps.length) continue;
    const trackId = stableUuid(blockId, "track", trackType);
    const steps: ProgressionStep[] = templateSteps.map((item, index) => ({
      id: stableUuid(trackId, "step", index + 1),
      progressionTrackId: trackId,
      stepNumber: index + 1,
      weekNumber: item.weekNumber,
      movementId: item.movementId,
      movementFamilyId: item.movementFamilyId,
      sets: item.sets,
      reps: item.reps,
      repRangeMin: item.repRangeMin,
      repRangeMax: item.repRangeMax,
      intensityMethod: item.intensityMethod,
      intensityMin: item.intensityMin,
      intensityMax: item.intensityMax,
      restSeconds: item.restSeconds,
      tempo: null,
      pauseDescription: null,
      technicalIntent: item.technicalIntent,
      estimatedDurationMinutes: item.estimatedDurationMinutes,
    }));
    map.set(trackType, {
      id: trackId,
      trainingBlockId: blockId,
      trackType,
      movementFamilyId: templateSteps[0]?.movementFamilyId ?? "accessory",
      currentStep: 1,
      totalSteps: steps.length,
      status: "active",
      consecutiveFailures: 0,
      metadata: { templateVersion: TEMPLATE_VERSION },
      steps,
      createdAt,
      updatedAt: createdAt,
    });
  }
  return map;
}

function templateStepNumber(
  track: ProgressionTrack,
  weekNumber: number,
): number {
  return (
    track.steps.find((item) => item.weekNumber === weekNumber)?.stepNumber ?? 1
  );
}

function createSession(
  input: GenerateProgramInput,
  trainingWeekId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  tracks: Map<ProgressionTrackType, ProgressionTrack>,
): TrainingSession {
  const sessionId = stableUuid(trainingWeekId, "session", sessionNumber);
  const relevantSteps = week.steps.filter(
    (item) => item.sessionNumber === sessionNumber,
  );
  const exercises: ExercisePrescription[] = [];
  const assignments: TrackAssignment[] = [];
  for (const templateStep of relevantSteps) {
    const track = tracks.get(templateStep.trackType);
    if (!track) throw new Error(`Missing track ${templateStep.trackType}.`);
    const stepNumber = templateStepNumber(track, week.weekNumber);
    const exercise = createProgressionExercise(
      input,
      sessionId,
      track,
      templateStep,
      stepNumber,
    );
    exercises.push(exercise);
    if (getMovement(exercise.movementId)?.category === "gymnastics") {
      exercises.push(
        ...createGymnasticsShapeExercises(input, sessionId, exercise),
      );
    }
    assignments.push({
      progressionTrackId: track.id,
      progressionStepNumber: stepNumber,
      role: templateStep.role,
    });
  }
  exercises.push(
    createAccessoryExercise(input, sessionId, week.weekNumber, sessionNumber),
  );
  const warmup = createWarmup(
    input,
    sessionId,
    week.weekNumber,
    sessionNumber,
    input.seed ?? TEMPLATE_VERSION,
  );
  const conditioning = createConditioning(
    input,
    sessionId,
    week,
    sessionNumber,
    input.seed ?? TEMPLATE_VERSION,
  );
  const stress = sessionStress(
    week.weekNumber,
    sessionNumber,
    conditioning.estimatedDurationMinutes,
  );
  const base: TrainingSession = {
    id: sessionId,
    trainingWeekId,
    sessionNumber,
    weekNumber: week.weekNumber,
    objective:
      sessionNumber === 1
        ? "Front-squat progression and snatch development"
        : "Clean-and-jerk progression and gymnastics capacity",
    intendedStimulus:
      sessionNumber === 1
        ? "Lower-body dominant strength and precise snatch positions followed by short mixed-modal conditioning."
        : "Technical clean-and-jerk work, measurable strict gymnastics, and controlled aerobic conditioning.",
    expectedFatigue: expectedFatigue(stress),
    fatigueFocus: sessionNumber === 1 ? "lower_body" : "mixed",
    communityWorkoutAdvice:
      sessionNumber === 1
        ? "Avoid placing this session directly after a heavy squat or high-volume jumping community workout."
        : "Avoid placing this session directly after grip-intensive pulling or high-volume overhead work.",
    durationTargetMinutes:
      week.weekNumber === 6 ? 52 : sessionNumber === 1 ? 57 : 59,
    estimatedDurationMinutes: 0,
    durationValidationStatus: "within_target",
    provisional: week.weekNumber > 1,
    status: "planned",
    revision: 1,
    trackAssignments: assignments,
    warmup,
    exercises,
    conditioning,
    equipmentTransitions: [],
    sections: [],
    stress,
    feedback: null,
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
  };
  return adjustSessionToDuration(base);
}

function createSupplementalSession(
  base: TrainingSession,
  trainingWeekId: string,
  sessionNumber: number,
): TrainingSession {
  const sessionId = stableUuid(trainingWeekId, "session", sessionNumber);
  return {
    ...base,
    id: sessionId,
    trainingWeekId,
    sessionNumber,
    objective:
      sessionNumber === 3
        ? "Engine capacity and accessory strength"
        : "Gymnastics capacity and aerobic quality",
    intendedStimulus:
      sessionNumber === 3
        ? "Moderate mixed-modal conditioning with repeatable accessory strength."
        : "Measurable gymnastics volume followed by controlled aerobic work.",
    expectedFatigue: "moderate",
    fatigueFocus: sessionNumber === 3 ? "mixed" : "upper_body",
    trackAssignments: [],
    provisional: true,
    status: "planned",
    revision: 1,
    feedback: null,
    warmup: {
      ...base.warmup,
      id: stableUuid(sessionId, "warmup"),
      sessionId,
    },
    exercises: base.exercises.map((exercise, index) => ({
      ...exercise,
      id: stableUuid(sessionId, "exercise", index),
      sessionId,
    })),
    conditioning: base.conditioning
      ? {
          ...base.conditioning,
          id: stableUuid(sessionId, "conditioning"),
          sessionId,
        }
      : null,
    sections: base.sections.map((section) => ({
      ...section,
      id: stableUuid(sessionId, "section", section.order),
      sessionId,
    })),
    equipmentTransitions: base.equipmentTransitions.map((transition) => ({
      ...transition,
    })),
  };
}

export function generateMixedStrengthBlock(
  input: GenerateProgramInput,
): ProgramV2 {
  if (!input.programId || !input.generatedAt) {
    throw new Error("programId and generatedAt are required.");
  }
  const template = getV2TemplateDefinition(input.templateId);
  const sessionCount = input.sessionCount ?? 2;
  const blockId = stableUuid(input.programId, template.id);
  const tracks = trackMapForBlock(blockId, input.generatedAt);
  const weeks: TrainingWeek[] = MIXED_STRENGTH_TEMPLATE.map((weekTemplate) => {
    const trainingWeekId = stableUuid(blockId, "week", weekTemplate.weekNumber);
    const coreSessions = [
      createSession(input, trainingWeekId, weekTemplate, 1, tracks),
      createSession(input, trainingWeekId, weekTemplate, 2, tracks),
    ];
    const sessions = Array.from({ length: sessionCount }, (_, index) =>
      index < 2
        ? coreSessions[index]!
        : createSupplementalSession(
            coreSessions[index % 2]!,
            trainingWeekId,
            index + 1,
          ),
    ).filter((session): session is TrainingSession => Boolean(session));
    return {
      id: trainingWeekId,
      trainingBlockId: blockId,
      weekNumber: weekTemplate.weekNumber,
      theme: weekTemplate.theme,
      status: weekTemplate.weekNumber === 1 ? "active" : "planned",
      plannedSessionCount: sessionCount,
      sessions,
    };
  });
  const block: TrainingBlock = {
    id: blockId,
    programId: input.programId,
    blockType: input.blockType ?? template.blockType,
    templateId: template.id,
    plannedSessionCount: sessionCount,
    name: template.name,
    goal: template.goal,
    durationWeeks: 6,
    currentWeek: 1,
    status: "active",
    deloadWeek: 6,
    startedAt: input.generatedAt,
    completedAt: null,
    progressionTracks: [...tracks.values()],
    trainingWeeks: weeks,
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
  };
  const draft: ProgramV2 = {
    schemaVersion: PROGRAM_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    templateVersion: TEMPLATE_VERSION,
    catalogVersion: CATALOG_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    id: input.programId,
    ownerId: input.ownerId,
    name: template.name,
    status: "active",
    activeTrainingBlockId: blockId,
    trainingBlocks: [block],
    validation: {
      valid: false,
      validatorVersion: VALIDATOR_VERSION,
      issues: [],
    },
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
  };
  const validation = validateProgram(draft);
  return assertValidProgram({ ...draft, validation });
}

export function generateV2Program(input: GenerateProgramInput): ProgramV2 {
  return generateMixedStrengthBlock(input);
}

export function findSession(
  program: ProgramV2,
  sessionId: string,
): TrainingSession | null {
  for (const block of program.trainingBlocks) {
    for (const week of block.trainingWeeks) {
      const session = week.sessions.find((item) => item.id === sessionId);
      if (session) return session;
    }
  }
  return null;
}

export function replaceSession(
  program: ProgramV2,
  replacement: TrainingSession,
): ProgramV2 {
  return {
    ...program,
    trainingBlocks: program.trainingBlocks.map((block) => ({
      ...block,
      trainingWeeks: block.trainingWeeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((session) =>
          session.id === replacement.id ? replacement : session,
        ),
      })),
    })),
  };
}

export const internalEngine = Object.freeze({
  adjustSessionToDuration,
  createAccessoryExercise,
  createConditioning,
  createProgressionExercise,
  createWarmup,
  recalculateSession,
});
