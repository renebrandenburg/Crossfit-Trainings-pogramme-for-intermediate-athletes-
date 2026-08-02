import { getMovement } from "./catalog";
import type {
  DurationEstimate,
  DurationEstimateInput,
  DurationValidationStatus,
  ExercisePrescription,
  WeightCalculationInput,
} from "./types";

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function exerciseSetWorkSeconds(exercise: ExercisePrescription): number {
  const movement = getMovement(exercise.movementId);
  const secondsPerRep = movement?.secondsPerRep ?? 4;
  if (exercise.durationSeconds != null) return exercise.durationSeconds;
  if (exercise.distanceMeters != null) {
    const metersPerSecond = exercise.movementFamilyId === "carry" ? 1.25 : 2.5;
    return exercise.distanceMeters / metersPerSecond;
  }
  if (exercise.calories != null) return exercise.calories * 4;
  const reps =
    exercise.reps ??
    (exercise.repRangeMin != null && exercise.repRangeMax != null
      ? (exercise.repRangeMin + exercise.repRangeMax) / 2
      : 1);
  return Math.max(20, reps * secondsPerRep);
}

function strengthBreakdown(exercises: ExercisePrescription[]): {
  workMinutes: number;
  restMinutes: number;
} {
  let workSeconds = 0;
  let restSeconds = 0;
  const groupedRest = new Map<string, { sets: number; restSeconds: number }>();

  for (const exercise of exercises) {
    const sets = Math.max(1, exercise.sets ?? 1);
    workSeconds += exerciseSetWorkSeconds(exercise) * sets;
    workSeconds += exercise.warmupSetCount * 45;
    workSeconds += Math.max(0, exercise.setupMinutes) * 60;

    if (exercise.restSeconds == null) continue;
    if (exercise.groupId) {
      const current = groupedRest.get(exercise.groupId);
      groupedRest.set(exercise.groupId, {
        sets: Math.max(current?.sets ?? 0, sets),
        restSeconds: Math.max(current?.restSeconds ?? 0, exercise.restSeconds),
      });
    } else {
      restSeconds += Math.max(0, sets - 1) * exercise.restSeconds;
    }
  }

  for (const grouped of groupedRest.values()) {
    restSeconds += Math.max(0, grouped.sets - 1) * grouped.restSeconds;
  }

  return {
    workMinutes: roundTenth(workSeconds / 60),
    restMinutes: roundTenth(restSeconds / 60),
  };
}

export function calculateExerciseDurationMinutes(
  exercise: ExercisePrescription,
): number {
  const breakdown = strengthBreakdown([exercise]);
  return Math.ceil(breakdown.workMinutes + breakdown.restMinutes);
}

export function calculateSessionDuration(
  input: DurationEstimateInput,
): DurationEstimate {
  const strength = strengthBreakdown(input.exercises);
  const transitionMinutes = roundTenth(
    input.equipmentTransitions.reduce(
      (total, transition) => total + transition.estimatedMinutes,
      0,
    ),
  );
  const conditioningMinutes = roundTenth(
    input.conditioning?.estimatedDurationMinutes ?? 0,
  );
  const totalMinutes = Math.ceil(
    input.warmupMinutes +
      strength.workMinutes +
      strength.restMinutes +
      conditioningMinutes +
      transitionMinutes +
      input.cooldownMinutes,
  );
  return {
    totalMinutes,
    warmupMinutes: roundTenth(input.warmupMinutes),
    workMinutes: strength.workMinutes,
    restMinutes: strength.restMinutes,
    conditioningMinutes,
    transitionMinutes,
    cooldownMinutes: roundTenth(input.cooldownMinutes),
  };
}

export function durationStatus(
  totalMinutes: number,
  deload: boolean,
  shorterSessionPreference = false,
): DurationValidationStatus {
  if (totalMinutes > 65) return "invalid_too_long";
  if (totalMinutes > 60) return "warning_long";
  if (totalMinutes < 45 && !deload && !shorterSessionPreference) {
    return "warning_short";
  }
  return "within_target";
}

export function calculateWorkingWeight(input: WeightCalculationInput): number {
  if (!Number.isFinite(input.maxKg) || input.maxKg <= 0) {
    throw new RangeError("maxKg must be a positive finite number.");
  }
  if (
    !Number.isFinite(input.percentage) ||
    input.percentage <= 0 ||
    input.percentage > 100
  ) {
    throw new RangeError("percentage must be between 0 and 100.");
  }
  const raw = (input.maxKg * input.percentage) / 100;
  const units = raw / input.incrementKg;
  const roundedUnits =
    input.roundingMode === "down"
      ? Math.floor(units)
      : input.roundingMode === "up"
        ? Math.ceil(units)
        : Math.round(units);
  return Math.max(input.incrementKg, roundedUnits * input.incrementKg);
}

export function equipmentTransitionMinutes(
  fromEquipment: string[],
  toEquipment: string[],
): number {
  const from = new Set(fromEquipment.map((item) => item.toLowerCase()));
  const to = new Set(toEquipment.map((item) => item.toLowerCase()));
  const added = [...to].filter((item) => !from.has(item));
  const removed = [...from].filter((item) => !to.has(item));
  if (!added.length && !removed.length) return 0.5;
  const machineChange = [...added, ...removed].some((item) =>
    ["rower", "bike", "ski erg"].includes(item),
  );
  const barbellChange = from.has("barbell") || to.has("barbell");
  return Math.min(
    2.5,
    0.75 +
      added.length * 0.35 +
      (machineChange ? 0.5 : 0) +
      (barbellChange ? 0.4 : 0),
  );
}
