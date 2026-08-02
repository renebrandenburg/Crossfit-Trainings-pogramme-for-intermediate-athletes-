import { getMovement } from "./catalog";
import type {
  ConditioningPrescription,
  ExercisePrescription,
  ProgramV2,
  TrainingBlock,
  TrainingSession,
  TrainingWeek,
  ValidationIssue,
  ValidationResult,
} from "./types";
import { VALIDATOR_VERSION } from "./types";

const PROHIBITED_LANGUAGE = [
  "or similar",
  "as needed",
  "some",
  "a few",
  "practice",
  "work on",
  "clean or snatch",
  "clean pulls or snatch pulls",
  "moderate weight",
  "heavy weight",
  "challenging load",
  "comfortable pace",
  "pick a movement",
  "choose a variation",
];

function issue(
  code: string,
  severity: "error" | "warning",
  path: string,
  message: string,
): ValidationIssue {
  return { code, severity, path, message };
}

function result(issues: ValidationIssue[]): ValidationResult {
  return {
    valid: !issues.some((item) => item.severity === "error"),
    validatorVersion: VALIDATOR_VERSION,
    issues,
  };
}

function hasMeasurableTarget(exercise: ExercisePrescription): boolean {
  return Boolean(
    exercise.reps != null ||
    (exercise.repRangeMin != null && exercise.repRangeMax != null) ||
    exercise.durationSeconds != null ||
    exercise.distanceMeters != null ||
    exercise.calories != null,
  );
}

function hasIntensity(exercise: ExercisePrescription): boolean {
  if (["bodyweight", "quality"].includes(exercise.intensityMethod)) return true;
  if (exercise.intensityMethod === "percentage_1rm") {
    return (
      exercise.intensityValue != null &&
      exercise.referenceLift != null &&
      (exercise.referenceMaxKg != null || exercise.intensityMax != null)
    );
  }
  if (exercise.intensityMethod === "fixed_load") {
    return exercise.loadKg != null;
  }
  if (["rpe", "rir"].includes(exercise.intensityMethod)) {
    return exercise.intensityValue != null;
  }
  return false;
}

export function validateGeneratedLanguage(
  content: string,
  path = "content",
): ValidationResult {
  const normalized = content.toLowerCase();
  const issues: ValidationIssue[] = [];
  for (const phrase of PROHIBITED_LANGUAGE) {
    if (normalized.includes(phrase)) {
      issues.push(
        issue(
          "PROHIBITED_LANGUAGE",
          "error",
          path,
          `Replace ambiguous phrase “${phrase}” with one measurable prescription.`,
        ),
      );
    }
  }
  if (/\b(clean|snatch)\s+(?:pulls?\s+)?or\s+(clean|snatch)\b/i.test(content)) {
    issues.push(
      issue(
        "MULTIPLE_ALTERNATIVE_MOVEMENTS",
        "error",
        path,
        "Select one explicit Olympic-lifting movement.",
      ),
    );
  }
  return result(issues);
}

export function validateAthleteFacingString(
  content: string,
  path = "content",
): ValidationResult {
  const issues = [...validateGeneratedLanguage(content, path).issues];
  const normalized = content.toLowerCase();
  const loadedPattern =
    /\b(pull|squat|press|deadlift|hold|carry|snatch|clean|jerk|row|lunge)s?\b/i;
  const loadPattern =
    /\b\d+(?:\.\d+)?\s*kg\b|\b\d+(?:[–-]\d+)?%\s+of\b|\brpe\s*\d|\bempty[- ]bar\b|\bpvc\b|\breuse (?:the )?load\b|\bsame load\b/i;
  const restPattern = /\brest\b|\bemom\b|\bevery\s+\d+\s*(?:sec|min)/i;
  if (
    normalized.startsWith("gymnastics skill:") &&
    !/\b\d+\s*(?:sets?|rounds?|reps?|seconds?|sec)|\bemom\b/i.test(content)
  ) {
    issues.push(
      issue(
        "INCOMPLETE_GYMNASTICS_PRESCRIPTION",
        "error",
        path,
        "A gymnastics theme cannot be rendered as a complete prescription.",
      ),
    );
  }
  if (loadedPattern.test(content) && !loadPattern.test(content)) {
    issues.push(
      issue(
        "MISSING_LOAD",
        "error",
        path,
        "Loaded movement text requires measurable load guidance.",
      ),
    );
  }
  if (/\b\d+\s+sets?:/i.test(content) && !restPattern.test(content)) {
    issues.push(
      issue(
        "MISSING_REST",
        "error",
        path,
        "Set-based athlete-facing text requires rest guidance.",
      ),
    );
  }
  return result(issues);
}

