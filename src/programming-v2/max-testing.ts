import { getMovement } from "./catalog";
import type {
  AthleteMovementMax,
  MaxAttemptResult,
  MaxTestEligibility,
  MaxTestPrescription,
  MaxTestType,
  MaxUpdate,
  PlannedMaxAttempt,
  TechnicalStandard,
  TrainingSession,
} from "./types";

export const MAX_TEST_INTERVALS_WEEKS: Readonly<
  Record<string, [number, number]>
> = Object.freeze({
  back_squat: [10, 16],
  front_squat: [8, 12],
  deadlift: [12, 16],
  strict_press: [8, 12],
  snatch: [8, 12],
  clean_and_jerk: [8, 12],
});

const TRUE_ONE_REP_MOVEMENTS = new Set([
  "back_squat",
  "front_squat",
  "deadlift",
  "strict_press",
  "bench_press",
  "weighted_pull_up",
]);

const TECHNICAL_ONE_REP_MOVEMENTS = new Set([
  "snatch",
  "clean",
  "clean_and_jerk",
  "power_snatch",
  "power_clean",
  "jerk",
  "overhead_squat",
]);

const TECHNICAL_STANDARDS: Readonly<Record<string, TechnicalStandard>> =
  Object.freeze({
    snatch: {
      movementId: "snatch",
      criteria: [
        "Receive the bar under control in the prescribed position.",
        "Stabilize the bar overhead before standing fully.",
        "Complete the repetition without losing the bar or changing the lift variation.",
      ],
      invalidationCriteria: [
        "Press-out, unstable overhead recovery, or loss of control.",
        "Receiving the bar above the prescribed squat depth.",
      ],
    },
    clean_and_jerk: {
      movementId: "clean_and_jerk",
      criteria: [
        "Control the clean and reach full standing before the jerk.",
        "Stabilize the jerk overhead and recover the feet under control.",
      ],
      invalidationCriteria: [
        "Press-out, unstable overhead recovery, or failure to control the bar.",
        "Changing the prescribed lift variation.",
      ],
    },
  });

export function isTrueOneRepMovement(movementId: string): boolean {
  return TRUE_ONE_REP_MOVEMENTS.has(movementId);
}

export function isTechnicalOneRepMovement(movementId: string): boolean {
  return TECHNICAL_ONE_REP_MOVEMENTS.has(movementId);
}

export function defaultTestType(movementId: string): MaxTestType | null {
  if (isTrueOneRepMovement(movementId)) return "true_1rm";
  if (isTechnicalOneRepMovement(movementId)) return "technical_1rm";
  return null;
}

export function calculateEstimatedOneRepMax(
  loadKg: number,
  reps: number,
  formula: "epley" | "brzycki" = "epley",
): number {
  if (!Number.isFinite(loadKg) || loadKg <= 0) {
    throw new Error("Load must be greater than zero.");
  }
  if (!Number.isInteger(reps) || reps < 2 || reps > 10) {
    throw new Error("Estimated 1RM requires between 2 and 10 repetitions.");
  }
  const estimate =
    formula === "epley"
      ? loadKg * (1 + reps / 30)
      : loadKg * (36 / (37 - reps));
  return Math.round(estimate * 10) / 10;
}

export function calculateTrainingMax(
  maxKg: number,
  movementId: string,
  percentage = 0.92,
): number {
  if (!Number.isFinite(maxKg) || maxKg <= 0) {
    throw new Error("A valid tested max is required.");
  }
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 1) {
    throw new Error("Training-max percentage must be between 0 and 1.");
  }
  const rounded = maxKg * percentage;
  return Math.round(rounded * 10) / 10;
}

export function roundTestLoad(
  loadKg: number,
  incrementKg: 1 | 2 | 2.5 | 5,
  mode: "nearest" | "down" | "up",
): number {
  const units = loadKg / incrementKg;
  const rounded =
    mode === "down"
      ? Math.floor(units)
      : mode === "up"
        ? Math.ceil(units)
        : Math.round(units);
  return Math.max(incrementKg, Math.round(rounded * incrementKg * 10) / 10);
}

export function testingIntervalWeeks(movementId: string): [number, number] {
  return MAX_TEST_INTERVALS_WEEKS[movementId] ?? [8, 12];
}

export function daysSince(
  date: string | null,
  now = new Date(),
): number | null {
  if (!date) return null;
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86400000));
}

