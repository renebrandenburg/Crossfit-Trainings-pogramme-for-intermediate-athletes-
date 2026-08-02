import {
  stableUuid,
  findSession,
  internalEngine,
  replaceSession,
} from "./engine";
import type {
  CompletionInput,
  CompletionResult,
  ExercisePrescription,
  ProgramV2,
  ProgressionTrack,
  RegenerationInput,
  RegenerationResult,
  TrainingSession,
} from "./types";
import { assertValidProgram, validateProgram } from "./validation";

function cloneProgram(program: ProgramV2): ProgramV2 {
  return structuredClone(program);
}

function allSessions(program: ProgramV2): TrainingSession[] {
  return program.trainingBlocks.flatMap((block) =>
    block.trainingWeeks.flatMap((week) => week.sessions),
  );
}

function findTrack(
  program: ProgramV2,
  trackId: string,
): ProgressionTrack | null {
  for (const block of program.trainingBlocks) {
    const track = block.progressionTracks.find((item) => item.id === trackId);
    if (track) return track;
  }
  return null;
}

function replaceTrack(program: ProgramV2, replacement: ProgressionTrack): void {
  for (const block of program.trainingBlocks) {
    const index = block.progressionTracks.findIndex(
      (item) => item.id === replacement.id,
    );
    if (index >= 0) block.progressionTracks[index] = replacement;
  }
}

function nextLinkedSession(
  program: ProgramV2,
  completedSession: TrainingSession,
  trackId: string,
): TrainingSession | null {
  return (
    allSessions(program)
      .filter(
        (session) =>
          (session.weekNumber > completedSession.weekNumber ||
            (session.weekNumber === completedSession.weekNumber &&
              session.sessionNumber > completedSession.sessionNumber)) &&
          session.trackAssignments.some(
            (assignment) => assignment.progressionTrackId === trackId,
          ),
      )
      .sort(
        (left, right) =>
          left.weekNumber - right.weekNumber ||
          left.sessionNumber - right.sessionNumber,
      )[0] ?? null
  );
}

function sourceExercise(
  program: ProgramV2,
  trackId: string,
  stepNumber: number,
): ExercisePrescription | null {
  for (const session of allSessions(program)) {
    const exercise = session.exercises.find(
      (item) =>
        item.progressionTrackId === trackId &&
        item.progressionStepNumber === stepNumber,
    );
    if (exercise) return exercise;
  }
  return null;
}

function rematerializeNextSection(
  program: ProgramV2,
  completedSession: TrainingSession,
  track: ProgressionTrack,
  stepNumber: number,
  lowEndOnly: boolean,
  updatedAt: string,
): void {
  const target = nextLinkedSession(program, completedSession, track.id);
  const source = sourceExercise(program, track.id, stepNumber);
  if (!target || !source) return;
  const current = target.exercises.find(
    (item) => item.progressionTrackId === track.id,
  );
  if (!current) return;
  const nextExercise: ExercisePrescription = {
    ...source,
    id: stableUuid(target.id, "exercise", track.id, stepNumber),
    sessionId: target.id,
    groupId: current.groupId,
    section: current.section,
    intensityMax: lowEndOnly ? source.intensityValue : source.intensityMax,
    progressionStepNumber: stepNumber,
  };
  const groupId = current.groupId;
  const exercises = target.exercises.map((exercise) => {
    if (exercise.id === current.id) return nextExercise;
    if (
      groupId &&
      exercise.groupId === groupId &&
      exercise.progressionTrackId == null
    ) {
      return {
        ...exercise,
        sets: nextExercise.sets,
        restSeconds: nextExercise.restSeconds,
        technicalIntent: nextExercise.technicalIntent,
        progressionObjective: nextExercise.progressionObjective,
        stoppingRule: nextExercise.stoppingRule,
      };
    }
    return exercise;
  });
  const updated = internalEngine.recalculateSession({
    ...target,
    provisional: false,
    revision: target.revision + 1,
    trackAssignments: target.trackAssignments.map((assignment) =>
      assignment.progressionTrackId === track.id
        ? { ...assignment, progressionStepNumber: stepNumber }
        : assignment,
    ),
    exercises,
    updatedAt,
  });
  const replacement = replaceSession(program, updated);
  program.trainingBlocks = replacement.trainingBlocks;
}

