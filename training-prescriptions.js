"use strict";

(function initializeTrainingPrescriptions(globalScope) {
  const catalogApi =
    typeof module !== "undefined" && module.exports
      ? require("./movement-catalog.js")
      : globalScope.ForgeHourMovementCatalog;

  if (!catalogApi) throw new Error("Movement catalog failed to load.");

  const {
    MOVEMENT_CATALOG,
    getMovementDefinition,
    isRegisteredMovement,
    resolveMovementId,
  } = catalogApi;

  const TRAINING_BLOCK_SCHEMA_VERSION = 1;
  const VAGUE_PATTERN =
    /(?:^|\b)(?:work on|practice|focus on|develop|base|control|prep|rehearsal|technique density)(?:\b|:)/i;
  const AMBIGUOUS_PATTERN =
    /\b(?:clean|snatch|row|bike|ski|run|pull-?ups?|ring rows?|toes-to-bar|knee raises?|muscle-ups?|HSPU|wall walks?)\s*(?:\/|\bor\b)|(?:\/|\bor\b)\s*(?:clean|snatch|row|bike|ski|run|pull-?ups?|ring rows?|toes-to-bar|knee raises?|muscle-ups?|HSPU|wall walks?)/i;

  function range(min, max) {
    return { min, max };
  }

  function target(type, value) {
    return { type, value };
  }

  function exercise(id, movementId, exerciseTarget, options = {}) {
    const canonicalId = resolveMovementId(movementId);
    const definition = getMovementDefinition(canonicalId);
    return {
      id,
      movementId: canonicalId,
      name: options.name || definition?.displayName || movementId,
      target: exerciseTarget,
      ...(options.load ? { load: options.load } : {}),
    };
  }

  function block(id, title, category, durationMinutes, prescription, intent) {
    return {
      schemaVersion: TRAINING_BLOCK_SCHEMA_VERSION,
      id,
      title,
      category,
      durationMinutes,
      trainingIntent: Array.isArray(intent) ? intent : intent ? [intent] : [],
      prescription: {
        format: prescription.format,
        exercises: prescription.exercises || [],
        ...(prescription.rest ? { rest: prescription.rest } : {}),
        scalingOptions: prescription.scalingOptions || [],
        coachingNotes: prescription.coachingNotes || [],
      },
    };
  }

  function measurableLoad(load) {
    if (!load || typeof load !== "object") return false;
    const instruction = String(load.instruction || "").trim();
    const measurableInstruction =
      instruction &&
      /(?:\d|RPE|RIR|empty (?:bar|training bar)|PVC|reuse|same (?:barbell )?load|repetitions? in reserve)/i.test(
        instruction,
      );
    return Boolean(
      load.percentage != null ||
      load.rpe != null ||
      load.rir != null ||
      Number.isFinite(Number(load.fixedWeightKg)) ||
      measurableInstruction ||
      String(load.reuseExerciseId || "").trim(),
    );
  }

  function defaultLoadForMovement(movementId, intent = "strength") {
    const definition = getMovementDefinition(movementId);
    const family = definition?.olympicFamily;
    const referenceLift = definition?.referenceLift || undefined;
    if (/tall-(?:clean|snatch)-pulls/.test(movementId)) {
      return {
        percentage: range(40, 50),
        referenceLift,
        rpe: range(5, 6),
        instruction: "Use perfect positions and a fast, vertical extension.",
      };
    }
    if (movementId === "front-rack-hold") {
      return {
        percentage: range(50, 70),
        referenceLift: "frontSquat",
        rpe: range(5, 6),
        instruction:
          "Maintain the prescribed rack position without losing posture.",
      };
    }
    if (movementId === "overhead-hold") {
      return {
        percentage: range(40, 60),
        referenceLift: "snatch",
        rpe: range(5, 6),
        instruction: "Use only a load that remains stable with locked elbows.",
      };
    }
    if (intent === "conditioning") {
      return {
        rpe: range(6, 7),
        instruction:
          "Choose a load that keeps every planned set technically sound with at least two repetitions in reserve.",
      };
    }
    return {
      rpe: range(5, 6),
      ...(referenceLift ? { referenceLift } : {}),
      instruction:
        family || definition?.discipline === "weightlifting"
          ? "Use a technically perfect load and stop before bar speed or position deteriorates."
          : "Choose a controlled load that leaves two to four repetitions in reserve.",
    };
  }

  function normalizeLegacyLoad(display, movementId, intent) {
    const text = String(display || "").trim();
    const fixed = text.match(/^(\d+(?:\.\d+)?)\s*kg$/i);
    if (fixed) {
      return { fixedWeightKg: Number(fixed[1]), instruction: `Use ${text}.` };
    }
    const percentage = text.match(/(\d+(?:\.\d+)?)%/);
    if (percentage) {
      return {
        percentage: Number(percentage[1]),
        referenceLift:
          getMovementDefinition(movementId)?.referenceLift || undefined,
        instruction: text,
      };
    }
    return text
      ? { instruction: text }
      : defaultLoadForMovement(movementId, intent);
  }

  function applyWorkoutLoadGuidance(definition) {
    const mapExercises = (items) =>
      (Array.isArray(items) ? items : []).map((item) => {
        const movement = getMovementDefinition(
          item?.movementId || item?.movement,
        );
        if (!movement?.loadRequired) return item;
        if (measurableLoad(item.load)) return item;
        const load = normalizeLegacyLoad(
          item?.load?.display,
          movement.id,
          "conditioning",
        );
        return {
          ...item,
          load: {
            ...load,
            display:
              item?.load?.display ||
              (load.rpe
                ? `RPE ${load.rpe.min}-${load.rpe.max}`
                : load.instruction),
          },
        };
      });
    return {
      ...definition,
      buyIn: mapExercises(definition?.buyIn),
      exercises: mapExercises(definition?.exercises),
      afterEachRound: mapExercises(definition?.afterEachRound),
      cashOut: mapExercises(definition?.cashOut),
      format:
        definition?.format?.type === "emom"
          ? {
              ...definition.format,
              stations: (definition.format.stations || []).map((station) =>
                station?.type === "rest"
                  ? station
                  : { ...station, exercises: mapExercises(station.exercises) },
              ),
            }
          : definition?.format,
    };
  }

  function gymnasticsBlock(id, durationMinutes, intent = "Gymnastics skill") {
    return block(
      id,
      "Gymnastics skill",
      "gymnastics",
      durationMinutes,
      {
        format: { type: "rounds", rounds: 3 },
        exercises: [
          exercise(
            `${id}-hollow`,
            "hollow-hold",
            target("duration_seconds", 20),
          ),
          exercise(`${id}-arch`, "arch-hold", target("duration_seconds", 20)),
          exercise(`${id}-pull`, "strict-pull-ups", {
            type: "reps_range",
            min: 5,
            max: 8,
          }),
          exercise(`${id}-raise`, "hanging-knee-raises", {
            type: "reps_range",
            min: 8,
            max: 12,
          }),
        ],
        rest: { after: "round", seconds: 60 },
        scalingOptions: [
          "Replace strict pull-ups with 8-12 ring rows.",
          "Replace hanging knee raises with 8-12 dead bugs per side.",
          "Reduce holds to 10-15 seconds if position breaks down.",
        ],
        coachingNotes: [
          "Work at RPE 6-7 and stop every set before technique deteriorates.",
        ],
      },
      intent,
    );
  }

  function olympicAccessoryBlock(id, durationMinutes, family, sets) {
    const clean = family !== "snatch";
    const pullId = clean ? "tall-clean-pulls" : "tall-snatch-pulls";
    const holdId = clean ? "front-rack-hold" : "overhead-hold";
    return block(
      id,
      `${clean ? "Clean" : "Snatch"} technique`,
      "weightlifting",
      durationMinutes,
      {
        format: { type: "sets", sets },
        exercises: [
          exercise(`${id}-pull`, pullId, target("reps", 3), {
            load: defaultLoadForMovement(pullId),
          }),
          exercise(`${id}-hold`, holdId, target("duration_seconds", 20), {
            load: defaultLoadForMovement(holdId),
          }),
        ],
        rest: { after: "set", minSeconds: 60, maxSeconds: 90 },
        scalingOptions: [
          "Reduce the load until both movements can be completed with stable positions.",
        ],
        coachingNotes: ["Reset deliberately between the pull and the hold."],
      },
      [`${clean ? "clean" : "snatch"} positions`, "fast extension"],
    );
  }

  function exactWarmupBlock(session) {
    const minutes = Number(session?.segmentMinutes?.warmup) || 8;
    const family = session?.olympicFamily;
    const equipment = new Set(session?.availableEquipment || []);
    const warmupMovementId = equipment.has("rower")
      ? "easy-row"
      : equipment.has("bike")
        ? "easy-bike"
        : equipment.has("running")
          ? "easy-run"
          : "easy-double-unders";
    const techniqueId =
      family === "snatch" ? "tall-snatch-pulls" : "tall-clean-pulls";
    return block(
      `${session.id}-warmup`,
      "Warm-up",
      "warmup",
      minutes,
      {
        format: { type: "rounds", rounds: 2 },
        exercises: [
          exercise(
            `${session.id}-easy-movement`,
            warmupMovementId,
            target("duration_seconds", 90),
          ),
          exercise(`${session.id}-air-squat`, "air-squats", target("reps", 10)),
          exercise(
            `${session.id}-ankle-rock`,
            "ankle-rocks",
            target("reps", 8),
          ),
          exercise(
            `${session.id}-t-spine`,
            "thoracic-rotations",
            target("reps", 6),
          ),
          exercise(`${session.id}-technique`, techniqueId, target("reps", 5), {
            load: {
              instruction:
                "Use PVC or an empty training bar; do not exceed RPE 3.",
              rpe: 3,
            },
          }),
        ],
        rest: { after: "round", seconds: 30 },
        scalingOptions: [
          "Use a PVC pipe instead of a barbell if positions are not yet stable.",
        ],
        coachingNotes: ["Move continuously and finish warmer, not fatigued."],
      },
      session?.warmup || [],
    );
  }

  function exactCooldownBlock(session) {
    const minutes = Number(session?.segmentMinutes?.mobility) || 5;
    return block(
      `${session.id}-cooldown`,
      "Cooldown and mobility",
      "cooldown",
      minutes,
      {
        format: { type: "for_quality" },
        exercises: [
          exercise(
            `${session.id}-couch`,
            "couch-stretch",
            target("duration_seconds", 45),
          ),
          exercise(
            `${session.id}-lat`,
            "lat-stretch",
            target("duration_seconds", 45),
          ),
          exercise(
            `${session.id}-pec`,
            "pec-stretch",
            target("duration_seconds", 45),
          ),
          exercise(`${session.id}-breathe`, "dead-bugs", target("reps", 6)),
        ],
        rest: { after: "exercise", seconds: 15 },
        scalingOptions: [
          "Reduce the range of motion and stop any drill that causes pain or numbness.",
        ],
        coachingNotes: ["Use slow nasal breathing throughout."],
      },
      session?.mobility || [],
    );
  }

  function movementFromText(value) {
    const normalized = String(value || "").toLowerCase();
    const candidates = MOVEMENT_CATALOG.filter((movement) => {
      const names = [movement.displayName, movement.id.replaceAll("-", " ")];
      return names.some((name) => normalized.includes(name.toLowerCase()));
    }).sort(
      (left, right) => right.displayName.length - left.displayName.length,
    );
    return candidates[0] || null;
  }

  function strengthBlockFromText(session, text, index, durationMinutes) {
    const id = `${session.id}-strength-${index + 1}`;
    if (/tall (?:clean|snatch) pulls?/i.test(text)) {
      return olympicAccessoryBlock(
        id,
        durationMinutes,
        /snatch/i.test(text) ? "snatch" : "clean",
        /4 sets/i.test(text) ? 4 : 3,
      );
    }
    if (
      /gymnastics skill|hollow and arch|muscle-up|toes-to-bar|pulling (?:base|density)|bodyweight (?:base|density)|handstand line|strict pull-up volume|chest-to-bar density|weakest RX category/i.test(
        text,
      )
    ) {
      return gymnasticsBlock(id, durationMinutes, text);
    }
    const movement = movementFromText(text);
    if (!movement) return gymnasticsBlock(id, durationMinutes, text);
    const availableEquipment = new Set(session?.availableEquipment || []);
    if (
      movement.equipment.some((item) =>
        ["dumbbells", "kettlebells", "rings", "rower", "bike"].includes(item),
      ) &&
      movement.equipment.some((item) => !availableEquipment.has(item))
    ) {
      return gymnasticsBlock(id, durationMinutes, text);
    }
    const setsMatch = String(text).match(
      /(\d+)\s*x\s*(\d+)|(?:^|\s)(\d+)\s+sets?/i,
    );
    const sets = Number(setsMatch?.[1] || setsMatch?.[3]) || 3;
    const reps = Number(setsMatch?.[2]) || 5;
    const percentMatch = String(text).match(/(\d+(?:\.\d+)?)%/);
    const kgMatch = String(text).match(/\((\d+(?:\.\d+)?)\s*kg\)/i);
    const load = movement.loadRequired
      ? kgMatch
        ? {
            fixedWeightKg: Number(kgMatch[1]),
            ...(percentMatch
              ? {
                  percentage: Number(percentMatch[1]),
                  referenceLift: movement.referenceLift || undefined,
                }
              : {}),
          }
        : percentMatch
          ? {
              percentage: Number(percentMatch[1]),
              referenceLift: movement.referenceLift || undefined,
            }
          : defaultLoadForMovement(movement.id)
      : undefined;
    return block(
      id,
      movement.displayName,
      movement.discipline === "gymnastics" ? "gymnastics" : "strength",
      durationMinutes,
      {
        format: { type: "sets", sets },
        exercises: [
          exercise(`${id}-exercise`, movement.id, target("reps", reps), {
            ...(load ? { load } : {}),
          }),
        ],
        rest: { after: "set", minSeconds: 60, maxSeconds: 120 },
        scalingOptions:
          movement.discipline === "gymnastics"
            ? [
                movement.learn?.scale ||
                  "Reduce repetitions and use an assisted variation.",
              ]
            : ["Reduce the load by 5-10% if technique or speed deteriorates."],
        coachingNotes: [String(text)],
      },
      text,
    );
  }

  function buildGeneratedTrainingBlocks(session) {
    const strengthItems = Array.isArray(session?.strength)
      ? session.strength
      : [];
    const totalStrength = Number(session?.segmentMinutes?.strength) || 20;
    const baseStrength = Math.floor(
      totalStrength / Math.max(1, strengthItems.length),
    );
    const remainder = totalStrength - baseStrength * strengthItems.length;
    return [
      exactWarmupBlock(session),
      ...strengthItems.map((item, index) =>
        strengthBlockFromText(
          session,
          item,
          index,
          baseStrength + (index < remainder ? 1 : 0),
        ),
      ),
      exactCooldownBlock(session),
    ];
  }

  function issue(blockId, severity, code, message, exerciseId) {
    return {
      blockId: blockId || "unknown",
      ...(exerciseId ? { exerciseId } : {}),
      severity,
      code,
      message,
    };
  }

  function trainingBlockIssues(trainingBlock) {
    const issues = [];
    const id = trainingBlock?.id || "unknown";
    if (!trainingBlock || typeof trainingBlock !== "object") {
      return [
        issue(id, "error", "VAGUE_SKILL_BLOCK", "Training block is invalid."),
      ];
    }
    if (Number(trainingBlock.durationMinutes) <= 0) {
      issues.push(
        issue(id, "error", "MISSING_DURATION", "Block duration is required."),
      );
    }
    const prescription = trainingBlock.prescription;
    const format = prescription?.format;
    const supportedFormats = new Set([
      "sets",
      "rounds",
      "emom",
      "intervals",
      "continuous",
      "for_quality",
    ]);
    if (!format?.type || !supportedFormats.has(format.type)) {
      issues.push(
        issue(id, "error", "MISSING_FORMAT", "Block format is required."),
      );
    }
    if (
      format?.type === "sets" &&
      (!Number.isInteger(Number(format.sets)) || Number(format.sets) <= 0)
    ) {
      issues.push(
        issue(id, "error", "MISSING_FORMAT", "Set count is required."),
      );
    }
    if (
      ["rounds", "emom", "intervals"].includes(format?.type) &&
      (!Number.isInteger(Number(format.rounds)) || Number(format.rounds) <= 0)
    ) {
      issues.push(
        issue(id, "error", "MISSING_FORMAT", "Round count is required."),
      );
    }
    if (
      ["emom", "intervals"].includes(format?.type) &&
      Number(format.intervalSeconds) <= 0
    ) {
      issues.push(
        issue(id, "error", "MISSING_FORMAT", "Interval duration is required."),
      );
    }
    const exercises = Array.isArray(prescription?.exercises)
      ? prescription.exercises
      : [];
    if (!exercises.length) {
      issues.push(
        issue(
          id,
          "error",
          trainingBlock.category === "gymnastics"
            ? "VAGUE_SKILL_BLOCK"
            : "MISSING_VOLUME",
          "Block requires concrete exercises.",
        ),
      );
    }
    exercises.forEach((item) => {
      if (!isRegisteredMovement(item?.movementId)) {
        issues.push(
          issue(
            id,
            "error",
            "AMBIGUOUS_MOVEMENT",
            "Exercise is not registered.",
            item?.id,
          ),
        );
      }
      if (AMBIGUOUS_PATTERN.test(item?.name || "")) {
        issues.push(
          issue(
            id,
            "error",
            "AMBIGUOUS_MOVEMENT",
            "Exercise contains a choice.",
            item?.id,
          ),
        );
      }
      if (VAGUE_PATTERN.test(item?.name || "")) {
        issues.push(
          issue(
            id,
            "error",
            "VAGUE_SKILL_BLOCK",
            "Exercise name is a training theme rather than a prescription.",
            item?.id,
          ),
        );
      }
      const itemTarget = item?.target;
      const targetValues =
        itemTarget?.type === "reps_range"
          ? [itemTarget.min, itemTarget.max]
          : [itemTarget?.value];
      if (
        !itemTarget?.type ||
        targetValues.some(
          (value) => !Number.isFinite(Number(value)) || Number(value) <= 0,
        )
      ) {
        issues.push(
          issue(
            id,
            "error",
            "MISSING_VOLUME",
            "Exercise needs reps or duration.",
            item?.id,
          ),
        );
      }
      const definition = getMovementDefinition(item?.movementId);
      if (definition?.loadRequired && !measurableLoad(item.load)) {
        issues.push(
          issue(
            id,
            "error",
            "MISSING_LOAD",
            "Loaded exercise needs load guidance.",
            item?.id,
          ),
        );
      }
    });
    const clockControlsRest = ["emom", "intervals"].includes(
      prescription?.format?.type,
    );
    const rest = prescription?.rest;
    const measurableRest =
      Number(rest?.seconds) > 0 ||
      (Number(rest?.minSeconds) > 0 && Number(rest?.maxSeconds) > 0);
    if (exercises.length && !clockControlsRest && !measurableRest) {
      issues.push(
        issue(id, "error", "MISSING_REST", "Block needs rest guidance."),
      );
    }
    if (
      trainingBlock.category === "gymnastics" &&
      !(prescription?.scalingOptions || []).length
    ) {
      issues.push(
        issue(id, "error", "MISSING_SCALING", "Gymnastics needs scaling."),
      );
    }
    if (
      trainingBlock.category === "gymnastics" &&
      !exercises.length &&
      (trainingBlock.trainingIntent || []).some((item) =>
        VAGUE_PATTERN.test(item),
      )
    ) {
      issues.push(
        issue(
          id,
          "error",
          "VAGUE_SKILL_BLOCK",
          "Intent is not a prescription.",
        ),
      );
    }
    return [
      ...new Map(
        issues.map((item) => [`${item.code}:${item.exerciseId || ""}`, item]),
      ).values(),
    ];
  }

  function generatedTrainingIssues(session) {
    const issues = (session?.trainingBlocks || []).flatMap(trainingBlockIssues);
    if (
      !Array.isArray(session?.trainingBlocks) ||
      !session.trainingBlocks.length
    ) {
      issues.push(
        issue(
          session?.id || "session",
          "error",
          "VAGUE_SKILL_BLOCK",
          "Generated session needs structured blocks.",
        ),
      );
    }
    const prescribedMinutes = (session?.trainingBlocks || []).reduce(
      (sum, item) => sum + Number(item?.durationMinutes || 0),
      0,
    );
    const wodMinutes =
      Number(session?.workoutDefinition?.expectedDurationSeconds) / 60;
    if (
      Number.isFinite(wodMinutes) &&
      Number(session?.duration) > 0 &&
      Math.abs(prescribedMinutes + wodMinutes - Number(session.duration)) > 0.01
    ) {
      issues.push(
        issue(
          session?.id || "session",
          "error",
          "INVALID_BLOCK_DURATION",
          "Training-block and WOD durations must match the session duration.",
        ),
      );
    }
    return issues;
  }

  function repairTrainingBlock(trainingBlock) {
    const next = structuredClone(trainingBlock);
    const exercises = next?.prescription?.exercises || [];
    exercises.forEach((item) => {
      const definition = getMovementDefinition(item.movementId);
      if (definition?.loadRequired && !measurableLoad(item.load)) {
        item.load = defaultLoadForMovement(item.movementId);
      }
    });
    const format = next?.prescription?.format?.type;
    if (
      exercises.length &&
      !["emom", "intervals"].includes(format) &&
      !next.prescription.rest
    ) {
      next.prescription.rest = { after: "set", minSeconds: 60, maxSeconds: 90 };
    }
    if (
      next.category === "gymnastics" &&
      !next.prescription.scalingOptions?.length
    ) {
      next.prescription.scalingOptions = [
        "Reduce repetitions or use the catalog regression while preserving clean technique.",
      ];
    }
    return next;
  }

  function finalizeGeneratedTraining(session) {
    const sourceBlocks =
      Array.isArray(session.trainingBlocks) && session.trainingBlocks.length
        ? session.trainingBlocks
        : buildGeneratedTrainingBlocks(session);
    const repairedIssues = sourceBlocks.flatMap(trainingBlockIssues);
    let next = {
      ...session,
      workoutDefinition: applyWorkoutLoadGuidance(session.workoutDefinition),
      trainingBlockSchemaVersion: TRAINING_BLOCK_SCHEMA_VERSION,
      trainingBlocks: sourceBlocks.map(repairTrainingBlock),
      trainingValidationWarnings: repairedIssues.map((item) => ({
        ...item,
        severity: "warning",
        message: `Automatically repaired: ${item.message}`,
      })),
    };
    let issues = generatedTrainingIssues(next).filter(
      (item) => item.severity === "error",
    );
    if (issues.length) {
      const invalidIds = new Set(issues.map((item) => item.blockId));
      next = {
        ...next,
        trainingValidationWarnings: [
          ...next.trainingValidationWarnings,
          ...issues.map((item) => ({
            ...item,
            severity: "warning",
            code: "FALLBACK_APPLIED",
            message: `Safe fallback applied after ${item.code}.`,
          })),
        ],
        trainingBlocks: next.trainingBlocks.map((item) =>
          invalidIds.has(item.id)
            ? gymnasticsBlock(
                item.id,
                Math.max(8, Number(item.durationMinutes) || 10),
                item.trainingIntent || item.title,
              )
            : item,
        ),
      };
      issues = generatedTrainingIssues(next).filter(
        (item) => item.severity === "error",
      );
    }
    if (issues.length) {
      const error = new Error(
        `Invalid generated training blocks: ${issues.map((item) => item.code).join(", ")}`,
      );
      error.name = "TrainingPrescriptionValidationError";
      error.issues = issues;
      throw error;
    }
    return next;
  }

  function loadText(load) {
    if (!load) return "";
    const parts = [];
    if (load.fixedWeightKg != null) parts.push(`${load.fixedWeightKg} kg`);
    if (load.percentage != null) {
      const value =
        typeof load.percentage === "object"
          ? `${load.percentage.min}-${load.percentage.max}%`
          : `${load.percentage}%`;
      parts.push(
        `${value}${load.referenceLift ? ` of ${load.referenceLift} 1RM` : ""}`,
      );
    }
    if (load.rpe != null) {
      parts.push(
        `RPE ${typeof load.rpe === "object" ? `${load.rpe.min}-${load.rpe.max}` : load.rpe}`,
      );
    }
    if (load.rir != null) parts.push(`${load.rir} RIR`);
    if (load.reuseExerciseId)
      parts.push(`reuse load from ${load.reuseExerciseId}`);
    if (load.instruction) parts.push(load.instruction);
    return parts.join("; ");
  }

  function renderTarget(exerciseItem) {
    const itemTarget = exerciseItem.target || {};
    if (itemTarget.type === "reps")
      return `${itemTarget.value} ${exerciseItem.name}`;
    if (itemTarget.type === "reps_range") {
      return `${itemTarget.min}-${itemTarget.max} ${exerciseItem.name}`;
    }
    if (itemTarget.type === "duration_seconds") {
      return `${itemTarget.value}-second ${exerciseItem.name}`;
    }
    if (itemTarget.type === "distance_m")
      return `${itemTarget.value} m ${exerciseItem.name}`;
    if (itemTarget.type === "calories")
      return `${itemTarget.value} cal ${exerciseItem.name}`;
    return exerciseItem.name;
  }

  function renderTrainingBlockItems(trainingBlock) {
    const prescription = trainingBlock.prescription;
    const format = prescription.format;
    const items = [];
    if (format.type === "sets") items.push(`${format.sets} sets:`);
    else if (format.type === "rounds") items.push(`${format.rounds} rounds:`);
    else if (format.type === "emom")
      items.push(`${trainingBlock.durationMinutes}-minute EMOM:`);
    else if (format.type === "intervals") items.push("Intervals:");
    else items.push("For quality:");
    prescription.exercises.forEach((item) => {
      items.push(
        `${renderTarget(item)}${item.load ? ` — Load: ${loadText(item.load)}` : ""}`,
      );
    });
    if (prescription.rest) {
      const rest = prescription.rest;
      const seconds = rest.seconds || `${rest.minSeconds}-${rest.maxSeconds}`;
      items.push(`Rest: ${seconds} seconds after each ${rest.after}.`);
    }
    if (prescription.scalingOptions.length) {
      items.push(`Scaling: ${prescription.scalingOptions.join(" ")}`);
    }
    prescription.coachingNotes.forEach((note) => items.push(`Note: ${note}`));
    return items;
  }

  const api = Object.freeze({
    TRAINING_BLOCK_SCHEMA_VERSION,
    applyWorkoutLoadGuidance,
    buildGeneratedTrainingBlocks,
    defaultLoadForMovement,
    finalizeGeneratedTraining,
    generatedTrainingIssues,
    gymnasticsBlock,
    measurableLoad,
    olympicAccessoryBlock,
    repairTrainingBlock,
    renderTrainingBlockItems,
    trainingBlockIssues,
  });

  if (typeof globalScope !== "undefined") {
    globalScope.ForgeHourTrainingPrescriptions = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
