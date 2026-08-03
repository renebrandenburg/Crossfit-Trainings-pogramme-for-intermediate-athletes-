import type {
  ConditioningMovement,
  ConditioningPrescription,
  ExercisePrescription,
  RenderExercise,
  RenderSection,
  RenderSession,
  TrainingSession,
  WarmupExercise,
} from "./types";
import { calculateWorkingWeight } from "./duration";

function numberText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function rangeText(minimum: number, maximum: number, suffix = ""): string {
  return minimum === maximum
    ? `${numberText(minimum)}${suffix}`
    : `${numberText(minimum)}–${numberText(maximum)}${suffix}`;
}

function targetText(exercise: ExercisePrescription): string {
  if (exercise.reps != null) return `${exercise.reps} reps`;
  if (exercise.repRangeMin != null && exercise.repRangeMax != null) {
    return `${rangeText(exercise.repRangeMin, exercise.repRangeMax)} reps`;
  }
  if (exercise.durationSeconds != null) {
    return `${exercise.durationSeconds} sec`;
  }
  if (exercise.distanceMeters != null) return `${exercise.distanceMeters} m`;
  if (exercise.calories != null) return `${exercise.calories} cal`;
  return "measurable work";
}

function loadText(exercise: ExercisePrescription): string {
  if (exercise.intensityMethod === "percentage_1rm") {
    const minimum = exercise.intensityValue ?? 0;
    const maximum = exercise.intensityMax ?? minimum;
    return `${rangeText(minimum, maximum, "%")} of ${exercise.referenceLift ?? "reference lift"} 1RM`;
  }
  if (exercise.intensityMethod === "rpe") {
    const minimum = exercise.intensityValue ?? 0;
    const maximum = exercise.intensityMax ?? minimum;
    return `RPE ${rangeText(minimum, maximum)}`;
  }
  if (exercise.intensityMethod === "rir") {
    return `${numberText(exercise.intensityValue ?? 0)} RIR`;
  }
  if (exercise.intensityMethod === "fixed_load") {
    return `${numberText(exercise.loadKg ?? 0)} kg`;
  }
  if (exercise.intensityMethod === "bodyweight") return "Bodyweight";
  if (exercise.intensityMethod === "quality")
    return "Empty bar or PVC for quality";
  return "No external load";
}

function workingWeightText(exercise: ExercisePrescription): string | null {
  if (
    exercise.intensityMethod !== "percentage_1rm" ||
    exercise.referenceMaxKg == null ||
    exercise.intensityValue == null
  ) {
    return exercise.loadKg == null ? null : `${numberText(exercise.loadKg)} kg`;
  }
  const minimum = exercise.loadKg ?? 0;
  const maximumPercentage = exercise.intensityMax ?? exercise.intensityValue;
  const maximum = calculateWorkingWeight({
    maxKg: exercise.referenceMaxKg,
    percentage: maximumPercentage,
    incrementKg: 2.5,
    roundingMode: "nearest",
  });
  return `${rangeText(minimum, maximum)} kg`;
}

export function formatExercise(exercise: ExercisePrescription): RenderExercise {
  const sets = exercise.sets ?? 1;
  const target = targetText(exercise);
  const load = loadText(exercise);
  return {
    id: exercise.id,
    title: `${sets} × ${target.replace(" reps", "")} ${exercise.movementName}`,
    prescription: `${sets} sets of ${target} ${exercise.movementName} at ${load}. Rest ${exercise.restSeconds ?? 0} sec.`,
    load,
    referenceMax:
      exercise.referenceMaxKg == null
        ? null
        : `${numberText(exercise.referenceMaxKg)} kg ${exercise.referenceLift ?? "reference"} 1RM`,
    workingWeight: workingWeightText(exercise),
    rest: `${exercise.restSeconds ?? 0} sec`,
    intent: exercise.technicalIntent,
    coachingCues: exercise.coachingCues,
    scaling: exercise.scalingOptions.map(
      (option) =>
        `${option.movementName}: ${option.prescriptionAdjustment} ${option.measurableTarget}`,
    ),
    estimatedTime: `${numberText(exercise.estimatedDurationMinutes)} min`,
  };
}