export function validateExercisePrescription(
  exercise: ExercisePrescription,
  path = `exercises.${exercise.id}`,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const movement = getMovement(exercise.movementId);
  if (!exercise.movementId || !exercise.movementName) {
    issues.push(
      issue("MISSING_MOVEMENT", "error", path, "Movement is required."),
    );
  }
  if (!movement) {
    issues.push(
      issue(
        "UNKNOWN_MOVEMENT",
        "error",
        `${path}.movementId`,
        `Unknown movement ${exercise.movementId}.`,
      ),
    );
  } else {
    if (movement.familyId !== exercise.movementFamilyId) {
      issues.push(
        issue(
          "UNKNOWN_MOVEMENT_FAMILY",
          "error",
          `${path}.movementFamilyId`,
          "Movement family does not match the movement catalog.",
        ),
      );
    }
    if (!movement.allowedContexts.includes(exercise.section)) {
      issues.push(
        issue(
          "DRILL_INVALID_SECTION",
          "error",
          `${path}.section`,
          `${movement.name} is not allowed in ${exercise.section}.`,
        ),
      );
    }
    if (movement.isTechniqueDrill && exercise.section === "conditioning") {
      issues.push(
        issue(
          "DRILL_INVALID_SECTION",
          "error",
          `${path}.section`,
          "Olympic-lifting technique drills cannot be conditioning movements.",
        ),
      );
    }
    if (movement.loadable && !hasIntensity(exercise)) {
      issues.push(
        issue(
          "MISSING_LOAD",
          "error",
          `${path}.intensityMethod`,
          "Loaded movement requires a percentage, fixed load, RPE, or explicit empty-bar instruction.",
        ),
      );
    }
    if (
      movement.isIsometric &&
      movement.loadable &&
      !["bodyweight", "quality"].includes(exercise.intensityMethod) &&
      !hasIntensity(exercise)
    ) {
      issues.push(
        issue(
          "LOADED_HOLD_WITHOUT_LOAD",
          "error",
          `${path}.intensityMethod`,
          "A loaded hold requires measurable load guidance.",
        ),
      );
    }
  }
  if (exercise.sets == null || exercise.sets < 1) {
    issues.push(
      issue("MISSING_SETS", "error", `${path}.sets`, "Sets are required."),
    );
  }
  if (!hasMeasurableTarget(exercise)) {
    issues.push(
      issue(
        "MISSING_REPETITIONS_OR_DURATION",
        "error",
        path,
        "Repetitions, duration, distance, or calories are required.",
      ),
    );
  }
  if (exercise.restSeconds == null || exercise.restSeconds < 0) {
    issues.push(
      issue(
        "MISSING_REST",
        "error",
        `${path}.restSeconds`,
        "Rest is required.",
      ),
    );
  }
  if (!exercise.technicalIntent.trim()) {
    issues.push(
      issue(
        "MISSING_TECHNICAL_INTENT",
        "error",
        `${path}.technicalIntent`,
        "Technical intent is required.",
      ),
    );
  }
  if (
    !Number.isFinite(exercise.estimatedDurationMinutes) ||
    exercise.estimatedDurationMinutes <= 0
  ) {
    issues.push(
      issue(
        "MISSING_DURATION_ESTIMATE",
        "error",
        `${path}.estimatedDurationMinutes`,
        "Exercise duration estimate is required.",
      ),
    );
  }
  if (
    exercise.intensityMethod === "percentage_1rm" &&
    (exercise.intensityValue == null ||
      exercise.intensityValue <= 0 ||
      (exercise.intensityMax ?? exercise.intensityValue) > 100)
  ) {
    issues.push(
      issue(
        "UNSAFE_PERCENTAGE",
        "error",
        `${path}.intensityValue`,
        "Percentage must be greater than zero and no higher than 100%.",
      ),
    );
  }
  if (movement?.category === "gymnastics") {
    if (!exercise.progressionObjective?.trim()) {
      issues.push(
        issue(
          "GYMNASTICS_MISSING_OBJECTIVE",
          "error",
          `${path}.progressionObjective`,
          "Gymnastics work requires a progression objective.",
        ),
      );
    }
    if (!exercise.scalingOptions.length) {
      issues.push(
        issue(
          "GYMNASTICS_MISSING_SCALING",
          "error",
          `${path}.scalingOptions`,
          "Gymnastics work requires measurable scaling.",
        ),
      );
    }
    if (!exercise.stoppingRule?.trim()) {
      issues.push(
        issue(
          "GYMNASTICS_MISSING_STOPPING_RULE",
          "error",
          `${path}.stoppingRule`,
          "Gymnastics work requires a stopping rule.",
        ),
      );
    }
  }
  const languageFields = [
    exercise.movementName,
    exercise.technicalIntent,
    exercise.progressionObjective ?? "",
    exercise.stoppingRule ?? "",
    ...exercise.coachingCues,
    ...exercise.scalingOptions.flatMap((item) => [
      item.prescriptionAdjustment,
      item.measurableTarget,
    ]),
  ];
  languageFields.forEach((content, index) => {
    issues.push(
      ...validateGeneratedLanguage(content, `${path}.language.${index}`).issues,
    );
  });
  return result(issues);
}

