import { getMovement, movementAllowed } from "./catalog";
import {
  calculateExerciseDurationMinutes,
  calculateSessionDuration,
  calculateWorkingWeight,
  durationStatus,
  equipmentTransitionMinutes,
} from "./duration";
import {
  TRACK_ORDER,
  getV2ProgrammeTemplate,
  getV2TemplateDefinition,
  type MixedStrengthWeekTemplate,
  type TemplateProgressionStep,
} from "./template";
import {
  buildStrictStrengthWeekTemplates,
  buildProfileWeekTemplates,
  createProgrammeGenerationSummary,
  createProgrammeProfile,
} from "./profile";
import type {
  ConditioningMovement,
  ConditioningPrescription,
  EquipmentTransition,
  ExercisePrescription,
  GenerateProgramInput,
  GenerationRequest,
  MovementFamilyId,
  OpenWorkoutMetadata,
  ProgramV2,
  ProgrammeProfile,
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
  buildMaxTestPrescription,
  calculateMaxTestEligibility,
  calculateTrainingMax,
  defaultTestType,
} from "./max-testing";
import {
  CATALOG_VERSION,
  ENGINE_VERSION,
  PROGRAM_SCHEMA_VERSION,
  TEMPLATE_VERSION,
  VALIDATOR_VERSION,
} from "./types";
import {
  assertValidGeneratedProgram,
  validateGeneratedProgram,
} from "./validation";
import { calibrateConditioningPrescription } from "./conditioning";

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

