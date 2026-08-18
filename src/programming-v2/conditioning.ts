import { getMovement } from "./catalog";
import type {
  AthleteConditioningProfile,
  ConditioningAthleteLevel,
  ConditioningDomain,
  ConditioningDurationEstimate,
  ConditioningEstimateInput,
  ConditioningIntent,
  ConditioningMovement,
  ConditioningPerformance,
  ConditioningPrescription,
  ConditioningValidation,
  MovementPaceProfile,
} from "./types";

export const CONDITIONING_STIMULUS_TOLERANCE = 0.1;
export const MAX_RECALIBRATION_ATTEMPTS = 3;
export const MIN_PERSONAL_CALIBRATION_SAMPLES = 5;

export const LEVEL_MULTIPLIER: Readonly<
  Record<ConditioningAthleteLevel, number>
> = Object.freeze({
  beginner: 1.25,
  intermediate: 1,
  advanced: 0.85,
  rx: 0.75,
});

export const MOVEMENT_PACE_PROFILES: Readonly<
  Record<string, MovementPaceProfile>
> = Object.freeze({
  run: pace("run", "engine", { secondsPerMeter: 0.28125 }, 0.015, 0.22),
  row: pace(
    "row",
    "engine",
    { secondsPerMeter: 0.24, secondsPerCalorie: 4.5 },
    0.02,
    0.18,
  ),
  bike: pace("bike", "engine", { secondsPerCalorie: 3.5 }, 0.02, 0.2),
  ski: pace(
    "ski",
    "engine",
    { secondsPerMeter: 0.25, secondsPerCalorie: 4.8 },
    0.025,
    0.2,
  ),
  burpee: pace("burpee", "bodyweight", { secondsPerRep: 3.5 }, 0.03, 0.22),
  air_squat: pace(
    "air_squat",
    "bodyweight",
    { secondsPerRep: 1.5 },
    0.02,
    0.25,
  ),
  box_step_up: pace(
    "box_step_up",
    "bodyweight",
    { secondsPerRep: 2.5 },
    0.03,
    0.2,
  ),
  push_up: pace("push_up", "gymnastics", { secondsPerRep: 2.5 }, 0.04, 0.25),
  strict_pull_up: pace(
    "strict_pull_up",
    "gymnastics",
    { secondsPerRep: 2.25 },
    0.05,
    0.25,
  ),
  toes_to_bar: pace(
    "toes_to_bar",
    "gymnastics",
    { secondsPerRep: 2.75 },
    0.055,
    0.3,
  ),
  hanging_knee_raise: pace(
    "hanging_knee_raise",
    "gymnastics",
    { secondsPerRep: 2.5 },
    0.045,
    0.25,
  ),
  hang_clean_and_jerk: pace(
    "hang_clean_and_jerk",
    "strength",
    { secondsPerRep: 5 },
    0.06,
    0.25,
  ),
  hang_power_snatch: pace(
    "hang_power_snatch",
    "strength",
    { secondsPerRep: 4.5 },
    0.055,
    0.25,
  ),
});

function pace(
  movementId: string,
  domain: ConditioningDomain,
  rates: Pick<
    MovementPaceProfile,
    "secondsPerRep" | "secondsPerMeter" | "secondsPerCalorie"
  >,
  fatigueFactor: number,
  uncertainty: number,
): MovementPaceProfile {
  return {
    movementId,
    domain,
    ...rates,
    transitionSeconds: 4,
    fatigueFactor,
    uncertainty,
  };
}

function fallbackPace(movement: ConditioningMovement): MovementPaceProfile {
  const catalogMovement = getMovement(movement.movementId);
  const domain: ConditioningDomain =
    catalogMovement?.category === "gymnastics"
      ? "gymnastics"
      : catalogMovement?.category === "olympic_lifting" ||
          catalogMovement?.category === "strength"
        ? "strength"
        : catalogMovement?.category === "conditioning"
          ? "engine"
          : "bodyweight";
  return pace(
    movement.movementId,
    domain,
    {
      secondsPerRep: catalogMovement?.secondsPerRep ?? 4,
      secondsPerMeter: 0.3,
      secondsPerCalorie: 4.5,
    },
    domain === "strength" ? 0.06 : domain === "gymnastics" ? 0.05 : 0.03,
    0.3,
  );
}

