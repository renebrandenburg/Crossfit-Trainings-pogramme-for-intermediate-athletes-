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
import { validateMaxTestPrescription } from "./max-testing";
import { getV2TemplateDefinition } from "./template";

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
  if (conditioning.format === "emom") {
    const stations = Array.isArray(conditioning.stations)
      ? conditioning.stations
      : [];
    const hasExplicitStructure =
      conditioning.executionMode != null && stations.length > 0;
    if (!hasExplicitStructure) {
      issues.push(
        issue(
          "EMOM_STRUCTURE_UNAVAILABLE",
          "warning",
          path,
          "EMOM minute assignments are unavailable; confirm whether movements rotate or repeat every minute.",
        ),
      );
    } else {
      const executionMode = conditioning.executionMode;
      const intervalSeconds = conditioning.intervalSeconds;
      if (executionMode !== "rotate" && executionMode !== "all-every-minute") {
        issues.push(
          issue(
            "EMOM_INVALID_EXECUTION_MODE",
            "error",
            `${path}.executionMode`,
            "EMOM execution mode must be rotate or all-every-minute.",
          ),
        );
      }
      if (
        !Number.isInteger(conditioning.intervalSeconds) ||
        intervalSeconds == null ||
        intervalSeconds <= 0
      ) {
        issues.push(
          issue(
            "EMOM_INVALID_INTERVAL",
            "error",
            `${path}.intervalSeconds`,
            "EMOM interval must be a positive whole number of seconds.",
          ),
        );
      }
      const stationCount = stations.length;
      stations.forEach((station, index) => {
        if (station.minute !== index + 1) {
          issues.push(
            issue(
              "EMOM_INVALID_MINUTE",
              "error",
              `${path}.stations.${index}.minute`,
              "EMOM stations must use consecutive minute numbers starting at 1.",
            ),
          );
        }
        if (!station.movement) {
          issues.push(
            issue(
              "EMOM_MISSING_STATION_MOVEMENT",
              "error",
              `${path}.stations.${index}.movement`,
              "Every EMOM station requires a movement.",
            ),
          );
        } else if (
          conditioning.movements[index]?.movementId !==
          station.movement.movementId
        ) {
          issues.push(
            issue(
              "EMOM_STATION_MOVEMENT_MISMATCH",
              "error",
              `${path}.stations.${index}.movement`,
              "EMOM station order must match the conditioning movement order.",
            ),
          );
        }
      });
      const totalIntervals =
        conditioning.durationMinutes == null ||
        !Number.isInteger(conditioning.intervalSeconds)
          ? null
          : (conditioning.durationMinutes * 60) / Number(intervalSeconds);
      const expectedRounds =
        totalIntervals == null
          ? null
          : conditioning.executionMode === "rotate"
            ? totalIntervals / stationCount
            : totalIntervals;
      if (
        totalIntervals == null ||
        !Number.isInteger(totalIntervals) ||
        (executionMode === "rotate" && !Number.isInteger(expectedRounds))
      ) {
        issues.push(
          issue(
            "EMOM_DURATION_NOT_COMPATIBLE",
            "error",
            `${path}.durationMinutes`,
            "EMOM duration must resolve to complete minute intervals and rotations.",
          ),
        );
      } else if (conditioning.rounds !== expectedRounds) {
        issues.push(
          issue(
            "EMOM_ROUNDS_MISMATCH",
            "error",
            `${path}.rounds`,
            `EMOM rounds must equal ${expectedRounds} for the duration and execution mode.`,
          ),
        );
      }
    }
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
  if (session.sessionType === "max_test") {
    if (!session.maxTestPrescription) {
      issues.push(
        issue(
          "MAX_TEST_MISSING_PRESCRIPTION",
          "error",
          `${path}.maxTestPrescription`,
          "Max-test sessions require a structured test prescription.",
        ),
      );
    } else {
      issues.push(
        ...validateMaxTestPrescription(session.maxTestPrescription).map(
          (message) =>
            issue(
              "INVALID_MAX_TEST_PRESCRIPTION",
              "error",
              `${path}.maxTestPrescription`,
              message,
            ),
        ),
      );
      if (!session.maxTestPrescription.eligibility.eligible) {
        issues.push(
          issue(
            "MAX_TEST_PENDING_ELIGIBILITY",
            "warning",
            `${path}.maxTestPrescription.eligibility`,
            "Max test remains conditional until prerequisite readiness is confirmed; use the defined fallback if it is still ineligible.",
          ),
        );
      }
    }
  } else if (session.maxTestPrescription) {
    issues.push(
      issue(
        "UNEXPECTED_MAX_TEST_PRESCRIPTION",
        "error",
        `${path}.maxTestPrescription`,
        "Only max-test sessions may contain a max-test prescription.",
      ),
    );
  }
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
  const expectedSessionCount = week.plannedSessionCount ?? 2;
  if (week.sessions.length !== expectedSessionCount) {
    issues.push(
      issue(
        "INVALID_WEEK_SESSION_COUNT",
        "error",
        `${path}.sessions`,
        `A V2 training week requires exactly ${expectedSessionCount} app sessions.`,
      ),
    );
  }
  week.sessions.forEach((session, index) => {
    issues.push(
      ...validateSession(session, `${path}.sessions.${index}`).issues,
    );
  });
  if (
    week.sessions.length >= 2 &&
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
  const expectedDuration =
    block.templateId === "mixed_strength_8w_testing" ? 8 : 6;
  if (
    block.durationWeeks !== expectedDuration ||
    block.trainingWeeks.length !== expectedDuration
  ) {
    issues.push(
      issue(
        "INVALID_BLOCK_DURATION",
        "error",
        `${path}.durationWeeks`,
        `The ${expectedDuration}-week V2 block requires exactly ${expectedDuration} weeks.`,
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
  if (
    block.blockType === "competition_preparation" ||
    block.blockType === "open_preparation" ||
    block.blockType === "masters_open_preparation"
  ) {
    const expectedTemplateId =
      block.blockType === "competition_preparation"
        ? "competition_preparation_6w"
        : block.blockType === "open_preparation"
          ? "open_preparation_6w"
          : "masters_open_preparation_6w";
    const legacyMastersTemplate =
      block.blockType === "masters_open_preparation" &&
      block.templateId === "masters_open_preparation_six_week";
    if (block.templateId !== expectedTemplateId && !legacyMastersTemplate) {
      issues.push(
        issue(
          "OPEN_PREP_WRONG_TEMPLATE",
          "error",
          `${path}.templateId`,
          "Competition, Open, and Masters/Open programmes require their dedicated template.",
        ),
      );
    }
    if (legacyMastersTemplate) {
      issues.push(
        issue(
          "LEGACY_OPEN_PREP_TEMPLATE",
          "warning",
          `${path}.templateId`,
          "This Masters/Open programme uses the legacy shared template and should be regenerated as a new programme.",
        ),
      );
    }
    const sessions = block.trainingWeeks.flatMap((week) => week.sessions);
    const conditioning = sessions
      .map((session) => session.conditioning)
      .filter(Boolean);
    if (
      !legacyMastersTemplate &&
      !conditioning.some((item) => item?.competitionMetadata?.competitionStyle)
    ) {
      issues.push(
        issue(
          "OPEN_PREP_MISSING_COMPETITION_CONDITIONING",
          "error",
          path,
          "Competition preparation requires competition-specific conditioning.",
        ),
      );
    }
    if (
      !legacyMastersTemplate &&
      !conditioning.some((item) => item?.competitionMetadata?.pacingPlan.length)
    ) {
      issues.push(
        issue(
          "OPEN_PREP_MISSING_PACING",
          "error",
          path,
          "Competition preparation requires measurable pacing guidance.",
        ),
      );
    }
    if (
      !legacyMastersTemplate &&
      !conditioning.some(
        (item) => item?.competitionMetadata?.movementStandards.length,
      )
    ) {
      issues.push(
        issue(
          "OPEN_PREP_MISSING_STANDARDS",
          "error",
          path,
          "Competition preparation requires movement standards.",
        ),
      );
    }
    if (
      !legacyMastersTemplate &&
      !conditioning.some((item) => item?.competitionMetadata?.scoreType)
    ) {
      issues.push(
        issue(
          "OPEN_PREP_MISSING_SCORING",
          "error",
          path,
          "Competition preparation requires score recording metadata.",
        ),
      );
    }
    for (const weekNumber of legacyMastersTemplate
      ? []
      : block.blockType === "competition_preparation"
        ? [5]
        : [4, 5]) {
      const week = block.trainingWeeks.find(
        (item) => item.weekNumber === weekNumber,
      );
      if (
        !week?.sessions.some(
          (session) =>
            session.conditioning?.competitionMetadata?.competitionStyle,
        )
      ) {
        issues.push(
          issue(
            "OPEN_PREP_MISSING_SIMULATION",
            "error",
            `${path}.trainingWeeks.${weekNumber}`,
            "The required competition or Open simulation week is missing.",
          ),
        );
      }
    }
    if (
      !legacyMastersTemplate &&
      sessions.some((session) => session.provisional)
    ) {
      issues.push(
        issue(
          "OPEN_PREP_INTERNAL_PROVISIONAL",
          "error",
          path,
          "Competition, Open, and Masters/Open sessions must be actionable at creation.",
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
  if (
    program.generationSource !== undefined &&
    !["generated", "fallback", "mock"].includes(program.generationSource)
  ) {
    issues.push(
      issue(
        "MISSING_GENERATION_SOURCE",
        "warning",
        "program.generationSource",
        "Generation source must be explicitly recorded.",
      ),
    );
  }
  if (
    program.generationSource !== undefined &&
    program.generationSource !== "generated"
  ) {
    issues.push(
      issue(
        "NON_PRODUCTION_GENERATION_SOURCE",
        "error",
        "program.generationSource",
        "Fallback and mock programmes cannot be treated as production V2 programmes.",
      ),
    );
  }
  const programmeIds = new Set<string>();
  const weekIds = new Set<string>();
  const sessionIds = new Set<string>();
  for (const block of program.trainingBlocks) {
    if (block.programId !== program.id) {
      issues.push(
        issue(
          "BLOCK_PROGRAM_MISMATCH",
          "error",
          `program.trainingBlocks.${block.id}.programId`,
          "Training block does not belong to the generated programme.",
        ),
      );
    }
    if (programmeIds.has(program.id)) {
      issues.push(
        issue(
          "DUPLICATE_PROGRAM_ID",
          "error",
          "program.id",
          "Programme IDs must be unique within the generated graph.",
        ),
      );
    }
    programmeIds.add(program.id);
    try {
      const template = getV2TemplateDefinition(block.templateId, {
        allowDefault: false,
      });
      if (
        program.generationRequest?.programmeType !== undefined &&
        program.generationRequest.programmeType !== template.id
      ) {
        issues.push(
          issue(
            "PROGRAMME_TYPE_MISMATCH",
            "error",
            "program.generationRequest.programmeType",
            "Generated programme type does not match its block template.",
          ),
        );
      }
    } catch {
      issues.push(
        issue(
          "UNSUPPORTED_TEMPLATE",
          "error",
          `program.trainingBlocks.${block.id}.templateId`,
          "Generated programme uses an unsupported template.",
        ),
      );
    }
    for (const week of block.trainingWeeks) {
      if (weekIds.has(week.id)) {
        issues.push(
          issue(
            "DUPLICATE_WEEK_ID",
            "error",
            `program.weeks.${week.id}`,
            "Week IDs must be unique.",
          ),
        );
      }
      weekIds.add(week.id);
      for (const session of week.sessions) {
        if (sessionIds.has(session.id)) {
          issues.push(
            issue(
              "DUPLICATE_SESSION_ID",
              "error",
              `program.sessions.${session.id}`,
              "Session IDs must be unique.",
            ),
          );
        }
        sessionIds.add(session.id);
        if (session.trainingWeekId !== week.id) {
          issues.push(
            issue(
              "SESSION_WEEK_MISMATCH",
              "error",
              `program.sessions.${session.id}`,
              "Session does not belong to its week.",
            ),
          );
        }
      }
    }
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

export function isLegacySharedTemplateProgram(program: ProgramV2): boolean {
  return program.trainingBlocks.some(
    (block) =>
      [
        "competition_preparation",
        "open_preparation",
        "masters_open_preparation",
      ].includes(block.blockType) &&
      (!block.templateId ||
        ["masters_open_6w", "masters_open_preparation_six_week"].includes(
          block.templateId,
        )),
  );
}