function maxForMovement(
  input: GenerateProgramInput,
  movementId: string,
  trackType: ProgressionTrackType,
): number | null {
  const value =
    movementId === "front_squat" || trackType === "front_squat"
      ? input.maxes.front_squat
      : movementId === "back_squat" || trackType === "back_squat"
        ? input.maxes.back_squat
        : movementId === "deadlift" || trackType === "hinge"
          ? input.maxes.deadlift
          : movementId === "snatch" ||
              movementId.includes("snatch") ||
              trackType === "snatch"
            ? input.maxes.snatch
            : movementId.includes("clean_and_jerk") ||
                trackType === "clean_and_jerk"
              ? input.maxes.clean_and_jerk
              : movementId === "strict_press" ||
                  trackType === "upper_body_press"
                ? input.maxes.strict_press
                : null;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function referenceLift(
  movementId: string,
  trackType: ProgressionTrackType,
): string | null {
  if (movementId === "front_squat" || trackType === "front_squat")
    return "front squat";
  if (movementId === "back_squat" || trackType === "back_squat")
    return "back squat";
  if (movementId === "deadlift" || trackType === "hinge") return "deadlift";
  if (movementId.includes("snatch") || trackType === "snatch") return "snatch";
  if (movementId.includes("clean_and_jerk") || trackType === "clean_and_jerk")
    return "clean and jerk";
  if (movementId === "strict_press" || trackType === "upper_body_press")
    return "strict press";
  return null;
}

function fallbackRpe(intensityMin: number | null): [number, number] {
  if (intensityMin == null || intensityMin <= 65) return [5, 6];
  if (intensityMin <= 75) return [6, 7];
  if (intensityMin <= 85) return [7, 8];
  return [8, 8];
}

function gymnasticsScaling(
  movementFamilyId: MovementFamilyId,
  strictStrength = false,
): ScalingOption[] {
  if (!strictStrength) {
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
  if (movementFamilyId === "handstand") {
    return [
      {
        level: "scaled",
        movementId: "floor_pike_handstand_push_up",
        movementName: "Floor pike handstand push-up",
        prescriptionAdjustment:
          "Use the same sets and reps with a floor pike variation.",
        measurableTarget:
          "Keep two technically sound repetitions in reserve in every set.",
      },
    ];
  }
  if (movementFamilyId === "horizontal_press") {
    return [
      {
        level: "scaled",
        movementId: "ring_support_hold",
        movementName: "Ring support hold",
        prescriptionAdjustment:
          "Replace dip repetitions with a 20–30 second stable ring support hold.",
        measurableTarget:
          "Maintain locked elbows and controlled shoulders for the full hold.",
      },
    ];
  }
  return [
    {
      level: "scaled",
      movementId: "eccentric_pull_up",
      movementName: "Eccentric pull-up",
      prescriptionAdjustment:
        "Replace strict or weighted pull-ups with controlled 5-second eccentric repetitions.",
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
  programmeType = "mixed_strength_6w",
): ExercisePrescription {
  const movement = getMovement(templateStep.movementId);
  if (!movement) {
    throw new Error(`Unknown template movement ${templateStep.movementId}.`);
  }
  if (
    !movementAllowed(
      movement.id,
      [
        "gymnastics_capacity_6w",
        "open_preparation_6w",
        "masters_open_preparation_6w",
      ].includes(programmeType) && movement.category === "gymnastics"
        ? "secondary"
        : templateStep.role,
      input.equipment,
      input.restrictions,
    )
  ) {
    throw new Error(
      `REQUIRED_MOVEMENT_UNAVAILABLE: ${movement.name} is unavailable for the mixed-strength template.`,
    );
  }

  const referenceMaxKg = maxForMovement(
    input,
    templateStep.movementId,
    templateStep.trackType,
  );
  let intensityMethod = templateStep.intensityMethod;
  let intensityValue = templateStep.intensityMin;
  let intensityMax = templateStep.intensityMax;
  let loadKg: number | null = null;
  const reference = referenceLift(
    templateStep.movementId,
    templateStep.trackType,
  );
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
      programmeType === "strict_strength_8w" &&
      ["strict_pull", "handstand", "horizontal_press"].includes(
        movement.familyId,
      )
        ? gymnasticsScaling(movement.familyId, true)
        : movement.category === "gymnastics"
          ? gymnasticsScaling(movement.familyId)
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
  programmeType = "mixed_strength_6w",
): ExercisePrescription {
  const defaultDay1Ids = [
    "romanian_deadlift",
    "reverse_lunge",
    "romanian_deadlift",
    "side_plank",
    "dead_bug",
    "side_plank",
  ];
  const defaultDay2Ids = [
    "dead_bug",
    "farmer_carry",
    "side_plank",
    "farmer_carry",
    "band_face_pull",
    "dead_bug",
  ];
  const gymnasticsIds = [
    "band_face_pull",
    "farmer_carry",
    "dead_bug",
    "side_plank",
    "band_face_pull",
    "farmer_carry",
    "dead_bug",
    "side_plank",
  ];
  const strengthIds = [
    "reverse_lunge",
    "farmer_carry",
    "side_plank",
    "reverse_lunge",
    "dead_bug",
    "farmer_carry",
    "side_plank",
    "dead_bug",
  ];
  const strictStrengthDay1Ids = [
    "band_face_pull",
    "side_plank",
    "band_face_pull",
    "dead_bug",
    "band_face_pull",
    "side_plank",
    "dead_bug",
    "side_plank",
  ];
  const strictStrengthDay2Ids = [
    "dead_bug",
    "band_face_pull",
    "side_plank",
    "dead_bug",
    "band_face_pull",
    "side_plank",
    "dead_bug",
    "side_plank",
  ];
  const olympicDay1Ids = [
    "side_plank",
    "snatch_pull",
    "snatch_pull",
    "farmer_carry",
    "snatch_pull",
    "snatch_pull",
    "side_plank",
    "dead_bug",
  ];
  const olympicDay2Ids = [
    "dead_bug",
    "clean_pull",
    "clean_pull",
    "side_plank",
    "clean_pull",
    "clean_pull",
    "farmer_carry",
    "dead_bug",
  ];
  const selectedIds =
    programmeType === "strict_strength_8w"
      ? sessionNumber === 1
        ? strictStrengthDay1Ids
        : strictStrengthDay2Ids
      : programmeType === "gymnastics_capacity_6w"
        ? gymnasticsIds
        : programmeType === "strength_development_profile"
          ? strengthIds
          : programmeType === "olympic_lifting_6w"
            ? sessionNumber === 1
              ? olympicDay1Ids
              : olympicDay2Ids
            : sessionNumber === 1
              ? defaultDay1Ids
              : defaultDay2Ids;
  const preferredMovementId = selectedIds[weekNumber - 1] ?? "dead_bug";
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
  const isOlympicPull = ["snatch_pull", "clean_pull"].includes(movement.id);
  const pullTrackType =
    movement.id === "snatch_pull" ? "snatch" : "clean_and_jerk";
  const pullReferenceMax = isOlympicPull
    ? maxForMovement(input, movement.id, pullTrackType)
    : null;
  const pullReferenceLift = isOlympicPull
    ? referenceLift(movement.id, pullTrackType)
    : null;
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
    sets: isOlympicPull
      ? weekNumber === 8
        ? 2
        : 3
      : programmeType === "strict_strength_8w" && weekNumber >= 7
        ? 1
        : 2,
    reps: isCarry || isHold ? null : isOlympicPull ? 3 : 8,
    repRangeMin: isLoaded && !isCarry && !isOlympicPull ? 8 : null,
    repRangeMax: isLoaded && !isCarry && !isOlympicPull ? 10 : null,
    durationSeconds: isHold ? 25 : null,
    distanceMeters: isCarry ? 30 : null,
    calories: null,
    intensityMethod:
      isOlympicPull && pullReferenceMax != null
        ? "percentage_1rm"
        : isLoaded
          ? "rpe"
          : "bodyweight",
    intensityValue:
      isOlympicPull && pullReferenceMax != null ? 85 : isLoaded ? 5 : null,
    intensityMax:
      isOlympicPull && pullReferenceMax != null ? 95 : isLoaded ? 6 : null,
    loadKg:
      isOlympicPull && pullReferenceMax != null
        ? calculateWorkingWeight({
            maxKg: pullReferenceMax,
            percentage: 85,
            incrementKg: input.weightIncrementKg,
            roundingMode: input.roundingMode,
          })
        : null,
    referenceMaxKg: pullReferenceMax,
    referenceLift: pullReferenceLift,
    restSeconds: isOlympicPull ? 75 : 45,
    tempo: movement.id === "romanian_deadlift" ? "31X1" : "controlled",
    pauseDescription: null,
    technicalIntent: isOlympicPull
      ? "Finish the pull vertically with the bar close and keep every repetition technically repeatable."
      : movement.familyId === "carry"
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

function isRecoveryWeek(week: MixedStrengthWeekTemplate): boolean {
  return /deload|taper|retest|testing|readiness/i.test(week.theme);
}

function createOpenPreparationConditioning(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
): ConditioningPrescription {
  const engineId = engineMovementId(input, `${variantSeed}:open-engine`);
  const id = stableUuid(sessionId, "conditioning", "open", variantSeed);
  const base = {
    id,
    sessionId,
    intervalSeconds: null,
    executionMode: null,
    stations: [],
    scalingOptions: measurableConditioningScaling(),
  };
  const competitionMetadata: OpenWorkoutMetadata = {
    competitionStyle: true,
    movementStandards: [
      "Start each repetition from a controlled, complete position.",
      "Stop or scale when range of motion or rep quality changes.",
    ],
    pacingPlan: [
      "Keep the opening third below RPE 8 and hold consistent round splits.",
      "Start the next movement within 8 seconds of the prior movement.",
    ],
    setStrategy: [
      "Use repeatable submaximal sets; do not chase an early unbroken score.",
      "Break before technical failure and resume on the planned interval.",
    ],
    transitionGoals: [
      "Practise equipment setup and calm transitions under fatigue.",
    ],
    scoreType: week.weekNumber >= 4 ? "rounds_reps" : "time",
    targetScoreGuidance:
      "Record the score, split consistency, and any scaled movements.",
    tieBreakPoints:
      week.weekNumber === 4
        ? ["Record the time to the first completed round."]
        : [],
  };
  const engineTarget =
    engineId === "run" ? { distanceMeters: 160 } : { calories: 8 };

  if (isRecoveryWeek(week)) {
    const durationMinutes = Math.min(
      14,
      sessionNumber === 1
        ? week.day1ConditioningMinutes
        : week.day2ConditioningMinutes,
    );
    return {
      ...base,
      format: "intervals",
      durationMinutes,
      rounds: 4,
      workSeconds: 30,
      restSeconds: 90,
      timeCapMinutes: null,
      intendedStimulus:
        "Freshness primer: easy repeatable efforts with no soreness or grip failure.",
      targetDurationMin: 6,
      targetDurationMax: durationMinutes,
      targetRpe: 5,
      movements: [conditioningMovement(engineId, { durationSeconds: 30 })],
      estimatedDurationMinutes: durationMinutes,
      competitionMetadata,
    };
  }

  if (sessionNumber === 1) {
    const simulation = week.weekNumber >= 4;
    const movements = simulation
      ? [
          conditioningMovement(engineId, engineTarget),
          conditioningMovement("hang_clean_and_jerk", { reps: 6 }),
          conditioningMovement("burpee", { reps: 8 }),
        ]
      : [
          conditioningMovement(engineId, engineTarget),
          conditioningMovement("hanging_knee_raise", { reps: 8 }),
          conditioningMovement("burpee", { reps: 6 }),
        ];
    return {
      ...base,
      format: simulation ? "for_time" : "amrap",
      durationMinutes: simulation ? null : week.day1ConditioningMinutes,
      rounds: simulation ? 5 : null,
      timeCapMinutes: simulation ? 18 : null,
      workSeconds: null,
      restSeconds: null,
      intendedStimulus: simulation
        ? "Open simulation: practise standards, pacing, transitions, and score recording under controlled fatigue."
        : "Open-style mixed-modal work with gymnastics efficiency and moderate barbell cycling.",
      targetDurationMin: simulation ? 10 : 10,
      targetDurationMax: simulation ? 18 : 14,
      targetRpe: 8,
      movements,
      estimatedDurationMinutes: simulation
        ? week.weekNumber === 5
          ? 18
          : 14
        : week.day1ConditioningMinutes,
      competitionMetadata,
    };
  }

  const repeatable = [
    conditioningMovement(engineId, { durationSeconds: 60 }),
    conditioningMovement("hang_clean_and_jerk", { reps: 6 }),
    conditioningMovement("push_up", { reps: 8 }),
  ];
  return {
    ...base,
    format: "intervals",
    durationMinutes: week.day2ConditioningMinutes,
    rounds: week.weekNumber === 5 ? 4 : 5,
    timeCapMinutes: null,
    workSeconds: 120,
    restSeconds: 60,
    intendedStimulus:
      "Repeatable capacity: practise barbell cycling and gymnastics without degradation between efforts.",
    targetDurationMin: null,
    targetDurationMax: null,
    targetRpe: isRecoveryWeek(week) ? 5 : 7,
    movements: repeatable,
    estimatedDurationMinutes: week.day2ConditioningMinutes,
    competitionMetadata,
  };
}

function createCompetitionConditioning(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
): ConditioningPrescription {
  const engineId = engineMovementId(input, `${variantSeed}:competition-engine`);
  const id = stableUuid(sessionId, "conditioning", "competition", variantSeed);
  const base = {
    id,
    sessionId,
    intervalSeconds: null,
    executionMode: null,
    stations: [],
    scalingOptions: measurableConditioningScaling(),
    competitionMetadata: {
      competitionStyle: true,
      movementStandards: [
        "Complete every repetition to the stated competition range of motion.",
        "Record loads, times, and event scores before starting the next event.",
      ],
      pacingPlan: [
        "Open the first event below maximal effort so later events remain executable.",
        "Keep event transitions deliberate and under 90 seconds when possible.",
      ],
      setStrategy: [
        "Use heavier, planned sets for lifting events and sustainable sets for conditioning events.",
      ],
      transitionGoals: [
        "Practise moving from lifting to mixed-modal work without losing setup quality.",
      ],
      scoreType: "time" as const,
      targetScoreGuidance:
        "Record each event separately and review recovery between events.",
      tieBreakPoints:
        week.weekNumber === 5
          ? ["Record the finish time of the first event."]
          : [],
    },
  };
  const machineTarget =
    engineId === "run" ? { distanceMeters: 200 } : { calories: 10 };
  const eventOne = [
    conditioningMovement(engineId, machineTarget),
    conditioningMovement("hang_clean_and_jerk", { reps: 5 }),
    conditioningMovement("burpee", { reps: 8 }),
  ];
  const eventTwo = [
    conditioningMovement("hang_power_snatch", { reps: 5 }),
    conditioningMovement("box_step_up", { reps: 10 }),
    conditioningMovement(engineId, { durationSeconds: 60 }),
  ];
  if (isRecoveryWeek(week)) {
    const durationMinutes = Math.min(
      14,
      sessionNumber === 1
        ? week.day1ConditioningMinutes
        : week.day2ConditioningMinutes,
    );
    return {
      ...base,
      format: "intervals",
      durationMinutes,
      rounds: 3,
      workSeconds: 30,
      restSeconds: 90,
      timeCapMinutes: null,
      intendedStimulus:
        "Taper: retain event rhythm and technical speed without accumulating fatigue.",
      targetDurationMin: 6,
      targetDurationMax: durationMinutes,
      targetRpe: 5,
      movements: [conditioningMovement(engineId, { durationSeconds: 30 })],
      estimatedDurationMinutes: durationMinutes,
    };
  }
  if (sessionNumber === 1) {
    return {
      ...base,
      format:
        week.weekNumber === 2
          ? "emom"
          : week.weekNumber === 3
            ? "amrap"
            : "for_time",
      durationMinutes:
        week.weekNumber === 2 ? 12 : week.weekNumber === 3 ? 14 : null,
      rounds: week.weekNumber === 3 ? null : week.weekNumber === 2 ? 4 : 4,
      timeCapMinutes:
        week.weekNumber === 2 || week.weekNumber === 3
          ? null
          : week.weekNumber === 5
            ? 18
            : 14,
      workSeconds: week.weekNumber === 2 ? 45 : null,
      restSeconds: week.weekNumber === 2 ? 45 : null,
      intervalSeconds: week.weekNumber === 2 ? 60 : null,
      executionMode: week.weekNumber === 2 ? "rotate" : null,
      stations:
        week.weekNumber === 2
          ? eventOne.map((movement, index) => ({ minute: index + 1, movement }))
          : [],
      intendedStimulus:
        "Competition event: heavier lifting, event standards, and mixed-modal output with a recorded score.",
      targetDurationMin: 8,
      targetDurationMax: week.weekNumber === 5 ? 18 : 14,
      targetRpe: 8,
      movements: eventOne,
      estimatedDurationMinutes:
        week.weekNumber === 5
          ? 18
          : week.weekNumber === 2
            ? 12
            : week.weekNumber === 3
              ? 14
              : 14,
    };
  }
  return {
    ...base,
    format: week.weekNumber === 3 ? "for_time" : "intervals",
    durationMinutes: week.day2ConditioningMinutes,
    rounds: week.weekNumber === 3 ? 3 : 5,
    timeCapMinutes: week.weekNumber === 3 ? 12 : null,
    workSeconds: week.weekNumber === 3 ? null : 90,
    restSeconds: week.weekNumber === 3 ? null : 60,
    intendedStimulus:
      "Second event: Olympic-lifting, sprint, or endurance emphasis with recovery between efforts.",
    targetDurationMin: null,
    targetDurationMax: null,
    targetRpe: 7,
    movements: eventTwo,
    estimatedDurationMinutes: week.day2ConditioningMinutes,
  };
}

function createMastersOpenConditioning(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
): ConditioningPrescription {
  const base = createOpenPreparationConditioning(
    input,
    sessionId,
    week,
    sessionNumber,
    `${variantSeed}:masters`,
  );
  return {
    ...base,
    id: stableUuid(sessionId, "conditioning", "masters", variantSeed),
    format: sessionNumber === 1 ? "intervals" : "amrap",
    restSeconds:
      sessionNumber === 1
        ? Math.max(60, base.restSeconds ?? 60)
        : base.restSeconds,
    rounds:
      base.rounds == null ? null : Math.max(2, Math.ceil(base.rounds * 0.75)),
    durationMinutes:
      base.durationMinutes == null
        ? null
        : isRecoveryWeek(week)
          ? base.durationMinutes
          : Math.max(7, Math.round(base.durationMinutes * 0.75)),
    timeCapMinutes:
      base.timeCapMinutes == null
        ? null
        : Math.max(
            base.targetDurationMax ?? 0,
            10,
            Math.round(base.timeCapMinutes * 0.8),
          ),
    workSeconds:
      base.workSeconds == null ? null : Math.min(90, base.workSeconds),
    targetRpe: Math.min(7, base.targetRpe ?? 6),
    intendedStimulus:
      "Masters repeatability: controlled fatigue, lower impact, reduced grip accumulation, and deliberate recovery.",
    estimatedDurationMinutes: base.estimatedDurationMinutes,
    competitionMetadata: base.competitionMetadata
      ? {
          ...base.competitionMetadata,
          pacingPlan: [
            ...base.competitionMetadata.pacingPlan,
            "Use the recovery interval fully; do not accumulate shoulder or grip fatigue.",
          ],
          transitionGoals: [
            ...base.competitionMetadata.transitionGoals,
            "Prefer step-ups and controlled transitions when impact or recovery is limited.",
          ],
          targetScoreGuidance:
            "Record the score together with recovery quality, shoulder response, and scaling used.",
        }
      : null,
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

function createStrictStrengthConditioning(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
): ConditioningPrescription {
  const candidates =
    sessionNumber === 1
      ? ["bike", "run", "row"]
      : ["run", "bike", "row", "ski"];
  const engineId =
    candidates.find((movementId) =>
      movementAllowed(
        movementId,
        "conditioning",
        input.equipment,
        input.restrictions,
      ),
    ) ?? "run";
  const isMachine = engineId !== "run";
  const engineTarget = isMachine ? { calories: 8 } : { distanceMeters: 160 };
  const lowerBodyId = movementAllowed(
    "box_step_up",
    "conditioning",
    input.equipment,
    input.restrictions,
  )
    ? "box_step_up"
    : "air_squat";
  const durationMinutes =
    sessionNumber === 1
      ? week.day1ConditioningMinutes
      : week.day2ConditioningMinutes;
  return {
    id: stableUuid(sessionId, "conditioning", "strict-strength", variantSeed),
    sessionId,
    format: week.weekNumber === 8 ? "zone_2" : "amrap",
    durationMinutes,
    rounds: null,
    intervalSeconds: null,
    executionMode: null,
    stations: [],
    timeCapMinutes: null,
    workSeconds: null,
    restSeconds: null,
    intendedStimulus:
      week.weekNumber === 8
        ? "Easy conversational cyclical work at RPE 4–5 after the benchmark."
        : "Continuous lower-body-dominant conditioning at RPE 6–7 without adding vertical pulling, pressing, or grip fatigue.",
    targetDurationMin: null,
    targetDurationMax: null,
    targetRpe: week.weekNumber === 8 ? 5 : 7,
    movements:
      week.weekNumber === 8
        ? [
            conditioningMovement(engineId, {
              durationSeconds: durationMinutes * 60,
            }),
          ]
        : [
            conditioningMovement(engineId, engineTarget),
            conditioningMovement(lowerBodyId, { reps: 12 }),
          ],
    scalingOptions: measurableConditioningScaling(),
    estimatedDurationMinutes: durationMinutes,
  };
}

function createConditioningDraft(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
  programmeType = "mixed_strength_6w",
): ConditioningPrescription {
  if (programmeType === "strict_strength_8w") {
    return createStrictStrengthConditioning(
      input,
      sessionId,
      week,
      sessionNumber,
      variantSeed,
    );
  }
  if (programmeType === "competition_preparation_6w") {
    return createCompetitionConditioning(
      input,
      sessionId,
      week,
      sessionNumber,
      variantSeed,
    );
  }
  if (programmeType === "open_preparation_6w") {
    return createOpenPreparationConditioning(
      input,
      sessionId,
      week,
      sessionNumber,
      variantSeed,
    );
  }
  if (programmeType === "masters_open_preparation_6w") {
    return createMastersOpenConditioning(
      input,
      sessionId,
      week,
      sessionNumber,
      variantSeed,
    );
  }
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
    if (isRecoveryWeek(week)) {
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
  if (week.weekNumber === 5 || isRecoveryWeek(week)) {
    const seconds = week.day2ConditioningMinutes * 60;
    return {
      ...base,
      format: "zone_2",
      durationMinutes: week.day2ConditioningMinutes,
      rounds: null,
      timeCapMinutes: null,
      workSeconds: null,
      restSeconds: null,
      intendedStimulus: isRecoveryWeek(week)
        ? "Easy conversational work at RPE 4–5 for the full duration."
        : "Steady aerobic work at RPE 6 with no late-session pace drop.",
      targetDurationMin: null,
      targetDurationMax: null,
      targetRpe: isRecoveryWeek(week) ? 5 : 6,
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

function createConditioning(
  input: GenerateProgramInput,
  sessionId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  variantSeed: string,
  programmeType = "mixed_strength_6w",
): ConditioningPrescription {
  for (
    let generationAttempt = 0;
    generationAttempt < 2;
    generationAttempt += 1
  ) {
    const seed =
      generationAttempt === 0 ? variantSeed : `${variantSeed}:regenerated`;
    const conditioning = calibrateConditioningPrescription(
      createConditioningDraft(
        input,
        sessionId,
        week,
        sessionNumber,
        seed,
        programmeType,
      ),
      { level: input.athleteLevel },
    );
    if (
      !conditioning.stimulusValidation ||
      conditioning.stimulusValidation.valid
    ) {
      return conditioning;
    }
  }
  throw new Error(
    `Unable to calibrate conditioning for week ${week.weekNumber}, session ${sessionNumber}.`,
  );
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
  programmeType = "mixed_strength_6w",
): WarmupPrescription {
  const engineId = engineMovementId(input, `${variantSeed}:warmup`);
  const engineTarget =
    engineId === "run" ? { distanceMeters: 150 } : { durationSeconds: 45 };
  const candidateExercises =
    programmeType === "strict_strength_8w"
      ? [
          warmupExercise(engineId, engineTarget),
          warmupExercise("scapular_pull_up", { reps: 6 }),
          warmupExercise("hollow_hold", { durationSeconds: 15 }),
          warmupExercise("pvc_pass_through", { reps: 8 }),
          warmupExercise(
            weekNumber % 2 === 0 ? "empty_bar_overhead_squat" : "glute_bridge",
            { reps: weekNumber % 2 === 0 ? 5 : 10 },
          ),
        ]
      : programmeType === "gymnastics_capacity_6w"
        ? [
            warmupExercise(engineId, engineTarget),
            warmupExercise("scapular_pull_up", { reps: 6 }),
            warmupExercise("hollow_hold", { durationSeconds: 15 }),
            warmupExercise("glute_bridge", { reps: 10 }),
            warmupExercise("push_up", { reps: 6 }),
          ]
        : programmeType === "endurance_capacity_6w"
          ? [
              warmupExercise(engineId, engineTarget),
              warmupExercise("glute_bridge", { reps: 10 }),
              warmupExercise("air_squat", { reps: 8 }),
              warmupExercise("burpee", { reps: 4 }),
              warmupExercise("push_up", { reps: 6 }),
            ]
          : programmeType === "strength_development_profile"
            ? [
                warmupExercise(engineId, engineTarget),
                warmupExercise("glute_bridge", { reps: 10 }),
                warmupExercise("air_squat", { reps: 8 }),
                warmupExercise("pvc_pass_through", { reps: 8 }),
                warmupExercise("scapular_pull_up", { reps: 6 }),
              ]
            : sessionNumber === 1
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
    durationMinutes:
      programmeType === "strict_strength_8w"
        ? weekNumber === 8
          ? 7
          : 8
        : weekNumber === 6
          ? 8
          : 9,
    rounds: 2,
    exercises,
    purpose:
      programmeType === "strict_strength_8w"
        ? "Prepare scapular control, hollow-body tension, shoulders, and strict pulling and pressing positions."
        : programmeType === "gymnastics_capacity_6w"
          ? "Prepare pulling mechanics, hollow-body control, shoulders, and inversion positions."
          : programmeType === "endurance_capacity_6w"
            ? "Raise body temperature and prepare sustainable cyclical and mixed-modal movement."
            : programmeType === "strength_development_profile"
              ? "Prepare bracing, squat and hinge positions, shoulders, and strict pulling."
              : sessionNumber === 1
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
  if (!selected.length) return 0;
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
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  conditioningMinutes: number,
): SessionStress {
  const deload = isRecoveryWeek(week);
  const lowerBody = deload
    ? 3
    : sessionNumber === 1
      ? week.weekNumber >= 4
        ? 8
        : 7
      : 5;
  const upperBody = deload ? 3 : sessionNumber === 2 ? 6 : 3;
  const grip = deload ? 3 : sessionNumber === 2 ? 6 : 4;
  const complexity = deload ? 3 : week.weekNumber >= 4 ? 7 : 5;
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
  let sections = createSections(
    session.id,
    session.warmup,
    session.exercises,
    session.conditioning as ConditioningPrescription,
    transitions,
  );
  const sectionTotal = sections.reduce(
    (total, section) => total + section.estimatedDurationMinutes,
    0,
  );
  const sectionDelta = estimate.totalMinutes - sectionTotal;
  if (Math.abs(sectionDelta) > 0.1) {
    let remainingDelta = sectionDelta;
    sections = [...sections];
    for (
      let index = sections.length - 1;
      index >= 0 && Math.abs(remainingDelta) > 0.1;
      index -= 1
    ) {
      const section = sections[index]!;
      const adjustedDuration = Math.max(
        0,
        section.estimatedDurationMinutes + remainingDelta,
      );
      remainingDelta -= adjustedDuration - section.estimatedDurationMinutes;
      sections[index] = {
        ...section,
        estimatedDurationMinutes: adjustedDuration,
      };
    }
  }
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

function adjustSessionToDuration(
  session: TrainingSession,
  maximumMinutes = 65,
): TrainingSession {
  let next = recalculateSession(session);
  if (next.estimatedDurationMinutes <= maximumMinutes) return next;

  next = recalculateSession({
    ...next,
    exercises: next.exercises.filter((item) => item.section !== "accessory"),
  });
  if (next.estimatedDurationMinutes <= maximumMinutes) return next;

  next = recalculateSession({
    ...next,
    exercises: next.exercises.map((exercise) =>
      exercise.section === "secondary" && (exercise.sets ?? 0) > 3
        ? { ...exercise, sets: (exercise.sets ?? 1) - 1 }
        : exercise,
    ),
  });
  if (maximumMinutes < 65) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (next.estimatedDurationMinutes <= maximumMinutes) break;
      next = recalculateSession({
        ...next,
        exercises: next.exercises.map((exercise) =>
          exercise.section === "secondary" && (exercise.sets ?? 0) > 2
            ? { ...exercise, sets: (exercise.sets ?? 1) - 1 }
            : exercise,
        ),
      });
    }
  }
  return next;
}

function trackMapForBlock(
  blockId: string,
  createdAt: string,
  weekTemplates: ReadonlyArray<MixedStrengthWeekTemplate>,
): Map<ProgressionTrackType, ProgressionTrack> {
  const map = new Map<ProgressionTrackType, ProgressionTrack>();
  for (const trackType of TRACK_ORDER) {
    const templateSteps = weekTemplates
      .flatMap((week) => week.steps)
      .filter((item) => item.trackType === trackType);
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

function sessionObjective(programmeType: string, sessionNumber: 1 | 2): string {
  const objectives: Record<string, [string, string]> = {
    mixed_strength_6w: [
      "Front-squat progression and snatch development",
      "Clean-and-jerk progression and gymnastics capacity",
    ],
    general_crossfit_6w: [
      "General CrossFit strength and mixed-modal capacity",
      "General CrossFit skill density and aerobic conditioning",
    ],
    masters_open_6w: [
      "Durable squat strength and controlled Olympic-lift technique",
      "Masters/Open repeatability, gymnastics control, and aerobic capacity",
    ],
    masters_open_preparation_six_week: [
      "Open-specific mixed-modal test, gymnastics standards, and controlled barbell cycling",
      "Repeatability intervals, pacing practice, and recovery-aware capacity",
    ],
    competition_preparation_6w: [
      "Strength event and Olympic-lifting competition readiness",
      "Multiple event styles, recovery, and mixed-modal performance",
    ],
    open_preparation_6w: [
      "Open baseline, pacing, and gymnastics under fatigue",
      "Open simulation, barbell cycling, and repeat intervals",
    ],
    masters_open_preparation_6w: [
      "Masters baseline, controlled fatigue, and movement standards",
      "Masters repeatability, recovery management, and taper readiness",
    ],
    olympic_lifting_6w: [
      "Snatch positions, receiving strength, and barbell speed",
      "Clean-and-jerk technique, pulls, and overhead stability",
    ],
    endurance_capacity_6w: [
      "Aerobic-support strength with sustainable mixed-modal work",
      "Engine development with low-fatigue technical lifting",
    ],
    gymnastics_capacity_6w: [
      "Vertical pulling, toes-to-bar technique, and gymnastics density",
      "Handstand pressing, strict press support, and trunk control",
    ],
    strict_strength_8w: [
      "Strict pull-up strength, strict press, and upper-back control",
      "Strict HSPU strength, dip strength, and submaximal pulling volume",
    ],
    strength_development_profile: [
      "Squat and hinge strength progression",
      "Strict pressing and weighted pulling strength",
    ],
  };
  const selected = objectives[programmeType] || objectives.mixed_strength_6w!;
  return selected[sessionNumber - 1] ?? selected[0]!;
}

function sessionStimulus(programmeType: string, sessionNumber: 1 | 2): string {
  if (programmeType === "olympic_lifting_6w") {
    return sessionNumber === 1
      ? "Technical snatch practice with positional strength and short recovery-aware conditioning."
      : "Clean-and-jerk practice with pulling strength and precise overhead positions.";
  }
  if (programmeType === "endurance_capacity_6w") {
    return "Low-to-moderate strength volume supporting repeatable aerobic output and controlled pacing.";
  }
  if (programmeType === "gymnastics_capacity_6w") {
    return "Strict gymnastics quality, stable positions, and measurable submaximal capacity.";
  }
  if (programmeType === "strict_strength_8w") {
    return sessionNumber === 1
      ? "Heavy but repeatable strict pulling and pressing with 1–3 reps in reserve."
      : "Controlled gymnastics strength without kipping, failure, or conflicting upper-body conditioning.";
  }
  if (programmeType === "strength_development_profile") {
    return "Planned compound-strength loading with full rest and technically repeatable repetitions.";
  }
  if (programmeType === "masters_open_6w") {
    return "Durable strength and competition preparation with controlled fatigue and recovery-aware conditioning.";
  }
  if (programmeType === "masters_open_preparation_six_week") {
    return sessionNumber === 1
      ? "Competition-specific Open work with pacing, movement standards, transitions, and barbell cycling."
      : "Repeatable Open capacity with gymnastics under fatigue, controlled recovery, and score-focused execution.";
  }
  if (programmeType === "competition_preparation_6w") {
    return sessionNumber === 1
      ? "Competition event preparation with heavier lifting, standards, and mixed-modal output."
      : "Event diversity with Olympic lifting, sprint or endurance work, and recovery between efforts.";
  }
  if (programmeType === "open_preparation_6w") {
    return sessionNumber === 1
      ? "Open pacing, movement standards, gymnastics under fatigue, and transitions."
      : "Open repeatability with barbell cycling, controlled gymnastics volume, and recovery intervals.";
  }
  if (programmeType === "masters_open_preparation_6w") {
    return sessionNumber === 1
      ? "Masters Open preparation with controlled fatigue, lower impact, and standards practice."
      : "Masters repeatability with recovery management, shoulder health, and trunk control.";
  }
  return sessionNumber === 1
    ? "Lower-body strength, technical lifting, and mixed-modal conditioning."
    : "Technical lifting, gymnastics capacity, and controlled aerobic conditioning.";
}

function buildGenerationRequest(
  input: GenerateProgramInput,
  template: ReturnType<typeof getV2TemplateDefinition>,
  profile: ProgrammeProfile,
): GenerationRequest {
  return {
    programmeType: template.id,
    programmeVersion: template.templateVersion,
    generationSeed: input.seed ?? template.templateVersion,
    cycleLengthWeeks: template.durationWeeks,
    sessionsPerWeek: input.sessionCount ?? 2,
    athleteLevel: input.athleteLevel,
    athleteGoals: [profile.primaryGoal],
    trainingBlock: profile.trainingBlock,
    competitionFocus: input.competitionFocus ?? null,
    availableEquipment: [...input.equipment].sort(),
    known1RMs: { ...input.maxes },
    skillPriorities: [...(input.skillPriorities ?? [])].sort(),
    athleteSkills: {
      pullUps: Number(input.skills?.pullUps) || 0,
      chestToBar: Number(input.skills?.chestToBar) || 0,
      toesToBar: Number(input.skills?.toesToBar) || 0,
      barMuscleUps: Number(input.skills?.barMuscleUps) || 0,
      strictHspu: Number(input.skills?.strictHspu) || 0,
      ringDips: Number(input.skills?.ringDips) || 0,
      handstandWalkMeters: Number(input.skills?.handstandWalkMeters) || 0,
    },
    limitations: {
      movementIds: [...input.restrictions.movementIds].sort(),
      movementFamilyIds: [...input.restrictions.movementFamilyIds].sort(),
      guidance: input.restrictions.guidance,
    },
    requestedStartDate: input.generatedAt,
  };
}

function generationFingerprint(program: ProgramV2): string {
  const canonical = program.trainingBlocks.flatMap((block) =>
    block.trainingWeeks.flatMap((week) =>
      week.sessions.map((session) => ({
        week: week.weekNumber,
        session: session.sessionNumber,
        objective: session.objective,
        exercises: session.exercises.map((exercise) => ({
          section: exercise.section,
          movementId: exercise.movementId,
          sets: exercise.sets,
          reps: exercise.reps,
          intensityMethod: exercise.intensityMethod,
          intensityValue: exercise.intensityValue,
          loadKg: exercise.loadKg,
        })),
        conditioning: session.conditioning
          ? {
              format: session.conditioning.format,
              durationMinutes: session.conditioning.durationMinutes,
              timeCapMinutes: session.conditioning.timeCapMinutes,
              rounds: session.conditioning.rounds,
              movements: session.conditioning.movements.map((movement) => ({
                movementId: movement.movementId,
                reps: movement.reps,
                durationSeconds: movement.durationSeconds,
                calories: movement.calories,
              })),
            }
          : null,
      })),
    ),
  );
  const text = JSON.stringify(canonical);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createSession(
  input: GenerateProgramInput,
  trainingWeekId: string,
  week: MixedStrengthWeekTemplate,
  sessionNumber: 1 | 2,
  tracks: Map<ProgressionTrackType, ProgressionTrack>,
  programmeType = "mixed_strength_6w",
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
      programmeType,
    );
    exercises.push(exercise);
    assignments.push({
      progressionTrackId: track.id,
      progressionStepNumber: stepNumber,
      role: templateStep.role,
    });
  }
  const gymnasticsAnchor = exercises.find(
    (exercise) => getMovement(exercise.movementId)?.category === "gymnastics",
  );
  if (
    gymnasticsAnchor &&
    (programmeType !== "strict_strength_8w" || sessionNumber === 1) &&
    ![
      "strength_development_profile",
      "endurance_capacity_6w",
      "olympic_lifting_6w",
      "general_crossfit_6w",
    ].includes(programmeType) &&
    !exercises.some((exercise) =>
      ["core", "toes_to_bar"].includes(exercise.movementFamilyId),
    )
  ) {
    exercises.push(
      ...createGymnasticsShapeExercises(input, sessionId, gymnasticsAnchor),
    );
  }
  exercises.push(
    createAccessoryExercise(
      input,
      sessionId,
      week.weekNumber,
      sessionNumber,
      programmeType,
    ),
  );
  const warmup = createWarmup(
    input,
    sessionId,
    week.weekNumber,
    sessionNumber,
    `${input.seed ?? TEMPLATE_VERSION}:${week.weekNumber}:${sessionNumber}`,
    programmeType,
  );
  const conditioning = createConditioning(
    input,
    sessionId,
    week,
    sessionNumber,
    `${input.seed ?? TEMPLATE_VERSION}:${week.weekNumber}:${sessionNumber}`,
    programmeType,
  );
  const stress = sessionStress(
    week,
    sessionNumber,
    conditioning.estimatedDurationMinutes,
  );
  const specializedStress: SessionStress =
    programmeType === "strict_strength_8w"
      ? {
          ...stress,
          lowerBodyVolumeScore: 3,
          upperBodyVolumeScore: sessionNumber === 1 ? 8 : 9,
          gripVolumeScore: sessionNumber === 1 ? 8 : 6,
          skillComplexityScore: sessionNumber === 1 ? 5 : 7,
          conditioningStressScore: Math.min(6, stress.conditioningStressScore),
          totalStressScore: sessionNumber === 1 ? 30 : 31,
        }
      : programmeType === "competition_preparation_6w"
        ? {
            ...stress,
            lowerBodyVolumeScore: Math.min(10, stress.lowerBodyVolumeScore + 2),
            skillComplexityScore: Math.min(10, stress.skillComplexityScore + 1),
            totalStressScore: stress.totalStressScore + 3,
          }
        : programmeType === "masters_open_preparation_6w"
          ? {
              ...stress,
              lowerBodyVolumeScore: Math.max(
                2,
                stress.lowerBodyVolumeScore - 2,
              ),
              upperBodyVolumeScore: Math.max(
                2,
                stress.upperBodyVolumeScore - 2,
              ),
              gripVolumeScore: Math.max(2, stress.gripVolumeScore - 2),
              conditioningStressScore: Math.max(
                2,
                stress.conditioningStressScore - 1,
              ),
              totalStressScore: Math.max(8, stress.totalStressScore - 7),
            }
          : stress;
  const base: TrainingSession = {
    id: sessionId,
    trainingWeekId,
    sessionNumber,
    sessionType: "normal",
    weekNumber: week.weekNumber,
    objective: sessionObjective(programmeType, sessionNumber),
    intendedStimulus: sessionStimulus(programmeType, sessionNumber),
    expectedFatigue: expectedFatigue(specializedStress),
    fatigueFocus:
      programmeType === "strict_strength_8w"
        ? sessionNumber === 1
          ? "grip"
          : "upper_body"
        : programmeType === "masters_open_preparation_6w"
          ? "recovery"
          : sessionNumber === 1
            ? "lower_body"
            : "mixed",
    communityWorkoutAdvice:
      programmeType === "strict_strength_8w"
        ? "Avoid extra kipping pull-ups, muscle-ups, dips, or HSPU before this session; keep all strength work submaximal unless this is a defined test."
        : programmeType === "competition_preparation_6w"
          ? "Allow full recovery before the next event; record the event score and lifting quality."
          : programmeType === "open_preparation_6w"
            ? "Protect movement standards and transitions; avoid adding extra grip work before this session."
            : programmeType === "masters_open_preparation_6w"
              ? "Use the recovery interval fully and reduce impact or grip volume at the first sign of technical decline."
              : sessionNumber === 1
                ? "Avoid placing this session directly after a heavy squat or high-volume jumping community workout."
                : "Avoid placing this session directly after grip-intensive pulling or high-volume overhead work.",
    durationTargetMinutes:
      programmeType === "strict_strength_8w"
        ? 60
        : week.weekNumber === 6
          ? 52
          : sessionNumber === 1
            ? 57
            : 59,
    estimatedDurationMinutes: 0,
    durationValidationStatus: "within_target",
    provisional: false,
    status: "planned",
    revision: 1,
    trackAssignments: assignments,
    warmup,
    exercises,
    conditioning,
    equipmentTransitions: [],
    sections: [],
    stress: specializedStress,
    feedback: null,
    maxTestPrescription: null,
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
  };
  return adjustSessionToDuration(
    base,
    programmeType === "strict_strength_8w" ? 60 : 65,
  );
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
    provisional: false,
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
      progressionTrackId: null,
      progressionStepNumber: null,
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
  const template = getV2TemplateDefinition(input.templateId, {
    allowDefault: true,
  });
  const profile = createProgrammeProfile(input, template.blockType);
  const sessionCount = input.sessionCount ?? 2;
  if (!template.supportedFrequencies.includes(sessionCount)) {
    throw new Error(
      `UNSUPPORTED_TEMPLATE_FREQUENCY:${template.id}:${sessionCount}`,
    );
  }
  const blockId = stableUuid(
    input.programId,
    template.id,
    profile.primaryGoal,
    profile.trainingBlock,
  );
  const legacyMixedTemplate =
    profile.primaryGoal === "mixed" &&
    profile.trainingBlock === "mixed_strength" &&
    ["mixed_strength_6w", "mixed_strength_8w_testing"].includes(template.id);
  const weekTemplates =
    template.id === "strict_strength_8w"
      ? buildStrictStrengthWeekTemplates(input)
      : legacyMixedTemplate
        ? getV2ProgrammeTemplate(template.id)
        : buildProfileWeekTemplates(profile, input, template.durationWeeks);
  const programmeType =
    template.id === "strict_strength_8w"
      ? template.id
      : legacyMixedTemplate
        ? template.id
        : profile.trainingBlock === "masters_open_preparation" ||
            profile.primaryGoal === "masters_open"
          ? "masters_open_preparation_6w"
          : profile.conditioningStyle === "open"
            ? "open_preparation_6w"
            : profile.conditioningStyle === "competition"
              ? "competition_preparation_6w"
              : profile.focus === "gymnastics"
                ? "gymnastics_capacity_6w"
                : profile.focus === "olympic"
                  ? "olympic_lifting_6w"
                  : profile.focus === "conditioning"
                    ? "endurance_capacity_6w"
                    : profile.focus === "strength"
                      ? "strength_development_profile"
                      : "general_crossfit_6w";
  const tracks = trackMapForBlock(blockId, input.generatedAt, weekTemplates);
  let weeks: TrainingWeek[] = weekTemplates.map((weekTemplate) => {
    const trainingWeekId = stableUuid(blockId, "week", weekTemplate.weekNumber);
    const coreSessions = [
      createSession(
        input,
        trainingWeekId,
        weekTemplate,
        1,
        tracks,
        programmeType,
      ),
      createSession(
        input,
        trainingWeekId,
        weekTemplate,
        2,
        tracks,
        programmeType,
      ),
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
  const testingTargets = legacyMixedTemplate
    ? ["front_squat", "snatch"]
    : profile.testingTargets;
  const testingTemplate = [
    "mixed_strength_8w_testing",
    "strict_strength_8w",
  ].includes(template.id);
  if (testingTemplate) {
    const priorSessions = weeks
      .flatMap((week) => week.sessions)
      .filter((session) => session.weekNumber < 8);
    weeks = weeks.map((week) => {
      if (week.weekNumber !== 8) return week;
      return {
        ...week,
        sessions: week.sessions.map((session) => {
          const movementId =
            testingTargets[
              (session.sessionNumber - 1) % testingTargets.length
            ] ??
            testingTargets[0] ??
            "front_squat";
          const testType = defaultTestType(movementId);
          const movementName = getMovement(movementId)?.name ?? movementId;
          if (!testType) {
            return {
              ...session,
              sessionType: "benchmark" as const,
              objective: `Retest ${movementName} capacity`,
              intendedStimulus:
                "Repeat the developed quality under the same movement standard and record a comparable score.",
              expectedFatigue: "moderate" as const,
              maxTestPrescription: null,
            };
          }
          const storedMax = input.movementMaxes?.find(
            (item) => item.movementId === movementId,
          );
          const previousMaxKg =
            storedMax?.testedOneRepMaxKg ??
            storedMax?.technicalOneRepMaxKg ??
            (input.maxes as Record<string, number | null | undefined>)[
              movementId
            ] ??
            null;
          const trainingMaxKg =
            storedMax?.trainingMaxKg ??
            (previousMaxKg == null
              ? null
              : calculateTrainingMax(previousMaxKg, movementId));
          const eligibility = calculateMaxTestEligibility({
            movementId,
            athleteLevel: input.athleteLevel,
            sessions: priorSessions,
            ...(input.allowBeginnerTrue1Rm == null
              ? {}
              : { allowBeginnerTrue1Rm: input.allowBeginnerTrue1Rm }),
          });
          const maxTestPrescription = buildMaxTestPrescription({
            id: stableUuid(session.id, "max-test"),
            sessionId: session.id,
            movementId,
            testType,
            previousMaxKg,
            trainingMaxKg,
            eligibility,
            athleteLevel: input.athleteLevel,
            incrementKg: input.weightIncrementKg,
            roundingMode: input.roundingMode,
            fallbackTestType: "heavy_single",
            fallbackPrescription:
              "Complete a controlled single at RPE 8; stop before grinding.",
          });
          return {
            ...session,
            sessionType: "max_test",
            objective: `Test ${maxTestPrescription.movementName} ${testType.replaceAll("_", " ")}`,
            intendedStimulus:
              "Planned testing session with full warm-up, controlled attempts, and explicit stopping rules.",
            expectedFatigue: "high",
            maxTestPrescription,
          };
        }),
      };
    });
  }
  const block: TrainingBlock = {
    id: blockId,
    programId: input.programId,
    blockType: profile.trainingBlock,
    templateId: template.id,
    plannedSessionCount: sessionCount,
    name: template.name,
    goal: `${profile.primaryGoal.replaceAll("_", " ")} with ${profile.trainingBlock.replaceAll("_", " ")} emphasis`,
    durationWeeks: template.durationWeeks,
    currentWeek: 1,
    status: "active",
    deloadWeek: template.deloadWeek,
    endsWithTest: testingTemplate,
    plannedTestMovementIds: testingTemplate ? testingTargets : [],
    testWeekNumber: testingTemplate ? 8 : null,
    testStrategy: testingTemplate
      ? testingTargets.every((movementId) => defaultTestType(movementId))
        ? "true_1rm"
        : "rep_max"
      : "none",
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
    templateVersion: template.templateVersion,
    catalogVersion: CATALOG_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    id: input.programId,
    ownerId: input.ownerId,
    name: template.name,
    status: "active",
    activeTrainingBlockId: blockId,
    trainingBlocks: [block],
    movementMaxes: input.movementMaxes ?? [],
    personalRecords: [],
    generationSource: "generated",
    generationRequest: buildGenerationRequest(input, template, profile),
    programmeProfile: profile,
    generationFingerprint: "pending",
    generatorVersion: template.templateVersion,
    validation: {
      valid: false,
      validatorVersion: VALIDATOR_VERSION,
      issues: [],
    },
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
  };
  applyMixedTestWeekPlan(draft);
  const generationSummary = createProgrammeGenerationSummary(draft, profile);
  if (!generationSummary.identityValidation.valid) {
    throw new Error(
      `PROGRAMME_IDENTITY_INVALID:${generationSummary.identityValidation.problems.join("|")}`,
    );
  }
  const fingerprint = generationFingerprint(draft);
  const validation = validateGeneratedProgram({
    ...draft,
    generationSummary,
    generationFingerprint: fingerprint,
  });
  return assertValidGeneratedProgram({
    ...draft,
    generationSummary,
    generationFingerprint: fingerprint,
    validation,
  });
}

export function generateV2Program(input: GenerateProgramInput): ProgramV2 {
  if (!input.templateId)
    throw new Error("GENERATION_REQUEST_MISSING_PROGRAMME_TYPE");
  getV2TemplateDefinition(input.templateId);
  return generateMixedStrengthBlock(input);
}

// Only untouched mixed-strength test weeks are upgraded. Completed training,
// existing attempts, and other programme types keep their original records.
export function canUpdateMixedTestWeek(program: ProgramV2 | null): boolean {
  // Historical programmes can be valid without a saved generation request.
  // Keep them readable, but do not offer an upgrade we cannot safely recreate.
  if (
    !program ||
    program.generationRequest?.programmeType !== "mixed_strength_8w_testing" ||
    program.generationRequest.sessionsPerWeek !== 2 ||
    (program.programmeProfile &&
      (program.programmeProfile.primaryGoal !== "mixed" ||
        program.programmeProfile.trainingBlock !== "mixed_strength"))
  )
    return false;
  const week = program.trainingBlocks
    .find((block) => block.id === program.activeTrainingBlockId)
    ?.trainingWeeks.find((item) => item.weekNumber === 8);
  return Boolean(
    week &&
    week.sessions.length === 2 &&
    week.sessions.every(
      (session) =>
        session.status === "planned" &&
        session.testWeekPlanVersion !== 1 &&
        [
          session.maxTestPrescription,
          ...(session.additionalMaxTestPrescriptions ?? []),
        ].every(
          (test) => !test || (!test.attemptResults.length && !test.maxUpdate),
        ),
    ),
  );
}

export function applyMixedTestWeekPlan(program: ProgramV2): boolean {
  if (
    program.generationRequest.programmeType !== "mixed_strength_8w_testing" ||
    program.generationRequest.sessionsPerWeek !== 2 ||
    (program.programmeProfile &&
      (program.programmeProfile.primaryGoal !== "mixed" ||
        program.programmeProfile.trainingBlock !== "mixed_strength"))
  )
    return false;
  const block = program.trainingBlocks.find(
    (item) => item.id === program.activeTrainingBlockId,
  );
  const week = block?.trainingWeeks.find((item) => item.weekNumber === 8);
  if (
    !block ||
    !week ||
    week.sessions.length !== 2 ||
    week.sessions.every((session) => session.testWeekPlanVersion === 1)
  )
    return false;
  if (
    week.sessions.some(
      (session) =>
        session.status !== "planned" ||
        [
          session.maxTestPrescription,
          ...(session.additionalMaxTestPrescriptions ?? []),
        ].some(
          (test) => test && (test.attemptResults.length || test.maxUpdate),
        ),
    )
  ) {
    throw new Error("TEST_WEEK_ALREADY_STARTED");
  }
  const request = program.generationRequest;
  const priorSessions = block.trainingWeeks
    .filter((item) => item.weekNumber < 8)
    .flatMap((item) => item.sessions);
  const input: GenerateProgramInput = {
    programId: program.id,
    ownerId: program.ownerId,
    generatedAt: program.updatedAt,
    athleteLevel: request.athleteLevel,
    maxes: request.known1RMs,
    equipment: request.availableEquipment,
    restrictions: request.limitations,
    weightIncrementKg: 2.5,
    roundingMode: "nearest",
  };
  const groups = [["snatch", "front_squat"], ["clean_and_jerk"]];
  week.sessions = week.sessions.map((session, index) => {
    const tests = groups[index]!.map((movementId) => {
      if (
        !movementAllowed(
          movementId,
          "primary",
          input.equipment,
          input.restrictions,
        )
      ) {
        throw new Error(`REQUIRED_MOVEMENT_UNAVAILABLE:${movementId}`);
      }
      const stored = program.movementMaxes?.find(
        (item) => item.movementId === movementId,
      );
      const previousMaxKg =
        stored?.testedOneRepMaxKg ??
        stored?.technicalOneRepMaxKg ??
        request.known1RMs[movementId as keyof typeof request.known1RMs] ??
        null;
      const prescription = buildMaxTestPrescription({
        id: stableUuid(session.id, "max-test", movementId),
        sessionId: session.id,
        movementId,
        testType: defaultTestType(movementId)!,
        previousMaxKg,
        trainingMaxKg:
          stored?.trainingMaxKg ??
          (previousMaxKg == null
            ? null
            : calculateTrainingMax(previousMaxKg, movementId)),
        eligibility: calculateMaxTestEligibility({
          movementId,
          athleteLevel: request.athleteLevel,
          sessions: priorSessions,
        }),
        athleteLevel: request.athleteLevel,
        incrementKg: input.weightIncrementKg,
        roundingMode: input.roundingMode,
      });
      return {
        ...prescription,
        estimatedDurationMinutes: 30,
        stoppingRules: [
          ...prescription.stoppingRules,
          "Allow 30 minutes including the full build-up. If more recovery is needed, skip remaining attempts or shorten conditioning; never shorten prescribed rest.",
        ],
      };
    });
    const conditioning: ConditioningPrescription | null =
      index === 0
        ? null
        : (() => {
            const engineId = engineMovementId(input, "test-week-easy-engine");
            const stepId = movementAllowed(
              "box_step_up",
              "conditioning",
              input.equipment,
              input.restrictions,
            )
              ? "box_step_up"
              : "air_squat";
            const ids = [engineId, stepId, "push_up"];
            for (const id of ids) {
              if (
                !movementAllowed(
                  id,
                  "conditioning",
                  input.equipment,
                  input.restrictions,
                )
              )
                throw new Error(`REQUIRED_MOVEMENT_UNAVAILABLE:${id}`);
            }
            const movements = [
              conditioningMovement(engineId, { durationSeconds: 35 }),
              conditioningMovement(stepId, { reps: 6 }),
              conditioningMovement("push_up", { reps: 5 }),
            ];
            return {
              id: stableUuid(session.id, "test-week-emom"),
              sessionId: session.id,
              format: "emom",
              durationMinutes: 30,
              rounds: 10,
              timeCapMinutes: null,
              workSeconds: null,
              restSeconds: null,
              intervalSeconds: 60,
              executionMode: "rotate",
              movements,
              stations: movements.map((movement, i) => ({
                minute: i + 1,
                movement,
              })),
              intendedStimulus:
                "Optional easy conditioning after testing at RPE 5–6. Rest for the remainder of each minute. Shorten or skip this block if testing takes longer, pain occurs, or technique deteriorates; finish the session within 65 minutes.",
              targetDurationMin: null,
              targetDurationMax: null,
              targetRpe: 6,
              scalingOptions: measurableConditioningScaling(),
              estimatedDurationMinutes: 30,
            };
          })();
    const sections: SessionSection[] = tests.map((test, i) => ({
      id: stableUuid(session.id, "test-section", test.movementId),
      sessionId: session.id,
      section: i === 0 ? "primary" : "secondary",
      order: i + 1,
      estimatedDurationMinutes: 30,
    }));
    sections.push({
      id: stableUuid(session.id, "test-transition"),
      sessionId: session.id,
      section: "transition",
      order: sections.length + 1,
      estimatedDurationMinutes: 5,
    });
    if (conditioning)
      sections.push({
        id: stableUuid(session.id, "test-conditioning-section"),
        sessionId: session.id,
        section: "conditioning",
        order: sections.length + 1,
        estimatedDurationMinutes: 30,
      });
    return {
      ...session,
      objective: `Test ${tests.map((test) => test.movementName).join(" + ")}`,
      intendedStimulus:
        "Test each lift separately with its own build-up, attempt records and stopping rules. Keep all prescribed rest; the session budget is 65 minutes.",
      maxTestPrescription: tests[0]!,
      additionalMaxTestPrescriptions: tests.slice(1),
      testWeekPlanVersion: 1,
      conditioning,
      sections,
      durationTargetMinutes: 65,
      estimatedDurationMinutes: 65,
      durationValidationStatus: "warning_long" as const,
      revision: session.revision + 1,
    };
  });
  block.plannedTestMovementIds = groups.flat();
  return true;
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