function athleteMultiplier(
  profile: AthleteConditioningProfile,
  domain: ConditioningDomain,
): number {
  const level = profile.domainLevels?.[domain] ?? profile.level;
  const personal =
    profile.personalMultiplier &&
    profile.personalMultiplier.sampleCount >= MIN_PERSONAL_CALIBRATION_SAMPLES
      ? profile.personalMultiplier.value
      : 1;
  return LEVEL_MULTIPLIER[level] * personal;
}

function movementSeconds(
  movement: ConditioningMovement,
  profile: AthleteConditioningProfile,
): {
  expected: number;
  minimum: number;
  maximum: number;
  fatigueFactor: number;
  known: boolean;
} {
  const configured = MOVEMENT_PACE_PROFILES[movement.movementId];
  const paceProfile = configured ?? fallbackPace(movement);
  const multiplier = athleteMultiplier(profile, paceProfile.domain);
  let seconds: number;
  let fixedClock = false;
  if (movement.durationSeconds != null) {
    seconds = movement.durationSeconds;
    fixedClock = true;
  } else if (movement.distanceMeters != null) {
    seconds = movement.distanceMeters * (paceProfile.secondsPerMeter ?? 0.3);
  } else if (movement.calories != null) {
    seconds = movement.calories * (paceProfile.secondsPerCalorie ?? 4.5);
  } else {
    seconds = (movement.reps ?? 1) * (paceProfile.secondsPerRep ?? 4);
  }
  const expected = seconds * (fixedClock ? 1 : multiplier);
  const uncertainty = fixedClock ? 0 : paceProfile.uncertainty;
  return {
    expected,
    minimum: expected * (1 - uncertainty),
    maximum: expected * (1 + uncertainty),
    fatigueFactor:
      paceProfile.fatigueFactor *
      ((movement.reps ?? 0) >= 12 && paceProfile.domain === "gymnastics"
        ? 1.25
        : 1),
    known: Boolean(configured),
  };
}

function roundedSeconds(value: number): number {
  return Math.max(1, Math.round(value));
}

export function estimateConditioningDuration(
  input: ConditioningEstimateInput,
): ConditioningDurationEstimate {
  if (
    input.durationMinutes != null &&
    ["amrap", "emom", "intervals", "zone_2"].includes(input.format)
  ) {
    const seconds = roundedSeconds(input.durationMinutes * 60);
    return {
      estimatedSeconds: seconds,
      minExpectedSeconds: seconds,
      maxExpectedSeconds: seconds,
      confidence: "high",
    };
  }

  const movementEstimates = input.movements.map((movement) =>
    movementSeconds(movement, input.athleteProfile),
  );
  const globalMultiplier = LEVEL_MULTIPLIER[input.athleteProfile.level];
  const transitionSeconds = input.movements.reduce((total, movement) => {
    const profile =
      MOVEMENT_PACE_PROFILES[movement.movementId] ?? fallbackPace(movement);
    return total + profile.transitionSeconds * globalMultiplier;
  }, 0);
  const expectedBase =
    movementEstimates.reduce(
      (total, estimate) => total + estimate.expected,
      0,
    ) + transitionSeconds;
  const minimumBase =
    movementEstimates.reduce((total, estimate) => total + estimate.minimum, 0) +
    transitionSeconds * 0.8;
  const maximumBase =
    movementEstimates.reduce((total, estimate) => total + estimate.maximum, 0) +
    transitionSeconds * 1.2;
  const weightedWork = movementEstimates.reduce(
    (total, estimate) => total + estimate.expected,
    0,
  );
  const fatigueFactor = weightedWork
    ? movementEstimates.reduce(
        (total, estimate) => total + estimate.fatigueFactor * estimate.expected,
        0,
      ) / weightedWork
    : 0.03;
  const rounds = Math.max(1, input.rounds ?? 1);
  let estimatedSeconds = 0;
  let minExpectedSeconds = 0;
  let maxExpectedSeconds = 0;
  for (let round = 0; round < rounds; round += 1) {
    estimatedSeconds += expectedBase * (1 + fatigueFactor * round);
    minExpectedSeconds += minimumBase * (1 + fatigueFactor * 0.75 * round);
    maxExpectedSeconds += maximumBase * (1 + fatigueFactor * 1.25 * round);
  }
  if (input.format === "intervals" && input.restSeconds != null) {
    const rests = Math.max(0, rounds - 1) * input.restSeconds;
    estimatedSeconds += rests;
    minExpectedSeconds += rests;
    maxExpectedSeconds += rests;
  }
  return {
    estimatedSeconds: roundedSeconds(estimatedSeconds),
    minExpectedSeconds: roundedSeconds(minExpectedSeconds),
    maxExpectedSeconds: roundedSeconds(maxExpectedSeconds),
    confidence: movementEstimates.every((estimate) => estimate.known)
      ? "medium"
      : "low",
  };
}

