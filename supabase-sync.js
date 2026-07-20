"use strict";

(function exposeForgeHourSync(global) {
  const WORKOUT_LOG_COLUMN_NAMES = [
    "id",
    "date",
    "week",
    "day_id",
    "day_title",
    "readiness",
    "rpe",
    "strength_result",
    "wod_score",
    "timer_result",
    "competition_proof",
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
  const OPTIONAL_LOG_COLUMNS = ["competition_proof", "timer_result"];
  const OPTIONAL_LOG_FIELDS = [
    { column: "competition_proof", property: "competitionProof" },
    { column: "timer_result", property: "timerResult" },
  ];
  const SELECT_PAGE_SIZE = 1000;
  const LOWER_IS_BETTER_PR_IDS = new Set(["row1k", "row2k", "run5k", "murph"]);
  const LEGACY_RECORD_UPDATED_AT = "1970-01-01T00:00:00.000Z";

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
          ({ property }) => localRecord?.[property] && !record[property],
        ).map(({ property }) => [property, localRecord[property]]),
      );
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
            ({ property }) =>
              record[property] && !remoteById.get(record.id)[property],
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
    const readiness = requiredString(
      log.readiness,
      "Workout readiness",
      "validate_local_data",
    );
    if (
      week < 1 ||
      week > 8 ||
      !["green", "amber", "red"].includes(readiness)
    ) {
      throw syncError(
        "validate_local_data",
        new Error("Workout week or readiness is invalid"),
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
      readiness,
      rpe: log.rpe || null,
      strength_result: log.strengthResult || null,
      wod_score: log.wodScore || null,
      timer_result: optionalObject(
        log.timerResult,
        "Workout timer result",
        "validate_local_data",
      ),
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
    const readiness = requiredString(row.readiness, "Workout readiness");
    if (!["green", "amber", "red"].includes(readiness)) {
      throw syncError(
        "validate_remote_data",
        new Error("Workout readiness is invalid"),
      );
    }
    return {
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
      notes: row.notes || "",
      mobilityDone: Boolean(row.mobility_done),
      createdAt: requiredString(row.created_at, "Workout creation time"),
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
        const [logsResult, attemptsResult, prsResult] = await Promise.all([
          selectCompatibleLogs(client),
          selectPaginatedRows(
            client,
            "pr_attempts",
            PR_ATTEMPT_COLUMNS,
            "load_pr_attempts",
          ),
          client.from("personal_records").select(PERSONAL_RECORD_COLUMNS),
        ]);

        return {
          logs: assertNoError(logsResult, "load_workout_logs").map(rowToLog),
          prAttempts: assertNoError(attemptsResult, "load_pr_attempts").map(
            rowToPrAttempt,
          ),
          prs: rowsToPrs(assertNoError(prsResult, "load_personal_records")),
        };
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
        };
      },
      async clearLogs() {
        await assertNoError(
          await client.from("workout_logs").delete().neq("id", ""),
        );
      },
      async savePrAttempt(attempt, currentPrs, userId) {
        return savePrAttemptAtomic(client, attempt, currentPrs, userId);
      },
      async uploadLocalScores(state, userId, remoteState) {
        assertHydratedRemoteIndex(remoteState, userId);
        const logs = unsyncedById(state.logs, remoteState.logs);
        const attempts = unsyncedById(state.prAttempts, remoteState.prAttempts);
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
          assertNoError(result, "upload_workout_logs");
        }
        if (attempts.length) {
          for (const attempt of attempts) {
            await savePrAttemptAtomic(client, attempt, state.prs, userId);
          }
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
          competitionProofPending,
          timerResultPending,
        };
      },
    };
  }

  const api = {
    createSupabaseStore,
    isBetterPersonalRecord,
    logToRow,
    mergeById,
    mergePrs,
    personalRecordToRow,
    prAttemptToRow,
    rowToLog,
    rowToPersonalRecord,
    rowToPrAttempt,
    rowsToPrs,
    unsyncedById,
  };

  global.ForgeHourSync = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