export function calculateMaxTestEligibility(input: {
  movementId: string;
  athleteLevel: "beginner" | "intermediate" | "advanced";
  sessions: TrainingSession[];
  requiredPrerequisiteSessions?: number;
  lastTestAt?: string | null;
  now?: Date;
  allowBeginnerTrue1Rm?: boolean;
}): MaxTestEligibility {
  const required = input.requiredPrerequisiteSessions ?? 6;
  const relevant = input.sessions.filter((session) =>
    session.exercises.some(
      (exercise) => exercise.movementId === input.movementId,
    ),
  );
  const completed = relevant.filter(
    (session) => session.status === "completed",
  );
  const recent = relevant.slice(-4);
  const recentPainReported = recent.some(
    (session) =>
      session.feedback?.painReported ||
      session.feedback?.results.some((result) => result.painReported),
  );
  const recentFailureCount = recent.reduce(
    (count, session) =>
      count +
      (session.feedback?.results.some((result) => !result.successful) ? 1 : 0),
    0,
  );
  const recentHeavySingleCompleted = completed.some((session) =>
    session.exercises.some(
      (exercise) =>
        exercise.movementId === input.movementId &&
        exercise.reps === 1 &&
        (exercise.intensityValue ?? 0) >= 85 &&
        session.feedback?.results.some((result) => result.successful),
    ),
  );
  const days = daysSince(input.lastTestAt ?? null, input.now);
  const [minimumWeeks] = testingIntervalWeeks(input.movementId);
  const reasons: string[] = [];
  if (input.athleteLevel === "beginner" && !input.allowBeginnerTrue1Rm) {
    reasons.push("Beginners use a submaximal fallback by default.");
  }
  if (completed.length < required) {
    reasons.push("Not enough prerequisite progression sessions are completed.");
  }
  if (recentPainReported) reasons.push("Recent pain was reported.");
  if (!recentHeavySingleCompleted) {
    reasons.push("A successful recent heavy single is required.");
  }
  if (recentFailureCount >= 2)
    reasons.push("Recent repeated failures require a fallback.");
  if (days != null && days < minimumWeeks * 7) {
    reasons.push("The previous max test was too recent.");
  }
  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (completed.length / Math.max(required, 1)) * 45 +
          (recentHeavySingleCompleted ? 25 : 0) +
          (!recentPainReported ? 20 : 0) +
          (recentFailureCount === 0 ? 10 : 0),
      ),
    ),
  );
  return {
    movementId: input.movementId,
    eligible: reasons.length === 0,
    reasons,
    completedPrerequisiteSessions: completed.length,
    requiredPrerequisiteSessions: required,
    recentPainReported,
    recentFailureCount,
    recentHeavySingleCompleted,
    daysSinceLastTest: days,
    readinessScore,
  };
}

function attempt(
  number: number,
  type: PlannedMaxAttempt["attemptType"],
  percentage: number,
  previousMaxKg: number | null,
  incrementKg: 1 | 2 | 2.5 | 5,
  mode: "nearest" | "down" | "up",
  optional: boolean,
): PlannedMaxAttempt {
  return {
    attemptNumber: number,
    attemptType: type,
    percentageOfPreviousMax: previousMaxKg == null ? null : percentage,
    suggestedLoadKg:
      previousMaxKg == null
        ? null
        : roundTestLoad((previousMaxKg * percentage) / 100, incrementKg, mode),
    restSeconds: 240,
    optional,
  };
}

export function buildMaxTestPrescription(input: {
  id: string;
  sessionId: string;
  movementId: string;
  testType: MaxTestType;
  previousMaxKg: number | null;
  trainingMaxKg: number | null;
  eligibility: MaxTestEligibility;
  athleteLevel: "beginner" | "intermediate" | "advanced";
  incrementKg: 1 | 2 | 2.5 | 5;
  roundingMode: "nearest" | "down" | "up";
  fallbackTestType?: MaxTestType;
  fallbackPrescription?: string;
}): MaxTestPrescription {
  const movement = getMovement(input.movementId);
  if (!movement)
    throw new Error(`Unknown max-test movement ${input.movementId}.`);
  const technical = TECHNICAL_STANDARDS[input.movementId] ?? null;
  const technicalTest = input.testType === "technical_1rm";
  const warmupPercentages = [40, 55, 70, 80, 87];
  const warmupSets = warmupPercentages.map((percentage, index) => ({
    percentage,
    loadKg:
      input.previousMaxKg == null
        ? null
        : roundTestLoad(
            (input.previousMaxKg * percentage) / 100,
            input.incrementKg,
            input.roundingMode,
          ),
    reps: index < 1 ? 5 : index < 2 ? 3 : index < 3 ? 2 : 1,
    restSeconds: index < 2 ? 90 : 150,
    purpose:
      index < 3
        ? "Build position and bar speed."
        : "Practice the planned opener.",
  }));
  const plannedAttempts = [
    attempt(
      1,
      "opener",
      92,
      input.previousMaxKg,
      input.incrementKg,
      input.roundingMode,
      false,
    ),
    attempt(
      2,
      "second_attempt",
      99,
      input.previousMaxKg,
      input.incrementKg,
      input.roundingMode,
      false,
    ),
    attempt(
      3,
      "personal_record_attempt",
      104,
      input.previousMaxKg,
      input.incrementKg,
      input.roundingMode,
      true,
    ),
  ];
  return {
    id: input.id,
    sessionId: input.sessionId,
    movementId: input.movementId,
    movementName: movement.name,
    athleteLevel: input.athleteLevel,
    testType: technicalTest ? "technical_1rm" : input.testType,
    previousMaxKg: input.previousMaxKg,
    trainingMaxKg: input.trainingMaxKg,
    estimatedCurrentMaxKg: input.previousMaxKg,
    fallbackTestType: input.fallbackTestType ?? "heavy_single",
    fallbackPrescription:
      input.fallbackPrescription ??
      "Complete a controlled single at RPE 8; stop before grinding.",
    eligibility: input.eligibility,
    warmupSets,
    plannedAttempts,
    attemptResults: [],
    minimumRestSeconds: 240,
    maximumAttempts: 3,
    technicalStandards: technical,
    stoppingRules: [
      "Stop immediately if pain is reported.",
      "Stop after two consecutive failed attempts.",
      "Stop when technique becomes poor or invalid.",
      "Do not reduce the required rest between heavy attempts.",
    ],
    estimatedDurationMinutes: technicalTest ? 55 : 58,
    maxUpdate: null,
  };
}