function regenerateConditioning(
  session: TrainingSession,
  seed: string,
): TrainingSession {
  if (!session.conditioning) return session;
  const conditioning = session.conditioning;
  const movements = [...conditioning.movements];
  if (movements.length > 1) {
    const shift = Math.max(1, seed.length % movements.length);
    movements.push(...movements.splice(0, shift));
  } else if (movements[0]) {
    const only = movements[0];
    movements[0] = {
      ...only,
      reps:
        only.reps == null
          ? null
          : Math.max(1, only.reps + (seed.length % 2 ? 1 : -1)),
      calories:
        only.calories == null
          ? null
          : Math.max(1, only.calories + (seed.length % 2 ? 1 : -1)),
      distanceMeters:
        only.distanceMeters == null
          ? null
          : Math.max(50, only.distanceMeters + (seed.length % 2 ? 50 : -50)),
    };
  }
  return internalEngine.recalculateSession({
    ...session,
    revision: session.revision + 1,
    conditioning: {
      ...conditioning,
      id: stableUuid(session.id, "conditioning", seed),
      movements,
    },
  });
}

function regenerateWarmup(
  session: TrainingSession,
  seed: string,
): TrainingSession {
  const exercises = [...session.warmup.exercises];
  if (exercises.length > 2) {
    const middle = exercises.slice(1, -1).reverse();
    exercises.splice(1, middle.length, ...middle);
  }
  return internalEngine.recalculateSession({
    ...session,
    revision: session.revision + 1,
    warmup: {
      ...session.warmup,
      id: stableUuid(session.id, "warmup", seed),
      exercises,
    },
  });
}

function regenerateAccessory(
  session: TrainingSession,
  seed: string,
): TrainingSession {
  return internalEngine.recalculateSession({
    ...session,
    revision: session.revision + 1,
    exercises: session.exercises.map((exercise) =>
      exercise.section === "accessory"
        ? {
            ...exercise,
            id: stableUuid(session.id, "accessory", seed),
            sets: Math.max(
              1,
              (exercise.sets ?? 2) + (seed.length % 2 ? 1 : -1),
            ),
          }
        : exercise,
    ),
  });
}

export function regenerateSessionSection(
  input: RegenerationInput,
): RegenerationResult {
  assertValidProgram(input.program);
  const original = findSession(input.program, input.sessionId);
  if (!original) throw new Error(`Unknown session ${input.sessionId}.`);
  if (original.status === "completed") {
    throw new Error("Completed sessions cannot be regenerated.");
  }
  let replacement = original;
  const changedSectionIds: string[] = [];
  if (input.scope === "conditioning" || input.scope === "full_session") {
    replacement = regenerateConditioning(
      replacement,
      `${input.seed}:conditioning`,
    );
    changedSectionIds.push(`${original.id}-conditioning`);
  }
  if (input.scope === "warmup" || input.scope === "full_session") {
    replacement = regenerateWarmup(replacement, `${input.seed}:warmup`);
    changedSectionIds.push(`${original.id}-warmup`);
  }
  if (input.scope === "accessory" || input.scope === "full_session") {
    replacement = regenerateAccessory(replacement, `${input.seed}:accessory`);
    changedSectionIds.push(`${original.id}-accessory`);
  }
  replacement = {
    ...replacement,
    updatedAt: new Date().toISOString(),
  };
  const program = replaceSession(cloneProgram(input.program), replacement);
  program.updatedAt = replacement.updatedAt;
  const validation = validateProgram(program);
  if (!validation.valid) {
    throw new Error(
      `Regenerated section failed validation: ${validation.issues
        .filter((item) => item.severity === "error")
        .map((item) => item.code)
        .join(", ")}`,
    );
  }
  return {
    program: { ...program, validation },
    validation,
    changedSectionIds,
  };
}

