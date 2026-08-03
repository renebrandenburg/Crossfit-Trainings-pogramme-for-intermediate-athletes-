"use strict";

(function exposeForgeHourSync(global) {
  const WORKOUT_LOG_COLUMN_NAMES = [
    "id",
    "date",
    "week",
    "day_id",
    "day_title",
    "workout_source",
    "readiness",
    "difficulty",
    "movement_patterns",
    "duration_minutes",
    "rpe",
    "strength_result",
    "wod_score",
    "timer_result",
    "competition_proof",
    "training_event_id",
    "readiness_check_id",
    "structured_score",
    "recommendation_snapshot",
    "rx_status",
    "notes",
    "mobility_done",
    "created_at",
  ];
  const PR_ATTEMPT_COLUMNS = [
    "id",
    "metric_id",
    "metric_name",
    "value",
    "display",
    "date",
    "notes",
    "is_pr",
    "created_at",
  ].join(",");
  const PERSONAL_RECORD_COLUMNS = [
    "metric_id",
    "value",
    "display",
    "date",
    "notes",
    "updated_at",
  ].join(",");
  const TRAINING_EVENT_COLUMNS = [
    "id",
    "date",
    "kind",
    "status",
    "session_id",
    "title",
    "raw_box_text",
    "movement_ids",
    "stimuli",
    "recommendation",
    "created_at",
    "updated_at",
  ].join(",");
  const READINESS_CHECK_COLUMNS = [
    "id",
    "date",
    "energy",
    "soreness",
    "pain",
    "available_minutes",
    "created_at",
  ].join(",");
  const WORKOUT_METADATA_COLUMNS = new Set([
    "workout_source",
    "difficulty",
    "movement_patterns",
    "duration_minutes",
  ]);
  const OPTIONAL_LOG_COLUMNS = [
    "competition_proof",
    "timer_result",
    "training_event_id",
    "readiness_check_id",
    "structured_score",
    "recommendation_snapshot",
    "rx_status",
    ...WORKOUT_METADATA_COLUMNS,
  ];
  const OPTIONAL_LOG_FIELDS = [
    {
      column: "competition_proof",
      property: "competitionProof",
      remoteNeedsValue: true,
    },
    {
      column: "timer_result",
      property: "timerResult",
      remoteNeedsValue: true,
    },
    {
      column: "training_event_id",
      property: "trainingEventId",
      hasValue: Boolean,
    },
    {
      column: "readiness_check_id",
      property: "readinessCheckId",
      hasValue: Boolean,
    },
    {
      column: "structured_score",
      property: "structuredScore",
      remoteNeedsValue: true,
    },
    {
      column: "recommendation_snapshot",
      property: "recommendationSnapshot",
      remoteNeedsValue: true,
    },
    {
      column: "rx_status",
      property: "rxStatus",
      hasValue: Boolean,
    },
    {
      column: "workout_source",
      property: "workoutSource",
      hasValue: (value) => Boolean(value && value !== "app"),
    },
    {
      column: "difficulty",
      property: "difficulty",
      hasValue: (value) => value !== null && value !== undefined,
    },
    {
      column: "movement_patterns",
      property: "movementPatterns",
      hasValue: (value) => Array.isArray(value) && value.length > 0,
    },
    {
      column: "duration_minutes",
      property: "durationMinutes",
      hasValue: (value) => value !== null && value !== undefined,
    },
  ];
  const SELECT_PAGE_SIZE = 1000;
  const ATHLETE_STATE_SCHEMA_VERSION = 4;
  const ATHLETE_STATE_MAX_BYTES = 5 * 1024 * 1024;
  const ATHLETE_STATE_COLUMNS = "user_id,schema_version,state,updated_at";
  const LOWER_IS_BETTER_PR_IDS = new Set(["row1k", "row2k", "run5k", "murph"]);
  const LEGACY_RECORD_UPDATED_AT = "1970-01-01T00:00:00.000Z";
  const WORKOUT_SOURCES = new Set(["app", "box", "custom"]);
  const TRAINING_EVENT_KINDS = new Set(["app", "box", "rest"]);
  const TRAINING_EVENT_STATUSES = new Set(["planned", "completed", "skipped"]);
  const READINESS_SORENESS = new Set(["none", "manageable", "high"]);
  const TRAINING_STIMULI = new Set([
    "squat",
    "hinge",
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "olympic_lifting",
    "gymnastics",
    "short_conditioning",
    "medium_conditioning",
    "long_conditioning",
    "aerobic",
    "sprint",
  ]);

  /**
   * @typedef {Error & {operation?: string, code?: string, retryable?: boolean}} ForgeHourSyncError
   */

  /** @param {string} operation @param {any} error @returns {ForgeHourSyncError} */
  function syncError(operation, error) {
    if (error && error.operation) return error;
    const message = String(error?.message || error || "Unknown Supabase error");
    /** @type {ForgeHourSyncError} */
    const wrapped = new Error(`${operation}: ${message}`);
    wrapped.name = "ForgeHourSyncError";
    wrapped.operation = operation;
    wrapped.code = error?.code ? String(error.code) : "SYNC_ERROR";
    wrapped.retryable = ![
      "23502",
      "23503",
      "23505",
      "23514",
      "42501",
      "PGRST100",
      "PGRST204",
    ].includes(wrapped.code);
    if (error) wrapped.cause = error;
    return wrapped;
  }

  function assertObject(value, label, operation = "validate_remote_data") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw syncError(operation, new Error(`${label} is invalid`));
    }
    return value;
  }

  function requiredString(value, label, operation = "validate_remote_data") {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized) {
      throw syncError(operation, new Error(`${label} is missing`));
    }
    return normalized;
  }

  function requiredFiniteNumber(
    value,
    label,
    operation = "validate_remote_data",
  ) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
      throw syncError(operation, new Error(`${label} is invalid`));
    }
    return normalized;
  }

  function requiredPositiveFiniteNumber(
    value,
    label,
    operation = "validate_remote_data",
  ) {
    const normalized = requiredFiniteNumber(value, label, operation);
    if (normalized <= 0) {
      throw syncError(
        operation,
        new Error(`${label} must be greater than zero`),
      );
    }
    return normalized;
  }

  function requiredNonnegativeFiniteNumber(
    value,
    label,
    operation = "validate_remote_data",
  ) {
    const normalized = requiredFiniteNumber(value, label, operation);
    if (normalized < 0) {
      throw syncError(operation, new Error(`${label} cannot be negative`));
    }
    return normalized;
  }

  function optionalObject(value, label, operation = "validate_remote_data") {
    if (value === null || value === undefined) return null;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw syncError(operation, new Error(`${label} is invalid`));
    }
    return value;
  }

  function normalizeV2GenerationPreferences(value) {
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const weekdays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const requestedDays = Array.isArray(source.preferredDays)
      ? [...new Set(source.preferredDays.map(String))].filter((day) =>
          weekdays.includes(day),
        )
      : [];
    requestedDays.sort(
      (left, right) => weekdays.indexOf(left) - weekdays.indexOf(right),
    );
    const increment = Number(source.weightIncrementKg);
    return {
      preferredDays:
        requestedDays.length === 2 ? requestedDays : ["tuesday", "saturday"],
      athleteLevel: ["beginner", "intermediate", "advanced"].includes(
        source.athleteLevel,
      )
        ? source.athleteLevel
        : "intermediate",
      availableEquipment: Array.isArray(source.availableEquipment)
        ? [...new Set(source.availableEquipment.map(String).filter(Boolean))]
        : [
            "barbell",
            "rack",
            "pull-up bar",
            "dumbbell",
            "kettlebell",
            "box",
            "rings",
            "rower",
            "bike",
            "ski erg",
            "band",
            "PVC",
          ],
      weightIncrementKg: [1, 2, 2.5, 5].includes(increment) ? increment : 2.5,
      roundingMode: ["nearest", "down", "up"].includes(source.roundingMode)
        ? source.roundingMode
        : "nearest",
    };
  }

  function validateAthleteState(
    value,
    operation = "validate_remote_athlete_state",
  ) {
    const state = assertObject(value, "Athlete state", operation);
    assertObject(state.profile, "Athlete profile", operation);
    if (!Array.isArray(state.plans)) {
      throw syncError(operation, new Error("Athlete plans are invalid"));
    }
    if (state.activePlanId !== null && typeof state.activePlanId !== "string") {
      throw syncError(operation, new Error("Active plan ID is invalid"));
    }
    const selectedWeek = Number(state.selectedWeek);
    const planSchemaVersion = Number(state.planSchemaVersion);
    if (
      !Number.isInteger(selectedWeek) ||
      selectedWeek < 1 ||
      selectedWeek > 8 ||
      !Number.isInteger(planSchemaVersion) ||
      planSchemaVersion < 1
    ) {
      throw syncError(
        operation,
        new Error("Athlete state versions or selected week are invalid"),
      );
    }
    const canonical = {
      profile: state.profile,
      plans: state.plans,
      activePlanId: state.activePlanId,
      selectedWeek,
      planSchemaVersion,
      cycleStartDate:
        typeof state.cycleStartDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(state.cycleStartDate)
          ? state.cycleStartDate
          : null,
      v2Programs: Array.isArray(state.v2Programs)
        ? state.v2Programs.filter(
            (program) =>
              program &&
              typeof program === "object" &&
              program.engineVersion === "v2" &&
              typeof program.id === "string",
          )
        : [],
      activeV2ProgramId:
        typeof state.activeV2ProgramId === "string"
          ? state.activeV2ProgramId
          : null,
      v2ProgramRevisions:
        state.v2ProgramRevisions &&
        typeof state.v2ProgramRevisions === "object" &&
        !Array.isArray(state.v2ProgramRevisions)
          ? state.v2ProgramRevisions
          : {},
      activeProgrammingEngine: ["v1", "v2"].includes(
        state.activeProgrammingEngine,
      )
        ? state.activeProgrammingEngine
        : typeof state.activeV2ProgramId === "string"
          ? "v2"
          : "v1",
      v2GenerationPreferences: normalizeV2GenerationPreferences(
        state.v2GenerationPreferences,
      ),
      movementRestrictions:
        state.movementRestrictions &&
        typeof state.movementRestrictions === "object" &&
        !Array.isArray(state.movementRestrictions)
          ? state.movementRestrictions
          : { movementIds: [], movementFamilyIds: [], guidance: null },
    };
    const serialized = JSON.stringify(canonical);
    if (new TextEncoder().encode(serialized).length > ATHLETE_STATE_MAX_BYTES) {
      throw syncError(
        operation,
        new Error("Athlete state exceeds the 5 MB sync limit"),
      );
    }
    return canonical;
  }

  function athleteStateToRow(state, userId) {
    return {
      user_id: requiredString(userId, "User ID", "validate_local_data"),
      schema_version: ATHLETE_STATE_SCHEMA_VERSION,
      state: validateAthleteState(state, "validate_local_data"),
    };
  }

  function rowToAthleteState(row, expectedUserId) {
    assertObject(row, "Athlete-state row");
    const userId = requiredString(row.user_id, "Athlete-state user ID");
    if (expectedUserId && userId !== String(expectedUserId)) {
      throw syncError(
        "validate_remote_athlete_state",
        new Error("Athlete-state owner does not match the active account"),
      );
    }
    const schemaVersion = requiredFiniteNumber(
      row.schema_version,
      "Athlete-state schema version",
    );
    if (
      !Number.isInteger(schemaVersion) ||
      schemaVersion < 1 ||
      schemaVersion > ATHLETE_STATE_SCHEMA_VERSION
    ) {
      throw syncError(
        "validate_remote_athlete_state",
        new Error("Athlete-state schema version is unsupported"),
      );
    }
    return {
      ...validateAthleteState(row.state),
      updatedAt: requiredString(row.updated_at, "Athlete-state update time"),
    };
  }

  function byNewestCreatedAt(a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }

  function mergeById(localRecords = [], remoteRecords = []) {
    const merged = new Map();
    localRecords.forEach((record) => {
      if (record && record.id) merged.set(record.id, record);
    });
    remoteRecords.forEach((record) => {
      if (!record || !record.id) return;
      const localRecord = merged.get(record.id);
      const preservedOptionalFields = Object.fromEntries(
        OPTIONAL_LOG_FIELDS.filter(
          ({ property, hasValue = Boolean, remoteNeedsValue = false }) =>
            hasValue(localRecord?.[property]) &&
            (remoteNeedsValue
              ? !hasValue(record[property])
              : !Object.prototype.hasOwnProperty.call(record, property)),
        ).map(({ property }) => [property, localRecord[property]]),
      );
      if (
        localRecord?.workoutSource === "box" &&
        !Object.prototype.hasOwnProperty.call(record, "workoutSource")
      ) {
        preservedOptionalFields.readiness = localRecord.readiness;
      }
      merged.set(record.id, { ...record, ...preservedOptionalFields });
    });
    return Array.from(merged.values()).sort(byNewestCreatedAt);
  }

  function mergePrs(localPrs = {}, remotePrs = {}) {
    return { ...localPrs, ...remotePrs };
  }

  function unsyncedById(localRecords = [], remoteRecords = []) {
    const remoteById = new Map(
      remoteRecords
        .filter((record) => record && record.id)
        .map((record) => [record.id, record]),
    );
    return localRecords.filter(
      (record) =>
        record &&
        record.id &&
        (!remoteById.has(record.id) ||
          OPTIONAL_LOG_FIELDS.some(
            ({ property, hasValue = Boolean, remoteNeedsValue = false }) => {
              const remoteRecord = remoteById.get(record.id);
              return (
                hasValue(record[property]) &&
                (remoteNeedsValue
                  ? !hasValue(remoteRecord[property])
                  : !Object.prototype.hasOwnProperty.call(
                      remoteRecord,
                      property,
                    ))
              );
            },
          )),
    );
  }

  function logToRow(log, userId) {
    assertObject(log, "Workout log", "validate_local_data");
    const week = requiredFiniteNumber(
      log.week,
      "Workout week",
      "validate_local_data",
    );
    const workoutSource = String(log.workoutSource || "app");
    if (!WORKOUT_SOURCES.has(workoutSource)) {
      throw syncError(
        "validate_local_data",
        new Error("Workout source is invalid"),
      );
    }
    const readiness = log.readiness
      ? requiredString(
          log.readiness,
          "Workout readiness",
          "validate_local_data",
        )
      : null;
    const difficulty =
      log.difficulty === null ||
      log.difficulty === undefined ||
      log.difficulty === ""
        ? null
        : Number(log.difficulty);
    const durationMinutes =
      log.durationMinutes === null ||
      log.durationMinutes === undefined ||
      log.durationMinutes === ""
        ? null
        : Number(log.durationMinutes);
    const movementPatterns = Array.isArray(log.movementPatterns)
      ? [...new Set(log.movementPatterns.map(String))]
      : [];
    if (
      week < 1 ||
      week > 8 ||
      (workoutSource !== "box" &&
        !["green", "amber", "red"].includes(readiness)) ||
      (readiness !== null && !["green", "amber", "red"].includes(readiness)) ||
      (difficulty !== null &&
        (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) ||
      (durationMinutes !== null &&
        (!Number.isInteger(durationMinutes) ||
          durationMinutes < 1 ||
          durationMinutes > 300)) ||
      movementPatterns.some((stimulus) => !TRAINING_STIMULI.has(stimulus))
    ) {
      throw syncError(
        "validate_local_data",
        new Error("Workout metadata is invalid"),
      );
    }
    const row = {
      id: requiredString(log.id, "Workout ID", "validate_local_data"),
      user_id: requiredString(userId, "User ID", "validate_local_data"),
      date: requiredString(log.date, "Workout date", "validate_local_data"),
      week,
      day_id: requiredString(
        log.dayId,
        "Workout day ID",
        "validate_local_data",
      ),
      day_title: requiredString(
        log.dayTitle,
        "Workout title",
        "validate_local_data",
      ),
      workout_source: workoutSource,
      readiness,
      difficulty,
      movement_patterns: movementPatterns,
      duration_minutes: durationMinutes,
      rpe: log.rpe || null,
      strength_result: log.strengthResult || null,
      wod_score: log.wodScore || null,
      timer_result: optionalObject(
        log.timerResult,
        "Workout timer result",
        "validate_local_data",
      ),
      training_event_id: log.trainingEventId || null,
      readiness_check_id: log.readinessCheckId || null,
      structured_score: optionalObject(
        log.structuredScore,
        "Structured workout score",
        "validate_local_data",
      ),
      recommendation_snapshot: optionalObject(
        log.recommendationSnapshot,
        "Recommendation snapshot",
        "validate_local_data",
      ),
      rx_status: ["rx", "scaled", "not_applicable"].includes(log.rxStatus)
        ? log.rxStatus
        : null,
      notes: log.notes || null,
      mobility_done: Boolean(log.mobilityDone),
      created_at: requiredString(
        log.createdAt,
        "Workout creation time",
        "validate_local_data",
      ),
    };
    if (log.competitionProof) {
      row.competition_proof = optionalObject(
        log.competitionProof,
        "Competition proof",
        "validate_local_data",
      );
    }
    return row;
  }

  function missingOptionalLogColumn(error) {
    if (!error || !["42703", "PGRST204"].includes(String(error.code || ""))) {
      return null;
    }
    const message = String(error.message || "");
    return (
      OPTIONAL_LOG_COLUMNS.find((column) => message.includes(column)) || null
    );
  }

  function withoutColumn(row, column) {
    const compatibleRow = { ...row };
    delete compatibleRow[column];
    if (column === "workout_source" && compatibleRow.readiness == null) {
      compatibleRow.readiness = "green";
    }
    return compatibleRow;
  }

  function rowToLog(row) {
    assertObject(row, "Workout log");
    const week = requiredFiniteNumber(row.week, "Workout week");
    if (week < 1 || week > 8) {
      throw syncError(
        "validate_remote_data",
        new Error("Workout week is outside the supported cycle"),
      );
    }
    const workoutSource = String(row.workout_source || "app");
    const readiness = row.readiness == null ? null : String(row.readiness);
    const difficulty = row.difficulty == null ? null : Number(row.difficulty);
    const durationMinutes =
      row.duration_minutes == null ? null : Number(row.duration_minutes);
    const movementPatterns = Array.isArray(row.movement_patterns)
      ? row.movement_patterns.map(String)
      : [];
    if (
      !WORKOUT_SOURCES.has(workoutSource) ||
      (workoutSource !== "box" &&
        !["green", "amber", "red"].includes(readiness)) ||
      (readiness !== null && !["green", "amber", "red"].includes(readiness)) ||
      (difficulty !== null &&
        (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) ||
      (durationMinutes !== null &&
        (!Number.isInteger(durationMinutes) ||
          durationMinutes < 1 ||
          durationMinutes > 300)) ||
      movementPatterns.some((stimulus) => !TRAINING_STIMULI.has(stimulus))
    ) {
      throw syncError(
        "validate_remote_data",
        new Error("Workout metadata is invalid"),
      );
    }
    const log = {
      id: requiredString(row.id, "Workout ID"),
      date: requiredString(row.date, "Workout date"),
      week,
      dayId: requiredString(row.day_id, "Workout day ID"),
      dayTitle: requiredString(row.day_title, "Workout title"),
      readiness,
      rpe: row.rpe || "",
      strengthResult: row.strength_result || "",
      wodScore: row.wod_score || "",
      timerResult: optionalObject(row.timer_result, "Workout timer result"),
      competitionProof: optionalObject(
        row.competition_proof,
        "Competition proof",
      ),
      trainingEventId: row.training_event_id || null,
      readinessCheckId: row.readiness_check_id || null,
      structuredScore: optionalObject(
        row.structured_score,
        "Structured workout score",
      ),
      recommendationSnapshot: optionalObject(
        row.recommendation_snapshot,
        "Recommendation snapshot",
      ),
      rxStatus: row.rx_status || null,
      notes: row.notes || "",
      mobilityDone: Boolean(row.mobility_done),
      createdAt: requiredString(row.created_at, "Workout creation time"),
    };
    if (Object.prototype.hasOwnProperty.call(row, "workout_source")) {
      log.workoutSource = workoutSource;
    }
    if (Object.prototype.hasOwnProperty.call(row, "difficulty")) {
      log.difficulty = difficulty;
    }
    if (Object.prototype.hasOwnProperty.call(row, "movement_patterns")) {
      log.movementPatterns = movementPatterns;
    }
    if (Object.prototype.hasOwnProperty.call(row, "duration_minutes")) {
      log.durationMinutes = durationMinutes;
    }
    return log;
  }

  function trainingEventToRow(event, userId) {
    assertObject(event, "Training event", "validate_local_data");
    const kind = requiredString(
      event.kind,
      "Training-event kind",
      "validate_local_data",
    );
    const status = requiredString(
      event.status || "planned",
      "Training-event status",
      "validate_local_data",
    );
    const date = requiredString(
      event.date,
      "Training-event date",
      "validate_local_data",
    );
    const stimuli = Array.isArray(event.stimuli)
      ? [...new Set(event.stimuli.map(String))]
      : [];
    const movementIds = Array.isArray(event.movementIds)
      ? [...new Set(event.movementIds.map(String).filter(Boolean))]
      : [];
    if (
      !TRAINING_EVENT_KINDS.has(kind) ||
      !TRAINING_EVENT_STATUSES.has(status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      stimuli.some((stimulus) => !TRAINING_STIMULI.has(stimulus))
    ) {
      throw syncError(
        "validate_local_data",
        new Error("Training-event metadata is invalid"),
      );
    }
    return {
      id: requiredString(event.id, "Training-event ID", "validate_local_data"),
      user_id: requiredString(userId, "User ID", "validate_local_data"),
      date,
      kind,
      status,
      session_id: event.sessionId || null,
      title: requiredString(
        event.title || (kind === "rest" ? "Rest day" : "Training"),
        "Training-event title",
        "validate_local_data",
      ),
      raw_box_text: event.rawBoxText || null,
      movement_ids: movementIds,
      stimuli,
      recommendation: optionalObject(
        event.recommendation,
        "Training-event recommendation",
        "validate_local_data",
      ),
      created_at: requiredString(
        event.createdAt,
        "Training-event creation time",
        "validate_local_data",
      ),
      updated_at: requiredString(
        event.updatedAt || event.createdAt,
        "Training-event update time",
        "validate_local_data",
      ),
    };
  }

  function rowToTrainingEvent(row) {
    assertObject(row, "Training event");
    const kind = requiredString(row.kind, "Training-event kind");
    const status = requiredString(row.status, "Training-event status");
    const date = requiredString(row.date, "Training-event date");
    const stimuli = Array.isArray(row.stimuli) ? row.stimuli.map(String) : [];
    if (
      !TRAINING_EVENT_KINDS.has(kind) ||
      !TRAINING_EVENT_STATUSES.has(status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      stimuli.some((stimulus) => !TRAINING_STIMULI.has(stimulus))
    ) {
      throw syncError(
        "validate_remote_data",
        new Error("Training-event metadata is invalid"),
      );
    }
    return {
      id: requiredString(row.id, "Training-event ID"),
      date,
      kind,
      status,
      sessionId: row.session_id || null,
      title: requiredString(row.title, "Training-event title"),
      rawBoxText: row.raw_box_text || "",
      movementIds: Array.isArray(row.movement_ids)
        ? row.movement_ids.map(String)
        : [],
      stimuli,
      recommendation: optionalObject(
        row.recommendation,
        "Training-event recommendation",
      ),
      createdAt: requiredString(row.created_at, "Training-event creation time"),
      updatedAt: requiredString(row.updated_at, "Training-event update time"),
    };
  }

  function readinessCheckToRow(checkin, userId) {
    assertObject(checkin, "Readiness check", "validate_local_data");
    const energy = requiredFiniteNumber(
      checkin.energy,
      "Readiness energy",
      "validate_local_data",
    );
    const soreness = requiredString(
      checkin.soreness,
      "Readiness soreness",
      "validate_local_data",
    );
    const availableMinutes = requiredFiniteNumber(
      checkin.availableMinutes,
      "Readiness available minutes",
      "validate_local_data",
    );
    const date = requiredString(
      checkin.date,
      "Readiness date",
      "validate_local_data",
    );
    if (
      !Number.isInteger(energy) ||
      energy < 1 ||
      energy > 5 ||
      !READINESS_SORENESS.has(soreness) ||
      !Number.isInteger(availableMinutes) ||
      availableMinutes < 15 ||
      availableMinutes > 180 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      throw syncError(
        "validate_local_data",
        new Error("Readiness metadata is invalid"),
      );
    }
    return {
      id: requiredString(checkin.id, "Readiness ID", "validate_local_data"),
      user_id: requiredString(userId, "User ID", "validate_local_data"),
      date,
      energy,
      soreness,
      pain: Boolean(checkin.pain),
      available_minutes: availableMinutes,
      created_at: requiredString(
        checkin.createdAt,
        "Readiness creation time",
        "validate_local_data",
      ),
    };
  }

  function rowToReadinessCheck(row) {
    assertObject(row, "Readiness check");
    const energy = requiredFiniteNumber(row.energy, "Readiness energy");
    const soreness = requiredString(row.soreness, "Readiness soreness");
    const availableMinutes = requiredFiniteNumber(
      row.available_minutes,
      "Readiness available minutes",
    );
    const date = requiredString(row.date, "Readiness date");
    if (
      !Number.isInteger(energy) ||
      energy < 1 ||
      energy > 5 ||
      !READINESS_SORENESS.has(soreness) ||
      !Number.isInteger(availableMinutes) ||
      availableMinutes < 15 ||
      availableMinutes > 180 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      throw syncError(
        "validate_remote_data",
        new Error("Readiness metadata is invalid"),
      );
    }
    return {
      id: requiredString(row.id, "Readiness ID"),
      date,
      energy,
      soreness,
      pain: Boolean(row.pain),
      availableMinutes,
      createdAt: requiredString(row.created_at, "Readiness creation time"),
    };
  }

  function prAttemptToRow(attempt, userId) {
    assertObject(attempt, "PR attempt", "validate_local_data");
    return {
      id: requiredString(attempt.id, "PR attempt ID", "validate_local_data"),
      user_id: requiredString(userId, "User ID", "validate_local_data"),
      metric_id: requiredString(
        attempt.metricId,
        "PR metric ID",
        "validate_local_data",
      ),
      metric_name: requiredString(
        attempt.metricName,
        "PR metric name",
        "validate_local_data",
      ),
      value: requiredPositiveFiniteNumber(
        attempt.value,
        "PR value",
        "validate_local_data",
      ),
      display: requiredString(
        attempt.display,
        "PR display value",
        "validate_local_data",
      ),
      date: requiredString(attempt.date, "PR date", "validate_local_data"),
      notes: attempt.notes || null,
      is_pr: Boolean(attempt.isPr),
      created_at: requiredString(
        attempt.createdAt,
        "PR creation time",
        "validate_local_data",
      ),
    };
  }

  function rowToPrAttempt(row) {
    assertObject(row, "PR attempt");
    return {
      id: requiredString(row.id, "PR attempt ID"),
      metricId: requiredString(row.metric_id, "PR metric ID"),
      metricName: requiredString(row.metric_name, "PR metric name"),
      value: requiredPositiveFiniteNumber(row.value, "PR value"),
      display: requiredString(row.display, "PR display value"),
      date: requiredString(row.date, "PR date"),
      notes: row.notes || "",
      isPr: Boolean(row.is_pr),
      createdAt: requiredString(row.created_at, "PR creation time"),
    };
  }

  function personalRecordToRow(
    metricId,
    record,
    userId,
    fallbackUpdatedAt = LEGACY_RECORD_UPDATED_AT,
  ) {
    assertObject(record, "Personal record", "validate_local_data");
    return {
      user_id: requiredString(userId, "User ID", "validate_local_data"),
      metric_id: requiredString(
        metricId,
        "Personal-record metric ID",
        "validate_local_data",
      ),
      value: requiredNonnegativeFiniteNumber(
        record.value,
        "Personal-record value",
        "validate_local_data",
      ),
      display: requiredString(
        record.display,
        "Personal-record display value",
        "validate_local_data",
      ),
      date: requiredString(
        record.date,
        "Personal-record date",
        "validate_local_data",
      ),
      notes: record.notes || null,
      updated_at: requiredString(
        record.updatedAt || fallbackUpdatedAt,
        "Personal-record update time",
        "validate_local_data",
      ),
    };
  }

  function rowToPersonalRecord(row) {
    assertObject(row, "Personal record");
    return {
      metricId: requiredString(row.metric_id, "Personal-record metric ID"),
      value: requiredNonnegativeFiniteNumber(
        row.value,
        "Personal-record value",
      ),
      display: requiredString(row.display, "Personal-record display value"),
      date: requiredString(row.date, "Personal-record date"),
      notes: row.notes || "",
      updatedAt: requiredString(row.updated_at, "Personal-record update time"),
    };
  }

  function rowsToPrs(rows = []) {
    return rows.reduce((prs, row) => {
      const record = rowToPersonalRecord(row);
      prs[record.metricId] = record;
      return prs;
    }, {});
  }

  function isBetterPersonalRecord(candidate, current, metricId) {
    if (!candidate) return false;
    if (!current) return true;
    const candidateValue = Number(candidate.value);
    const currentValue = Number(current.value);
    if (!Number.isFinite(candidateValue) || candidateValue < 0) return false;
    if (!Number.isFinite(currentValue) || currentValue < 0) return true;
    if (candidateValue === currentValue) {
      return (
        String(candidate.updatedAt || LEGACY_RECORD_UPDATED_AT) >
        String(current.updatedAt || LEGACY_RECORD_UPDATED_AT)
      );
    }
    if (candidateValue === 0) return false;
    if (currentValue === 0) return true;
    return LOWER_IS_BETTER_PR_IDS.has(metricId)
      ? candidateValue < currentValue
      : candidateValue > currentValue;
  }

  function assertNoError(result, operation = "supabase_request") {
    if (result && result.error) throw syncError(operation, result.error);
    return result ? result.data : undefined;
  }

  function isMissingV2Schema(error) {
    return ["42P01", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(
      String(error?.code || ""),
    );
  }

  async function upsertCompatibleLogs(client, rows) {
    const isBatch = Array.isArray(rows);
    let compatibleRows = isBatch
      ? rows.map((row) => ({ ...row }))
      : { ...rows };
    const omittedColumns = new Set();

    for (
      let attempt = 0;
      attempt <= OPTIONAL_LOG_COLUMNS.length;
      attempt += 1
    ) {
      const result = await client.from("workout_logs").upsert(compatibleRows);
      if (!result.error) {
        return { result, omittedColumns };
      }
      const missingColumn = missingOptionalLogColumn(result.error);
      if (!missingColumn || omittedColumns.has(missingColumn)) {
        assertNoError(result, "save_workout_log");
      }
      omittedColumns.add(missingColumn);
      compatibleRows = isBatch
        ? compatibleRows.map((row) => withoutColumn(row, missingColumn))
        : withoutColumn(compatibleRows, missingColumn);
    }

    throw syncError(
      "save_workout_log",
      new Error("Could not create a schema-compatible workout payload"),
    );
  }

  async function selectPaginatedRows(client, table, columns, operation) {
    const rows = [];

    for (let offset = 0; ; offset += SELECT_PAGE_SIZE) {
      let request = client
        .from(table)
        .select(columns)
        .order("created_at", { ascending: false });
      if (request && typeof request.order === "function") {
        request = request.order("id", { ascending: false });
      }
      const canPaginate = Boolean(
        request && typeof request.range === "function",
      );
      if (canPaginate) {
        request = request.range(offset, offset + SELECT_PAGE_SIZE - 1);
      }

      const result = await request;
      if (result?.error) return result;
      if (!Array.isArray(result?.data)) {
        throw syncError(operation, new Error(`${table} returned invalid data`));
      }
      rows.push(...result.data);
      if (!canPaginate || result.data.length < SELECT_PAGE_SIZE) break;
    }

    return { data: rows, error: null };
  }

  async function selectCompatibleLogs(client) {
    let columns = [...WORKOUT_LOG_COLUMN_NAMES];
    const omittedColumns = new Set();

    for (
      let attempt = 0;
      attempt <= OPTIONAL_LOG_COLUMNS.length;
      attempt += 1
    ) {
      const result = await selectPaginatedRows(
        client,
        "workout_logs",
        columns.join(","),
        "load_workout_logs",
      );
      if (!result.error) return result;
      const missingColumn = missingOptionalLogColumn(result.error);
      if (!missingColumn || omittedColumns.has(missingColumn)) {
        assertNoError(result, "load_workout_logs");
      }
      omittedColumns.add(missingColumn);
      columns = columns.filter((column) => column !== missingColumn);
    }

    throw syncError(
      "load_workout_logs",
      new Error("Could not create a schema-compatible workout query"),
    );
  }

  async function selectOptionalRows(client, table, columns, operation) {
    const result = await selectPaginatedRows(client, table, columns, operation);
    if (
      result?.error &&
      ["42P01", "42703", "PGRST204", "PGRST205"].includes(
        String(result.error.code || ""),
      )
    ) {
      return { data: [], error: null };
    }
    return result;
  }

  async function savePrAttemptAtomic(client, attempt, currentPrs, userId) {
    const { user_id: _attemptUserId, ...attemptPayload } = prAttemptToRow(
      attempt,
      userId,
    );
    const possibleCurrentRecord = attempt.isPr
      ? currentPrs && currentPrs[attempt.metricId]
      : null;
    const currentRecord =
      possibleCurrentRecord &&
      Number(possibleCurrentRecord.value) === Number(attempt.value)
        ? possibleCurrentRecord
        : null;
    const recordPayload = currentRecord
      ? (() => {
          const { user_id: _recordUserId, ...record } = personalRecordToRow(
            attempt.metricId,
            currentRecord,
            userId,
            attempt.createdAt,
          );
          return record;
        })()
      : null;
    const result = await client.rpc("save_pr_attempt", {
      p_attempt: attemptPayload,
      p_personal_record: recordPayload,
    });
    const canonicalRecord = assertNoError(result, "save_pr_attempt");
    return canonicalRecord === null || canonicalRecord === undefined
      ? null
      : rowToPersonalRecord(canonicalRecord);
  }

  async function savePersonalRecordAtomic(client, metricId, record, userId) {
    const { user_id: _recordUserId, ...recordPayload } = personalRecordToRow(
      metricId,
      record,
      userId,
    );
    const result = await client.rpc("save_personal_record", {
      p_personal_record: recordPayload,
    });
    assertNoError(result, "save_personal_record");
  }

  function assertHydratedRemoteIndex(remoteState, userId) {
    if (
      !remoteState ||
      remoteState.hydrated !== true ||
      String(remoteState.ownerId || "") !== String(userId || "")
    ) {
      throw syncError(
        "prepare_score_sync",
        new Error("Remote scores must be loaded for the active account first"),
      );
    }
  }

  function createSupabaseStore(client) {
    return {
      async getSession() {
        const result = await client.auth.getSession();
        return assertNoError(result).session || null;
      },
      onAuthStateChange(callback) {
        const result = client.auth.onAuthStateChange((event, session) =>
          callback(event, session),
        );
        return () => result.data.subscription.unsubscribe();
      },
      async signIn(email, redirectTo) {
        await assertNoError(
          await client.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectTo },
          }),
        );
      },
      async signOut() {
        await assertNoError(await client.auth.signOut());
      },
      async loadUserData() {
        const [
          logsResult,
          attemptsResult,
          prsResult,
          trainingEventsResult,
          readinessChecksResult,
        ] = await Promise.all([
          selectCompatibleLogs(client),
          selectOptionalRows(
            client,
            "pr_attempts",
            PR_ATTEMPT_COLUMNS,
            "load_pr_attempts",
          ),
          client.from("personal_records").select(PERSONAL_RECORD_COLUMNS),
          selectOptionalRows(
            client,
            "training_events",
            TRAINING_EVENT_COLUMNS,
            "load_training_events",
          ),
          selectOptionalRows(
            client,
            "readiness_checks",
            READINESS_CHECK_COLUMNS,
            "load_readiness_checks",
          ),
        ]);

        return {
          logs: assertNoError(logsResult, "load_workout_logs").map(rowToLog),
          prAttempts: assertNoError(attemptsResult, "load_pr_attempts").map(
            rowToPrAttempt,
          ),
          prs: rowsToPrs(assertNoError(prsResult, "load_personal_records")),
          trainingEvents: assertNoError(
            trainingEventsResult,
            "load_training_events",
          ).map(rowToTrainingEvent),
          readinessChecks: assertNoError(
            readinessChecksResult,
            "load_readiness_checks",
          ).map(rowToReadinessCheck),
        };
      },
      async loadAthleteState(userId) {
        const result = await client
          .from("athlete_states")
          .select(ATHLETE_STATE_COLUMNS)
          .eq(
            "user_id",
            requiredString(userId, "User ID", "load_athlete_state"),
          )
          .maybeSingle();
        const row = assertNoError(result, "load_athlete_state");
        return row ? rowToAthleteState(row, userId) : null;
      },
      async saveAthleteState(state, userId) {
        const row = athleteStateToRow(state, userId);
        const result = await client
          .from("athlete_states")
          .upsert(row, { onConflict: "user_id" })
          .select(ATHLETE_STATE_COLUMNS)
          .single();
        return rowToAthleteState(
          assertNoError(result, "save_athlete_state"),
          userId,
        );
      },
      async loadProgrammingEngineV2Flag(userId) {
        const normalizedUserId = requiredString(
          userId,
          "User ID",
          "load_programming_engine_v2_flag",
        );
        const result = await client
          .from("programming_engine_flags")
          .select("user_id,v2_enabled,rollout_group,updated_at")
          .eq("user_id", normalizedUserId)
          .maybeSingle();
        if (result?.error && isMissingV2Schema(result.error)) {
          return {
            enabled: false,
            rolloutGroup: "migration_pending",
            updatedAt: null,
          };
        }
        const row = assertNoError(result, "load_programming_engine_v2_flag");
        return row
          ? {
              enabled: row.v2_enabled === true,
              rolloutGroup: String(row.rollout_group || "disabled"),
              updatedAt: row.updated_at ? String(row.updated_at) : null,
            }
          : { enabled: false, rolloutGroup: "disabled", updatedAt: null };
      },
      async loadActiveProgrammingEngineV2() {
        const result = await client.rpc("load_active_programming_engine_v2");
        if (result?.error && isMissingV2Schema(result.error)) return null;
        const payload = assertNoError(
          result,
          "load_active_programming_engine_v2",
        );
        if (!payload) return null;
        assertObject(
          payload,
          "V2 programme response",
          "load_active_programming_engine_v2",
        );
        assertObject(
          payload.program,
          "V2 programme",
          "load_active_programming_engine_v2",
        );
        return {
          program: payload.program,
          revision: requiredFiniteNumber(
            payload.revision,
            "V2 programme revision",
            "load_active_programming_engine_v2",
          ),
        };
      },
      async saveProgrammingEngineV2(program, expectedRevision = null) {
        const payload = assertObject(
          program,
          "V2 programme",
          "save_programming_engine_v2",
        );
        if (
          payload.engineVersion !== "v2" ||
          payload.validation?.valid !== true ||
          payload.validation?.issues?.some?.(
            (item) => item?.severity === "error",
          )
        ) {
          throw syncError(
            "save_programming_engine_v2",
            new Error("A validated V2 programme is required"),
          );
        }
        const result = await client.rpc("save_programming_engine_v2", {
          p_program: payload,
          p_expected_revision:
            expectedRevision == null
              ? null
              : requiredFiniteNumber(
                  expectedRevision,
                  "V2 programme revision",
                  "save_programming_engine_v2",
                ),
        });
        return assertNoError(result, "save_programming_engine_v2");
      },
      async loadMovementRestrictions(userId) {
        const normalizedUserId = requiredString(
          userId,
          "User ID",
          "load_movement_restrictions",
        );
        const result = await client
          .from("athlete_movement_restrictions")
          .select(
            "id,user_id,movement_id,movement_family_id,guidance,created_at,updated_at",
          )
          .eq("user_id", normalizedUserId);
        if (result?.error && isMissingV2Schema(result.error)) return [];
        return assertNoError(result, "load_movement_restrictions").map(
          (row) => ({
            id: String(row.id),
            movementId: row.movement_id ? String(row.movement_id) : null,
            movementFamilyId: row.movement_family_id
              ? String(row.movement_family_id)
              : null,
            guidance: row.guidance ? String(row.guidance) : null,
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
          }),
        );
      },
      async replaceMovementRestrictions(restrictions) {
        if (!Array.isArray(restrictions)) {
          throw syncError(
            "replace_movement_restrictions",
            new Error("Movement restrictions must be an array"),
          );
        }
        const payload = restrictions.map((restriction) => ({
          movement_id: restriction.movementId || null,
          movement_family_id: restriction.movementFamilyId || null,
          guidance: restriction.guidance || null,
        }));
        const result = await client.rpc(
          "replace_athlete_movement_restrictions",
          { p_restrictions: payload },
        );
        if (result?.error && isMissingV2Schema(result.error)) return [];
        return assertNoError(result, "replace_movement_restrictions");
      },
      async saveLog(log, userId) {
        const row = logToRow(log, userId);
        const { result, omittedColumns } = await upsertCompatibleLogs(
          client,
          row,
        );
        assertNoError(result, "save_workout_log");
        return {
          competitionProofSynced: !omittedColumns.has("competition_proof"),
          timerResultSynced: !omittedColumns.has("timer_result"),
          workoutMetadataSynced: ![...WORKOUT_METADATA_COLUMNS].some((column) =>
            omittedColumns.has(column),
          ),
        };
      },
      async deleteLog(logId, userId) {
        await assertNoError(
          await client
            .from("workout_logs")
            .delete()
            .eq(
              "user_id",
              requiredString(userId, "User ID", "delete_workout_log"),
            )
            .eq(
              "id",
              requiredString(logId, "Workout ID", "delete_workout_log"),
            ),
          "delete_workout_log",
        );
      },
      async clearLogs() {
        await assertNoError(
          await client.from("workout_logs").delete().neq("id", ""),
        );
      },
      async saveTrainingEvent(event, userId) {
        const row = trainingEventToRow(event, userId);
        const result = await client
          .from("training_events")
          .upsert(row)
          .select(TRAINING_EVENT_COLUMNS)
          .single();
        return rowToTrainingEvent(assertNoError(result, "save_training_event"));
      },
      async deleteTrainingEvent(eventId, userId) {
        await assertNoError(
          await client
            .from("training_events")
            .delete()
            .eq(
              "user_id",
              requiredString(userId, "User ID", "delete_training_event"),
            )
            .eq(
              "id",
              requiredString(
                eventId,
                "Training-event ID",
                "delete_training_event",
              ),
            ),
          "delete_training_event",
        );
      },
      async saveReadinessCheck(checkin, userId) {
        const row = readinessCheckToRow(checkin, userId);
        const result = await client
          .from("readiness_checks")
          .upsert(row)
          .select(READINESS_CHECK_COLUMNS)
          .single();
        return rowToReadinessCheck(
          assertNoError(result, "save_readiness_check"),
        );
      },
      async savePrAttempt(attempt, currentPrs, userId) {
        return savePrAttemptAtomic(client, attempt, currentPrs, userId);
      },
      async uploadLocalScores(state, userId, remoteState) {
        assertHydratedRemoteIndex(remoteState, userId);
        const logs = unsyncedById(state.logs, remoteState.logs);
        const attempts = unsyncedById(state.prAttempts, remoteState.prAttempts);
        const trainingEvents = unsyncedById(
          state.trainingEvents,
          remoteState.trainingEvents,
        );
        const readinessChecks = unsyncedById(
          state.readinessChecks,
          remoteState.readinessChecks,
        );
        const recordsCoveredByAttempts = new Set(
          attempts
            .filter(
              (attempt) =>
                attempt.isPr &&
                Number(state.prs?.[attempt.metricId]?.value) ===
                  Number(attempt.value),
            )
            .map((attempt) => attempt.metricId),
        );
        const remotePrs = remoteState.prs || {};
        const prs = Object.entries(state.prs || {}).filter(
          ([metricId, record]) =>
            !recordsCoveredByAttempts.has(metricId) &&
            isBetterPersonalRecord(record, remotePrs[metricId], metricId),
        );
        let competitionProofPending = 0;
        let timerResultPending = 0;
        let workoutMetadataPending = 0;

        if (logs.length) {
          const rows = logs.map((log) => logToRow(log, userId));
          const { result, omittedColumns } = await upsertCompatibleLogs(
            client,
            rows,
          );
          if (omittedColumns.has("competition_proof")) {
            competitionProofPending = rows.filter(
              (row) => row.competition_proof,
            ).length;
          }
          if (omittedColumns.has("timer_result")) {
            timerResultPending = rows.filter((row) => row.timer_result).length;
          }
          if (
            [...WORKOUT_METADATA_COLUMNS].some((column) =>
              omittedColumns.has(column),
            )
          ) {
            workoutMetadataPending = rows.filter(
              (row) =>
                row.workout_source !== "app" ||
                row.difficulty !== null ||
                row.movement_patterns.length > 0 ||
                row.duration_minutes !== null,
            ).length;
          }
          assertNoError(result, "upload_workout_logs");
        }
        if (attempts.length) {
          for (const attempt of attempts) {
            await savePrAttemptAtomic(client, attempt, state.prs, userId);
          }
        }
        if (trainingEvents.length) {
          await assertNoError(
            await client
              .from("training_events")
              .upsert(
                trainingEvents.map((event) =>
                  trainingEventToRow(event, userId),
                ),
              ),
            "upload_training_events",
          );
        }
        if (readinessChecks.length) {
          await assertNoError(
            await client
              .from("readiness_checks")
              .upsert(
                readinessChecks.map((checkin) =>
                  readinessCheckToRow(checkin, userId),
                ),
              ),
            "upload_readiness_checks",
          );
        }
        if (prs.length) {
          for (const [metricId, record] of prs) {
            await savePersonalRecordAtomic(client, metricId, record, userId);
          }
        }

        return {
          logs: logs.length,
          prAttempts: attempts.length,
          prs: prs.length,
          trainingEvents: trainingEvents.length,
          readinessChecks: readinessChecks.length,
          competitionProofPending,
          timerResultPending,
          workoutMetadataPending,
        };
      },
    };
  }

  const api = {
    ATHLETE_STATE_SCHEMA_VERSION,
    athleteStateToRow,
    createSupabaseStore,
    isBetterPersonalRecord,
    logToRow,
    mergeById,
    mergePrs,
    personalRecordToRow,
    prAttemptToRow,
    readinessCheckToRow,
    rowToLog,
    rowToAthleteState,
    rowToPersonalRecord,
    rowToPrAttempt,
    rowToReadinessCheck,
    rowToTrainingEvent,
    rowsToPrs,
    trainingEventToRow,
    unsyncedById,
    validateAthleteState,
  };

  global.ForgeHourSync = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