export function validateConditioningPrescription(
  conditioning: ConditioningPrescription,
  path = `conditioning.${conditioning.id}`,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!conditioning.movements.length) {
    issues.push(
      issue(
        "MISSING_MOVEMENT",
        "error",
        `${path}.movements`,
        "Conditioning movements are required.",
      ),
    );
  }
  for (const [index, movement] of conditioning.movements.entries()) {
    const catalogMovement = getMovement(movement.movementId);
    if (!catalogMovement) {
      issues.push(
        issue(
          "UNKNOWN_MOVEMENT",
          "error",
          `${path}.movements.${index}`,
          `Unknown conditioning movement ${movement.movementId}.`,
        ),
      );
      continue;
    }
    if (!catalogMovement.allowedContexts.includes("conditioning")) {
      issues.push(
        issue(
          "DRILL_INVALID_SECTION",
          "error",
          `${path}.movements.${index}`,
          `${catalogMovement.name} is not allowed in conditioning.`,
        ),
      );
    }
    if (
      movement.reps == null &&
      movement.calories == null &&
      movement.distanceMeters == null &&
      movement.durationSeconds == null
    ) {
      issues.push(
        issue(
          "MISSING_REPETITIONS_OR_DURATION",
          "error",
          `${path}.movements.${index}`,
          "Every conditioning movement requires a measurable target.",
        ),
      );
    }
  }
  if (!conditioning.intendedStimulus.trim()) {
    issues.push(
      issue(
        "CONDITIONING_MISSING_STIMULUS",
        "error",
        `${path}.intendedStimulus`,
        "Conditioning intended stimulus is required.",
      ),
    );
  }
  if (!conditioning.scalingOptions.length) {
    issues.push(
      issue(
        "CONDITIONING_MISSING_SCALING",
        "error",
        `${path}.scalingOptions`,
        "Conditioning requires measurable scaling.",
      ),
    );
  }
  if (
    ["amrap", "emom", "zone_2"].includes(conditioning.format) &&
    conditioning.durationMinutes == null
  ) {
    issues.push(
      issue(
        conditioning.format === "emom"
          ? "EMOM_MISSING_DURATION"
          : "CONDITIONING_MISSING_DURATION",
        "error",
        `${path}.durationMinutes`,
        "Conditioning duration is required.",
      ),
    );
  }
  if (conditioning.format === "intervals" && conditioning.restSeconds == null) {
    issues.push(
      issue(
        "INTERVAL_MISSING_REST",
        "error",
        `${path}.restSeconds`,
        "Intervals require rest.",
      ),
    );
  }
  if (
    conditioning.format === "for_time" &&
    conditioning.timeCapMinutes == null &&
    (conditioning.targetDurationMin == null ||
      conditioning.targetDurationMax == null)
  ) {
    issues.push(
      issue(
        "FOR_TIME_MISSING_CAP",
        "error",
        path,
        "For-time work requires a time cap or target finish range.",
      ),
    );
  }
  if (
    !Number.isFinite(conditioning.estimatedDurationMinutes) ||
    conditioning.estimatedDurationMinutes <= 0
  ) {
    issues.push(
      issue(
        "MISSING_DURATION_ESTIMATE",
        "error",
        `${path}.estimatedDurationMinutes`,
        "Conditioning duration estimate is required.",
      ),
    );
  }
  issues.push(
    ...validateGeneratedLanguage(
      conditioning.intendedStimulus,
      `${path}.intendedStimulus`,
    ).issues,
  );
  return result(issues);
}