export function validateMaxTestPrescription(
  prescription: MaxTestPrescription,
): string[] {
  const errors: string[] = [];
  if (!defaultTestType(prescription.movementId)) {
    errors.push("True or technical 1RM is not supported for this movement.");
  }
  if (!prescription.warmupSets.length)
    errors.push("Max test requires warm-up sets.");
  if (!prescription.plannedAttempts.length)
    errors.push("Max test requires planned attempts.");
  if (prescription.minimumRestSeconds < 180)
    errors.push("Max attempts require at least 3 minutes rest.");
  if (prescription.maximumAttempts > 4)
    errors.push("Max test has too many attempts.");
  if (!prescription.stoppingRules.length)
    errors.push("Max test requires stopping rules.");
  if (prescription.estimatedDurationMinutes > 65)
    errors.push("Max test exceeds the 65-minute limit.");
  if (
    isTechnicalOneRepMovement(prescription.movementId) &&
    !prescription.technicalStandards
  ) {
    errors.push("Technical Olympic tests require technical standards.");
  }
  return errors;
}

export function applyMaxAttemptResult(
  prescription: MaxTestPrescription,
  result: MaxAttemptResult,
): MaxTestPrescription {
  if (
    !Number.isInteger(result.attemptNumber) ||
    result.attemptNumber < 1 ||
    result.attemptNumber > prescription.maximumAttempts
  ) {
    throw new Error("Attempt number is outside the planned max-test range.");
  }
  if (!Number.isFinite(result.loadKg) || result.loadKg <= 0) {
    throw new Error("Attempt load must be greater than zero.");
  }
  const results = [
    ...prescription.attemptResults.filter(
      (item) => item.attemptNumber !== result.attemptNumber,
    ),
    result,
  ].sort((left, right) => left.attemptNumber - right.attemptNumber);
  let consecutiveFailures = 0;
  for (const item of results.slice().reverse()) {
    if (item.result !== "failure") break;
    consecutiveFailures += 1;
  }
  const validSuccess = results.some(
    (item) =>
      item.result === "success" &&
      (item.technicalQuality === "good" ||
        item.technicalQuality === "acceptable"),
  );
  return {
    ...prescription,
    attemptResults: results,
    maxUpdate:
      consecutiveFailures >= 2 ||
      result.painReported ||
      results.some((item) => item.technicalQuality === "invalid")
        ? {
            accepted: false,
            maxKg: null,
            trainingMaxKg: null,
            recordType: null,
            confirmedAt: null,
          }
        : validSuccess
          ? prescription.maxUpdate
          : null,
  };
}

export function highestValidAttempt(
  prescription: MaxTestPrescription,
): MaxAttemptResult | null {
  return (
    prescription.attemptResults
      .filter(
        (result) =>
          result.result === "success" &&
          (result.technicalQuality === "good" ||
            result.technicalQuality === "acceptable"),
      )
      .sort((left, right) => right.loadKg - left.loadKg)[0] ?? null
  );
}

export function proposeMaxUpdate(
  prescription: MaxTestPrescription,
  confirmedAt: string,
  trainingMaxPercentage = 0.92,
): MaxUpdate {
  let consecutiveFailures = 0;
  for (const result of prescription.attemptResults
    .slice()
    .sort((a, b) => b.attemptNumber - a.attemptNumber)) {
    if (result.result !== "failure") break;
    consecutiveFailures += 1;
  }
  if (
    consecutiveFailures >= 2 ||
    prescription.attemptResults.some(
      (result) => result.painReported || result.technicalQuality === "invalid",
    )
  ) {
    return {
      accepted: false,
      maxKg: null,
      trainingMaxKg: null,
      recordType: null,
      confirmedAt: null,
    };
  }
  const highest = highestValidAttempt(prescription);
  if (!highest) {
    return {
      accepted: false,
      maxKg: null,
      trainingMaxKg: null,
      recordType: null,
      confirmedAt: null,
    };
  }
  const recordType = prescription.testType;
  return {
    accepted: true,
    maxKg: highest.loadKg,
    trainingMaxKg: calculateTrainingMax(
      highest.loadKg,
      prescription.movementId,
      trainingMaxPercentage,
    ),
    recordType,
    confirmedAt,
  };
}

export function maxSourceForTest(
  testType: MaxTestType,
): AthleteMovementMax["source"] {
  if (testType === "technical_1rm") return "technical_1rm_test";
  if (testType === "estimated_1rm") return "estimated_1rm";
  return "true_1rm_test";
}
