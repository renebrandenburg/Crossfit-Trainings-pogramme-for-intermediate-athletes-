import type { ProgramV2, RegenerationScope } from "./types";

export interface GenerationLogRecord {
  event: "generated" | "regenerated" | "completed" | "rejected";
  programId: string;
  programmeType: string;
  generationSource: ProgramV2["generationSource"];
  generationFingerprint: string;
  generatorVersion: string;
  blockType: string;
  currentWeek: number;
  progressionTracks: Array<{
    trackType: string;
    movementFamilyId: string;
    currentStep: number;
    status: string;
  }>;
  selectedMovementFamilies: string[];
  estimatedSessionDurations: Array<{
    week: number;
    session: number;
    minutes: number;
  }>;
  sectionDurations: Array<{
    week: number;
    session: number;
    section: string;
    minutes: number;
  }>;
  equipmentTransitionCount: number;
  validationWarnings: Array<{ code: string; path: string }>;
  validationErrors: Array<{ code: string; path: string }>;
  regenerationScope: RegenerationScope | null;
  aiRequestId: string | null;
}

/**
 * Builds a deliberately note-free record for console/telemetry adapters.
 * Athlete feedback, profile values, and coaching notes are never included.
 */
export function createGenerationLogRecord(
  program: ProgramV2,
  input: {
    event: GenerationLogRecord["event"];
    regenerationScope?: RegenerationScope | null;
    aiRequestId?: string | null;
  },
): GenerationLogRecord {
  const block = program.trainingBlocks[0];
  if (!block)
    throw new Error("A training block is required for observability.");
  const sessions = block.trainingWeeks.flatMap((week) => week.sessions);
  return {
    event: input.event,
    programId: program.id,
    programmeType:
      program.generationRequest?.programmeType || block.templateId || "legacy",
    generationSource: program.generationSource || "generated",
    generationFingerprint: program.generationFingerprint || "legacy",
    generatorVersion: program.generatorVersion || "legacy",
    blockType: block.blockType,
    currentWeek: block.currentWeek,
    progressionTracks: block.progressionTracks.map((track) => ({
      trackType: track.trackType,
      movementFamilyId: track.movementFamilyId,
      currentStep: track.currentStep,
      status: track.status,
    })),
    selectedMovementFamilies: [
      ...new Set(
        sessions.flatMap((session) => [
          ...session.exercises.map((exercise) => exercise.movementFamilyId),
          ...(session.conditioning?.movements.map(
            (movement) => movement.movementFamilyId,
          ) ?? []),
        ]),
      ),
    ].sort(),
    estimatedSessionDurations: sessions.map((session) => ({
      week: session.weekNumber,
      session: session.sessionNumber,
      minutes: session.estimatedDurationMinutes,
    })),
    sectionDurations: sessions.flatMap((session) =>
      session.sections.map((section) => ({
        week: session.weekNumber,
        session: session.sessionNumber,
        section: section.section,
        minutes: section.estimatedDurationMinutes,
      })),
    ),
    equipmentTransitionCount: sessions.reduce(
      (total, session) => total + session.equipmentTransitions.length,
      0,
    ),
    validationWarnings: program.validation.issues
      .filter((issue) => issue.severity === "warning")
      .map(({ code, path }) => ({ code, path })),
    validationErrors: program.validation.issues
      .filter((issue) => issue.severity === "error")
      .map(({ code, path }) => ({ code, path })),
    regenerationScope: input.regenerationScope ?? null,
    aiRequestId: input.aiRequestId ?? null,
  };
}