function warmupTarget(exercise: WarmupExercise): string {
  if (exercise.reps != null) return `${exercise.reps} ${exercise.movementName}`;
  if (exercise.durationSeconds != null) {
    return `${exercise.durationSeconds}-sec ${exercise.movementName}`;
  }
  if (exercise.distanceMeters != null) {
    return `${exercise.distanceMeters} m ${exercise.movementName}`;
  }
  return exercise.movementName;
}

function conditioningTarget(movement: ConditioningMovement): string {
  const movementName = conditioningMovementName(movement);
  if (movement.reps != null) return `${movement.reps} ${movementName}`;
  if (movement.calories != null)
    return `${movement.calories} cal ${movementName}`;
  if (movement.distanceMeters != null) {
    return `${movement.distanceMeters} m ${movementName}`;
  }
  if (movement.durationSeconds != null) {
    return `${movement.durationSeconds}-sec ${movementName}`;
  }
  return movementName;
}

function conditioningMovementName(movement: ConditioningMovement): string {
  const titled = movement.movementName.replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );
  return titled
    .replace(/Push-(?:Up|Ups)$/i, "Push-ups")
    .replace(/Step-(?:Up|Ups)$/i, "Step-ups");
}

function emomLines(conditioning: ConditioningPrescription): string[] {
  const header = `${conditioning.durationMinutes}-minute EMOM`;
  const stations = Array.isArray(conditioning.stations)
    ? conditioning.stations
    : [];
  if (
    !conditioning.executionMode ||
    !stations.length ||
    conditioning.intervalSeconds == null
  ) {
    return [
      header,
      "EMOM structure unavailable. Confirm whether movements rotate by minute or are all completed every minute.",
      `Movements: ${conditioning.movements.map(conditioningTarget).join("; ")}`,
    ];
  }
  if (conditioning.executionMode === "rotate") {
    return [
      header,
      `${conditioning.rounds} rounds · one movement per minute`,
      ...stations.map(
        (station) =>
          `Minute ${station.minute}: ${conditioningTarget(station.movement)}`,
      ),
      `Repeat until ${conditioning.durationMinutes} minutes are complete.`,
    ];
  }
  return [
    header,
    `${conditioning.rounds} rounds · complete all movements every minute`,
    "Every minute:",
    ...stations.map((station) => `• ${conditioningTarget(station.movement)}`),
  ];
}

function conditioningHeader(conditioning: ConditioningPrescription): string {
  if (conditioning.format === "amrap") {
    return `${conditioning.durationMinutes}-minute AMRAP`;
  }
  if (conditioning.format === "emom") {
    return `${conditioning.durationMinutes}-minute EMOM`;
  }
  if (conditioning.format === "for_time") {
    return `${conditioning.rounds} rounds for time — cap ${conditioning.timeCapMinutes} min; target ${conditioning.targetDurationMin}–${conditioning.targetDurationMax} min`;
  }
  if (conditioning.format === "intervals") {
    return `${conditioning.rounds} intervals: ${conditioning.workSeconds} sec work / ${conditioning.restSeconds} sec rest`;
  }
  if (conditioning.format === "zone_2") {
    return `${conditioning.durationMinutes} minutes Zone 2`;
  }
  return `${conditioning.rounds} rounds for quality`;
}

function exerciseSection(
  session: TrainingSession,
  section: "primary" | "secondary" | "accessory",
  title: string,
): RenderSection {
  const duration =
    session.sections.find((item) => item.section === section)
      ?.estimatedDurationMinutes ?? 0;
  return {
    id: `${session.id}-${section}`,
    title,
    estimatedTime: `${numberText(duration)} min`,
    exercises: session.exercises
      .filter((item) => item.section === section)
      .map(formatExercise),
    lines: [],
  };
}

