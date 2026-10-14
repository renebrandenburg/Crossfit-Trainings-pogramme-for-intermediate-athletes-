import { calculateWorkingWeight } from "./duration";
import type {
  ConditioningMovement,
  ConditioningPrescription,
  ProgramV2,
} from "./types";

const REFERENCES = {
  hang_clean_and_jerk: "clean_and_jerk",
  hang_power_snatch: "snatch",
} as const;

// Programming defaults, not a conversion from RPE to a physiological 1RM %.
// Keep barbell cycling submaximal and label calculated loads as suggestions.
function suggestedPercentage(
  conditioning: ConditioningPrescription,
  beginner: boolean,
): number {
  const rpe = conditioning.targetRpe ?? 7;
  const base = rpe <= 5 ? 30 : rpe >= 8 ? 50 : 40;
  return beginner ? Math.max(25, base - 10) : base;
}

export function applySuggestedConditioningLoads(
  program: ProgramV2,
  incrementKg: 1 | 2 | 2.5 | 5 = 2.5,
): ProgramV2 {
  if (!program.generationRequest?.known1RMs || program.status === "completed")
    return program;
  let changed = false;
  const trainingBlocks = program.trainingBlocks.map((block) => ({
    ...block,
    trainingWeeks: block.trainingWeeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) => {
        if (
          session.status !== "planned" ||
          session.feedback ||
          !session.conditioning
        )
          return session;
        const conditioning = session.conditioning;
        let sessionChanged = false;
        const resolve = (
          movement: ConditioningMovement,
        ): ConditioningMovement => {
          // Never overwrite explicit loads, including invalid values needing review.
          if (movement.loadKg != null) return movement;
          const reference =
            REFERENCES[movement.movementId as keyof typeof REFERENCES];
          if (!reference) return movement;
          const maxKg = program.generationRequest.known1RMs[reference];
          if (
            typeof maxKg !== "number" ||
            !Number.isFinite(maxKg) ||
            maxKg <= 0
          )
            return movement;
          const percentage =
            movement.percentageReference ??
            suggestedPercentage(
              conditioning,
              program.generationRequest.athleteLevel === "beginner",
            );
          if (
            !Number.isFinite(percentage) ||
            percentage <= 0 ||
            percentage > 100
          )
            return movement;
          // Avoid rounding tiny/invalid maxima up to more than the intended load.
          if ((maxKg * percentage) / 100 < incrementKg) return movement;
          sessionChanged = true;
          return {
            ...movement,
            loadKg: calculateWorkingWeight({
              maxKg,
              percentage,
              incrementKg,
              roundingMode: "down",
            }),
            percentageReference: percentage,
            loadSource: "suggested",
          };
        };
        const movements = conditioning.movements.map(resolve);
        const stations = conditioning.stations.map((station) => ({
          ...station,
          movement: resolve(station.movement),
        }));
        if (!sessionChanged) return session;
        changed = true;
        return {
          ...session,
          conditioning: { ...conditioning, movements, stations },
        };
      }),
    })),
  }));
  // This is deterministic hydration, not a completed-workout edit or new revision.
  return changed ? { ...program, trainingBlocks } : program;
}