export function validateEstimatedConditioningDuration(
  estimatedSeconds: number,
  target: { minMinutes: number; maxMinutes: number },
  tolerance = CONDITIONING_STIMULUS_TOLERANCE,
): ConditioningValidation {
  const minimum = target.minMinutes * 60;
  const maximum = target.maxMinutes * 60;
  const below = estimatedSeconds < minimum * (1 - tolerance);
  const above = estimatedSeconds > maximum * (1 + tolerance);
  const deviationPercent =
    estimatedSeconds < minimum
      ? ((estimatedSeconds - minimum) / minimum) * 100
      : estimatedSeconds > maximum
        ? ((estimatedSeconds - maximum) / maximum) * 100
        : 0;
  return {
    valid: !below && !above,
    estimatedDuration: estimatedSeconds,
    targetRange: { min: minimum, max: maximum },
    deviationPercent: Math.round(deviationPercent * 10) / 10,
    ...(below
      ? {
          reason:
            "Estimated workload is materially below the programmed target window.",
        }
      : above
        ? {
            reason:
              "Estimated workload is materially above the programmed target window.",
          }
        : {}),
  };
}

export function validateConditioningStimulus(
  input: ConditioningEstimateInput & { timeCapMinutes?: number | null },
  target: { minMinutes: number; maxMinutes: number },
  tolerance = CONDITIONING_STIMULUS_TOLERANCE,
): ConditioningValidation {
  const estimate = estimateConditioningDuration(input);
  if (
    input.timeCapMinutes != null &&
    input.timeCapMinutes < target.maxMinutes
  ) {
    return {
      valid: false,
      estimatedDuration: estimate.estimatedSeconds,
      targetRange: {
        min: target.minMinutes * 60,
        max: target.maxMinutes * 60,
      },
      deviationPercent: 0,
      reason: "Time cap must not be below the programmed target window.",
    };
  }
  return validateEstimatedConditioningDuration(
    estimate.estimatedSeconds,
    target,
    tolerance,
  );
}

function conditioningIntent(
  conditioning: ConditioningPrescription,
): ConditioningIntent {
  const fixedDurationTarget =
    conditioning.format !== "for_time" && conditioning.durationMinutes != null
      ? {
          minMinutes: conditioning.durationMinutes,
          maxMinutes: conditioning.durationMinutes,
        }
      : null;
  return {
    durationTarget:
      fixedDurationTarget ??
      (conditioning.targetDurationMin != null &&
      conditioning.targetDurationMax != null
        ? {
            minMinutes: conditioning.targetDurationMin,
            maxMinutes: conditioning.targetDurationMax,
          }
        : null),
    timeCapMinutes: conditioning.timeCapMinutes,
    intensity: {
      targetRpe: conditioning.targetRpe,
      maxRpe: conditioning.targetRpe,
    },
    stimulus: conditioning.intendedStimulus,
    pacing:
      conditioning.competitionMetadata?.pacingPlan[0] ??
      conditioning.intendedStimulus,
  };
}

function estimateInput(
  conditioning: ConditioningPrescription,
  athleteProfile: AthleteConditioningProfile,
): ConditioningEstimateInput {
  return {
    format: conditioning.format,
    rounds: conditioning.rounds,
    durationMinutes: conditioning.durationMinutes,
    workSeconds: conditioning.workSeconds,
    restSeconds: conditioning.restSeconds,
    movements: conditioning.movements,
    athleteProfile,
  };
}

