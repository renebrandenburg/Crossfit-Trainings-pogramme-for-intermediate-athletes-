"use strict";

(function exposeForgeHourSync(global) {
  function byNewestCreatedAt(a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  }

  function mergeById(localRecords = [], remoteRecords = []) {
    const merged = new Map();
    localRecords.forEach((record) => {
      if (record && record.id) merged.set(record.id, record);
    });
    remoteRecords.forEach((record) => {
      if (record && record.id) merged.set(record.id, record);
    });
    return Array.from(merged.values()).sort(byNewestCreatedAt);
  }

  function mergePrs(localPrs = {}, remotePrs = {}) {
    return { ...localPrs, ...remotePrs };
  }

  function unsyncedById(localRecords = [], remoteRecords = []) {
    const remoteIds = new Set(
      remoteRecords.map((record) => record && record.id).filter(Boolean),
    );
    return localRecords.filter(
      (record) => record && record.id && !remoteIds.has(record.id),
    );
  }

  function logToRow(log, userId) {
    return {
      id: log.id,
      user_id: userId,
      date: log.date,
      week: Number(log.week),
      day_id: log.dayId,
      day_title: log.dayTitle,
      readiness: log.readiness,
      rpe: log.rpe || null,
      strength_result: log.strengthResult || null,
      wod_score: log.wodScore || null,
      timer_result: log.timerResult || null,
      notes: log.notes || null,
      mobility_done: Boolean(log.mobilityDone),
      created_at: log.createdAt,
    };
  }

  function rowToLog(row) {
    return {
      id: row.id,
      date: row.date,
      week: Number(row.week),
      dayId: row.day_id,
      dayTitle: row.day_title,
      readiness: row.readiness,
      rpe: row.rpe || "",
      strengthResult: row.strength_result || "",
      wodScore: row.wod_score || "",
      timerResult: row.timer_result || null,
      notes: row.notes || "",
      mobilityDone: Boolean(row.mobility_done),
      createdAt: row.created_at,
    };
  }

  function prAttemptToRow(attempt, userId) {
    return {
      id: attempt.id,
      user_id: userId,
      metric_id: attempt.metricId,
      metric_name: attempt.metricName,
      value: Number(attempt.value),
      display: attempt.display,
      date: attempt.date,
      notes: attempt.notes || null,
      is_pr: Boolean(attempt.isPr),
      created_at: attempt.createdAt,
    };
  }

  function rowToPrAttempt(row) {
    return {
      id: row.id,
      metricId: row.metric_id,
      metricName: row.metric_name,
      value: Number(row.value),
      display: row.display,
      date: row.date,
      notes: row.notes || "",
      isPr: Boolean(row.is_pr),
      createdAt: row.created_at,
    };
  }

  function personalRecordToRow(metricId, record, userId) {
    return {
      user_id: userId,
      metric_id: metricId,
      value: Number(record.value),
      display: record.display,
      date: record.date,
      notes: record.notes || null,
      updated_at: new Date().toISOString(),
    };
  }

  function rowToPersonalRecord(row) {
    return {
      metricId: row.metric_id,
      value: Number(row.value),
      display: row.display,
      date: row.date,
      notes: row.notes || "",
    };
  }

  function rowsToPrs(rows = []) {
    return rows.reduce((prs, row) => {
      const record = rowToPersonalRecord(row);
      prs[record.metricId] = record;
      return prs;
    }, {});
  }

  function assertNoError(result) {
    if (result && result.error) throw result.error;
    return result ? result.data : undefined;
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
          client
            .from("workout_logs")
            .select("*")
            .order("created_at", { ascending: false }),
          client
            .from("pr_attempts")
            .select("*")
            .order("created_at", { ascending: false }),
          client.from("personal_records").select("*"),
        ]);

        return {
          logs: assertNoError(logsResult).map(rowToLog),
          prAttempts: assertNoError(attemptsResult).map(rowToPrAttempt),
          prs: rowsToPrs(assertNoError(prsResult)),
        };
      },
      async saveLog(log, userId) {
        await assertNoError(
          await client.from("workout_logs").upsert(logToRow(log, userId)),
        );
      },
      async clearLogs() {
        await assertNoError(
          await client.from("workout_logs").delete().neq("id", ""),
        );
      },
      async savePrAttempt(attempt, currentPrs, userId) {
        await assertNoError(
          await client
            .from("pr_attempts")
            .upsert(prAttemptToRow(attempt, userId)),
        );
        if (attempt.isPr && currentPrs[attempt.metricId]) {
          await assertNoError(
            await client
              .from("personal_records")
              .upsert(
                personalRecordToRow(
                  attempt.metricId,
                  currentPrs[attempt.metricId],
                  userId,
                ),
              ),
          );
        }
      },
      async uploadLocalScores(state, userId, remoteState) {
        const logs = unsyncedById(state.logs, remoteState.logs);
        const attempts = unsyncedById(state.prAttempts, remoteState.prAttempts);
        const remotePrs = remoteState.prs || {};
        const prs = Object.entries(state.prs || {}).filter(
          ([metricId]) => !remotePrs[metricId],
        );

        if (logs.length) {
          await assertNoError(
            await client
              .from("workout_logs")
              .upsert(logs.map((log) => logToRow(log, userId))),
          );
        }
        if (attempts.length) {
          await assertNoError(
            await client
              .from("pr_attempts")
              .upsert(
                attempts.map((attempt) => prAttemptToRow(attempt, userId)),
              ),
          );
        }
        if (prs.length) {
          await assertNoError(
            await client
              .from("personal_records")
              .upsert(
                prs.map(([metricId, record]) =>
                  personalRecordToRow(metricId, record, userId),
                ),
              ),
          );
        }

        return {
          logs: logs.length,
          prAttempts: attempts.length,
          prs: prs.length,
        };
      },
    };
  }

  const api = {
    createSupabaseStore,
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