export function applySessionCompletion(
  input: CompletionInput,
): CompletionResult {
  assertValidProgram(input.program);
  const program = cloneProgram(input.program);
  const session = findSession(program, input.sessionId);
  if (!session) throw new Error(`Unknown session ${input.sessionId}.`);
  if (session.revision !== input.expectedRevision) {
    throw new Error("SESSION_REVISION_CONFLICT");
  }
  if (session.status === "completed") {
    throw new Error("SESSION_ALREADY_COMPLETED");
  }
  const assignedTrackIds = session.trackAssignments.map(
    (assignment) => assignment.progressionTrackId,
  );
  const resultTrackIds = new Set(
    input.feedback.results.map((item) => item.progressionTrackId),
  );
  if (
    input.feedback.completed &&
    assignedTrackIds.some((trackId) => !resultTrackIds.has(trackId))
  ) {
    throw new Error("MISSING_TRACK_RESULT");
  }

  const advancedTrackIds: string[] = [];
  const pausedTrackIds: string[] = [];
  const repeatedTrackIds: string[] = [];
  const updatedAt = input.feedback.completedAt;
  for (const assignment of session.trackAssignments) {
    const track = findTrack(program, assignment.progressionTrackId);
    if (!track)
      throw new Error(`Unknown track ${assignment.progressionTrackId}.`);
    const exerciseResult = input.feedback.results.find(
      (item) => item.progressionTrackId === track.id,
    );
    if (!input.feedback.completed || !exerciseResult) continue;

    if (input.feedback.painReported || exerciseResult.painReported) {
      const paused: ProgressionTrack = {
        ...track,
        status: "paused",
        updatedAt,
      };
      replaceTrack(program, paused);
      pausedTrackIds.push(track.id);
      const next = nextLinkedSession(program, session, track.id);
      if (next) {
        const replacement = replaceSession(program, {
          ...next,
          status: "blocked",
          provisional: false,
          updatedAt,
        });
        program.trainingBlocks = replacement.trainingBlocks;
      }
      continue;
    }

    if (exerciseResult.successful) {
      const nextStep = Math.min(
        track.totalSteps,
        assignment.progressionStepNumber + 1,
      );
      const advanced: ProgressionTrack = {
        ...track,
        currentStep: nextStep,
        consecutiveFailures: 0,
        status:
          assignment.progressionStepNumber >= track.totalSteps
            ? "completed"
            : "active",
        updatedAt,
      };
      replaceTrack(program, advanced);
      advancedTrackIds.push(track.id);
      rematerializeNextSection(
        program,
        session,
        advanced,
        nextStep,
        (exerciseResult.achievedRpe ?? input.feedback.sessionRpe ?? 0) >= 9,
        updatedAt,
      );
      continue;
    }

    const failures = track.consecutiveFailures + 1;
    const repeatStep =
      failures >= 2
        ? Math.max(1, assignment.progressionStepNumber - 1)
        : assignment.progressionStepNumber;
    const repeated: ProgressionTrack = {
      ...track,
      currentStep: repeatStep,
      consecutiveFailures: failures,
      status: "active",
      updatedAt,
    };
    replaceTrack(program, repeated);
    repeatedTrackIds.push(track.id);
    rematerializeNextSection(
      program,
      session,
      repeated,
      repeatStep,
      true,
      updatedAt,
    );
  }

  const current = findSession(program, session.id);
  if (!current) throw new Error("Session disappeared during completion.");
  const replacement = replaceSession(program, {
    ...current,
    status: input.feedback.completed ? "completed" : "skipped",
    provisional: false,
    revision: current.revision + 1,
    feedback: input.feedback,
    updatedAt,
  });
  program.trainingBlocks = replacement.trainingBlocks;
  program.updatedAt = updatedAt;

  for (const block of program.trainingBlocks) {
    const completedWeeks = block.trainingWeeks.filter((week) =>
      week.sessions.every((item) => item.status === "completed"),
    );
    block.currentWeek = Math.min(6, completedWeeks.length + 1);
    block.trainingWeeks = block.trainingWeeks.map((week) => ({
      ...week,
      status: week.sessions.every((item) => item.status === "completed")
        ? "completed"
        : week.weekNumber === block.currentWeek
          ? "active"
          : "planned",
    }));
  }

  const validation = validateProgram(program);
  if (!validation.valid) {
    throw new Error(
      `Completed programme failed validation: ${validation.issues
        .filter((item) => item.severity === "error")
        .map((item) => item.code)
        .join(", ")}`,
    );
  }
  return {
    program: { ...program, validation },
    validation,
    advancedTrackIds,
    pausedTrackIds,
    repeatedTrackIds,
  };
}

export function serializeValidatedProgram(program: ProgramV2): string {
  return JSON.stringify(assertValidProgram(program));
}

export function persistValidatedProgram(
  program: ProgramV2,
  save: (value: ProgramV2) => void,
): ProgramV2 {
  const validated = assertValidProgram(program);
  save(validated);
  return validated;
}