export function validateSession(
  session: TrainingSession,
  path = `sessions.${session.id}`,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  session.exercises.forEach((exercise, index) => {
    issues.push(
      ...validateExercisePrescription(exercise, `${path}.exercises.${index}`)
        .issues,
    );
  });
  if (session.conditioning) {
    issues.push(
      ...validateConditioningPrescription(
        session.conditioning,
        `${path}.conditioning`,
      ).issues,
    );
  }
  if (
    !session.warmup ||
    session.warmup.durationMinutes <= 0 ||
    !session.warmup.exercises.length
  ) {
    issues.push(
      issue(
        "MISSING_WARMUP",
        "error",
        `${path}.warmup`,
        "A specific warm-up is required.",
      ),
    );
  }
  if (!Number.isFinite(session.estimatedDurationMinutes)) {
    issues.push(
      issue(
        "MISSING_DURATION_ESTIMATE",
        "error",
        `${path}.estimatedDurationMinutes`,
        "Session duration estimate is required.",
      ),
    );
  } else if (session.estimatedDurationMinutes > 65) {
    issues.push(
      issue(
        "SESSION_TOO_LONG",
        "error",
        `${path}.estimatedDurationMinutes`,
        "Session exceeds the 65-minute maximum.",
      ),
    );
  } else if (session.estimatedDurationMinutes > 60) {
    issues.push(
      issue(
        "SESSION_LONG",
        "warning",
        `${path}.estimatedDurationMinutes`,
        "Session is above the 60-minute target.",
      ),
    );
  } else if (
    session.estimatedDurationMinutes < 45 &&
    session.weekNumber !== 6
  ) {
    issues.push(
      issue(
        "SESSION_SHORT",
        "warning",
        `${path}.estimatedDurationMinutes`,
        "Session is shorter than 45 minutes outside the deload week.",
      ),
    );
  }
  const sectionTotal = session.sections.reduce(
    (total, section) => total + section.estimatedDurationMinutes,
    0,
  );
  if (Math.abs(sectionTotal - session.estimatedDurationMinutes) > 1) {
    issues.push(
      issue(
        "SECTION_DURATION_MISMATCH",
        "error",
        `${path}.sections`,
        `Section total ${sectionTotal} does not match session estimate ${session.estimatedDurationMinutes}.`,
      ),
    );
  }
  const primaryMovementIds = session.exercises
    .filter((exercise) => exercise.section === "primary")
    .map((exercise) => exercise.movementId);
  if (new Set(primaryMovementIds).size !== primaryMovementIds.length) {
    issues.push(
      issue(
        "DUPLICATE_PRIMARY_MOVEMENT",
        "error",
        `${path}.exercises`,
        "Primary movement is duplicated without a progression reason.",
      ),
    );
  }
  if (
    session.stress.gripVolumeScore >= 7 &&
    session.stress.skillComplexityScore >= 7
  ) {
    issues.push(
      issue(
        "HIGH_SKILL_AFTER_GRIP_FATIGUE",
        "warning",
        `${path}.stress`,
        "High-skill gymnastics is paired with severe grip demand.",
      ),
    );
  }
  if (session.equipmentTransitions.length > 5) {
    issues.push(
      issue(
        "TOO_MANY_EQUIPMENT_TRANSITIONS",
        "warning",
        `${path}.equipmentTransitions`,
        "Session contains more than five equipment transitions.",
      ),
    );
  }
  return result(issues);
}