function adjustWorkload(
  conditioning: ConditioningPrescription,
  attempt: number,
  increase: boolean,
): ConditioningPrescription {
  const factor = increase ? 1.25 : 0.8;
  if (
    attempt === 0 &&
    conditioning.movements.some(
      (item) => item.distanceMeters != null || item.calories != null,
    )
  ) {
    return {
      ...conditioning,
      movements: conditioning.movements.map((movement) => ({
        ...movement,
        distanceMeters:
          movement.distanceMeters == null
            ? null
            : Math.max(
                50,
                Math.round((movement.distanceMeters * factor) / 10) * 10,
              ),
        calories:
          movement.calories == null
            ? null
            : Math.max(1, Math.round(movement.calories * factor)),
      })),
    };
  }
  if (attempt <= 1) {
    return {
      ...conditioning,
      movements: conditioning.movements.map((movement) => ({
        ...movement,
        reps:
          movement.reps == null
            ? null
            : Math.max(1, Math.round(movement.reps * factor)),
      })),
    };
  }
  return {
    ...conditioning,
    rounds: Math.max(1, (conditioning.rounds ?? 1) + (increase ? 1 : -1)),
  };
}

function attachCalibration(
  conditioning: ConditioningPrescription,
  athleteProfile: AthleteConditioningProfile,
  intent: ConditioningIntent,
  attempts: number,
): ConditioningPrescription {
  const estimate = estimateConditioningDuration(
    estimateInput(conditioning, athleteProfile),
  );
  const stimulusValidation = intent.durationTarget
    ? validateConditioningStimulus(
        {
          ...estimateInput(conditioning, athleteProfile),
          timeCapMinutes: conditioning.timeCapMinutes,
        },
        intent.durationTarget,
      )
    : null;
  return {
    ...conditioning,
    athleteLevel: athleteProfile.level,
    intent,
    durationEstimate: estimate,
    stimulusValidation,
    recalibrationAttempts: attempts,
    estimatedDurationMinutes: Math.round(estimate.estimatedSeconds / 6) / 10,
  };
}

export function calibrateConditioningPrescription(
  conditioning: ConditioningPrescription,
  athleteProfile: AthleteConditioningProfile,
): ConditioningPrescription {
  const intent = conditioningIntent(conditioning);
  let current = attachCalibration(conditioning, athleteProfile, intent, 0);
  if (!current.stimulusValidation || current.stimulusValidation.valid) {
    return current;
  }
  for (let attempt = 0; attempt < MAX_RECALIBRATION_ATTEMPTS; attempt += 1) {
    const validation = current.stimulusValidation;
    if (!validation) break;
    if (
      validation.reason ===
      "Time cap must not be below the programmed target window."
    ) {
      break;
    }
    current = attachCalibration(
      adjustWorkload(current, attempt, validation.deviationPercent < 0),
      athleteProfile,
      intent,
      attempt + 1,
    );
    if (current.stimulusValidation?.valid) return current;
  }
  return current;
}

export function createConditioningPerformance(
  conditioning: ConditioningPrescription,
  actualDurationSeconds: number,
  athleteRpe: number | null,
): ConditioningPerformance {
  if (!Number.isFinite(actualDurationSeconds) || actualDurationSeconds <= 0) {
    throw new Error(
      "Conditioning duration must be a positive number of seconds.",
    );
  }
  const estimatedDuration =
    conditioning.durationEstimate?.estimatedSeconds ??
    Math.round(conditioning.estimatedDurationMinutes * 60);
  const target = conditioning.intent?.durationTarget;
  return {
    prescribedTargetMin: target ? target.minMinutes * 60 : null,
    prescribedTargetMax: target ? target.maxMinutes * 60 : null,
    estimatedDuration,
    actualDuration: actualDurationSeconds,
    athleteRpe,
    performanceRatio:
      Math.round((actualDurationSeconds / estimatedDuration) * 1000) / 1000,
  };
}