function maxTestLines(session: TrainingSession): string[] {
  const test = session.maxTestPrescription;
  if (!test) return [];
  const lines = [
    `Test type: ${test.testType.replaceAll("_", " ")}`,
    `Movement: ${test.movementName}`,
    `Eligibility: ${test.eligibility.eligible ? "ready" : "conditional"} · readiness ${test.eligibility.readinessScore}/100`,
  ];
  if (test.previousMaxKg != null) {
    lines.push(`Previous tested max: ${numberText(test.previousMaxKg)} kg`);
  }
  if (test.trainingMaxKg != null) {
    lines.push(`Current training max: ${numberText(test.trainingMaxKg)} kg`);
  }
  if (!test.eligibility.eligible) {
    lines.push(`Fallback: ${test.fallbackPrescription}`);
    lines.push(`Eligibility reasons: ${test.eligibility.reasons.join(" ")}`);
  }
  lines.push("Warm-up and build-up:");
  lines.push(
    ...test.warmupSets.map(
      (set) =>
        `• ${set.reps} reps${set.loadKg == null ? "" : ` at ${numberText(set.loadKg)} kg`} · rest ${set.restSeconds} sec · ${set.purpose}`,
    ),
  );
  lines.push("Planned attempts:");
  lines.push(
    ...test.plannedAttempts.map(
      (attempt) =>
        `• Attempt ${attempt.attemptNumber} (${attempt.attemptType.replaceAll("_", " ")}): ${attempt.suggestedLoadKg == null ? "choose a safe load" : `${numberText(attempt.suggestedLoadKg)} kg`} · rest ${attempt.restSeconds} sec${attempt.optional ? " · optional" : ""}`,
    ),
  );
  lines.push(`Minimum rest: ${test.minimumRestSeconds} sec`);
  lines.push(`Maximum heavy attempts: ${test.maximumAttempts}`);
  if (test.technicalStandards) {
    lines.push(
      `Technical criteria: ${test.technicalStandards.criteria.join(" ")}`,
    );
    lines.push(
      `Invalidation criteria: ${test.technicalStandards.invalidationCriteria.join(" ")}`,
    );
  }
  lines.push(`Stopping rules: ${test.stoppingRules.join(" ")}`);
  if (test.attemptResults.length) {
    lines.push(
      `Recorded attempts: ${test.attemptResults
        .map(
          (result) =>
            `${result.attemptNumber} ${result.loadKg} kg ${result.result}`,
        )
        .join(", ")}`,
    );
  }
  if (test.maxUpdate?.accepted) {
    lines.push(
      `Max update proposed: ${numberText(test.maxUpdate.maxKg ?? 0)} kg · training max ${numberText(test.maxUpdate.trainingMaxKg ?? 0)} kg`,
    );
  }
  return lines;
}

export function formatSessionForDisplay(
  session: TrainingSession,
): RenderSession {
  const conditioning = session.conditioning;
  const sections: RenderSection[] = [
    {
      id: `${session.id}-warmup`,
      title: "Warm-up",
      estimatedTime: `${numberText(session.warmup.durationMinutes)} min`,
      exercises: [],
      lines: [
        `${session.warmup.rounds ?? 1} rounds: ${session.warmup.exercises
          .map(warmupTarget)
          .join(", ")}.`,
        `Purpose: ${session.warmup.purpose}`,
      ],
    },
    exerciseSection(session, "primary", "Primary progression"),
    exerciseSection(session, "secondary", "Secondary progression"),
  ];
  if (session.sessionType === "max_test" && session.maxTestPrescription) {
    sections.push({
      id: `${session.id}-max-test`,
      title: "Max test",
      estimatedTime: `${numberText(session.maxTestPrescription.estimatedDurationMinutes)} min`,
      exercises: [],
      lines: maxTestLines(session),
    });
  }
  if (conditioning) {
    sections.push({
      id: `${session.id}-conditioning`,
      title: "Conditioning",
      estimatedTime: `${numberText(conditioning.estimatedDurationMinutes)} min`,
      exercises: [],
      lines: [
        ...(conditioning.format === "emom"
          ? emomLines(conditioning)
          : [
              `${conditioningHeader(conditioning)}: ${conditioning.movements
                .map(conditioningTarget)
                .join(", ")}.`,
            ]),
        `Stimulus: ${conditioning.intendedStimulus}`,
        `Scaling: ${conditioning.scalingOptions
          .map(
            (option) =>
              `${option.prescriptionAdjustment} ${option.measurableTarget}`,
          )
          .join(" ")}`,
      ],
    });
  }
  sections.push(exerciseSection(session, "accessory", "Accessory or cooldown"));
  return {
    id: session.id,
    weekNumber: session.weekNumber,
    sessionNumber: session.sessionNumber,
    heading: `Week ${session.weekNumber} – Session ${session.sessionNumber}`,
    objective: session.objective,
    estimatedTime: `${session.estimatedDurationMinutes} min`,
    fatigue: `${session.expectedFatigue}, ${session.fatigueFocus.replaceAll("_", " ")}`,
    provisional: session.provisional,
    communityWorkoutAdvice: session.communityWorkoutAdvice,
    sections,
  };
}