export function validateTrainingWeek(
  week: TrainingWeek,
  path = `weeks.${week.weekNumber}`,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (week.sessions.length !== 2) {
    issues.push(
      issue(
        "INVALID_WEEK_SESSION_COUNT",
        "error",
        `${path}.sessions`,
        "A V2 training week requires exactly two app sessions.",
      ),
    );
  }
  week.sessions.forEach((session, index) => {
    issues.push(
      ...validateSession(session, `${path}.sessions.${index}`).issues,
    );
  });
  if (
    week.sessions.length === 2 &&
    week.sessions.every((session) => session.stress.lowerBodyVolumeScore >= 7)
  ) {
    issues.push(
      issue(
        "CONSECUTIVE_HEAVY_LOWER_BODY",
        "warning",
        `${path}.sessions`,
        "Both app sessions have high lower-body stress.",
      ),
    );
  }
  return result(issues);
}

export function validateTrainingBlock(
  block: TrainingBlock,
  path = `blocks.${block.id}`,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (block.durationWeeks !== 6 || block.trainingWeeks.length !== 6) {
    issues.push(
      issue(
        "INVALID_BLOCK_DURATION",
        "error",
        `${path}.durationWeeks`,
        "The initial mixed-strength block requires six weeks.",
      ),
    );
  }
  block.trainingWeeks.forEach((week, index) => {
    issues.push(
      ...validateTrainingWeek(week, `${path}.trainingWeeks.${index}`).issues,
    );
  });
  if (block.blockType === "mixed_strength") {
    const exerciseFamilies = block.trainingWeeks.flatMap((week) =>
      week.sessions.flatMap((session) =>
        session.exercises.map((exercise) => exercise.movementFamilyId),
      ),
    );
    if (!exerciseFamilies.includes("snatch")) {
      issues.push(
        issue(
          "MISSING_SNATCH_EXPOSURE",
          "error",
          path,
          "A mixed-strength block must contain snatch exposure.",
        ),
      );
    }
    if (!exerciseFamilies.includes("clean_and_jerk")) {
      issues.push(
        issue(
          "MISSING_CLEAN_AND_JERK_EXPOSURE",
          "error",
          path,
          "A mixed-strength block must contain clean-and-jerk exposure.",
        ),
      );
    }
  }
  for (const track of block.progressionTracks) {
    for (const step of track.steps) {
      if (track.trackType === "snatch" && step.movementFamilyId !== "snatch") {
        issues.push(
          issue(
            "SNATCH_TRACK_WRONG_FAMILY",
            "error",
            `${path}.tracks.${track.id}.steps.${step.stepNumber}`,
            "A snatch track may use only snatch-family movements.",
          ),
        );
      }
      if (
        track.trackType === "clean_and_jerk" &&
        step.movementFamilyId !== "clean_and_jerk"
      ) {
        issues.push(
          issue(
            "CLEAN_TRACK_WRONG_FAMILY",
            "error",
            `${path}.tracks.${track.id}.steps.${step.stepNumber}`,
            "A clean-and-jerk track may use only clean-and-jerk-family movements.",
          ),
        );
      }
    }
  }
  return result(issues);
}

export function validateProgram(program: ProgramV2): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (program.engineVersion !== "v2" || program.schemaVersion !== 2) {
    issues.push(
      issue(
        "INVALID_ENGINE_VERSION",
        "error",
        "program.engineVersion",
        "Expected a V2 programme graph.",
      ),
    );
  }
  if (!program.trainingBlocks.length) {
    issues.push(
      issue(
        "MISSING_TRAINING_BLOCK",
        "error",
        "program.trainingBlocks",
        "Training block is required.",
      ),
    );
  }
  program.trainingBlocks.forEach((block, index) => {
    issues.push(
      ...validateTrainingBlock(block, `program.trainingBlocks.${index}`).issues,
    );
  });
  return result(issues);
}

export function assertValidProgram(program: ProgramV2): ProgramV2 {
  const validation = validateProgram(program);
  if (!validation.valid) {
    const error = new Error(
      `Invalid V2 programme: ${validation.issues
        .filter((item) => item.severity === "error")
        .map((item) => item.code)
        .join(", ")}`,
    );
    error.name = "ProgramV2ValidationError";
    throw error;
  }
  return { ...program, validation };
}
