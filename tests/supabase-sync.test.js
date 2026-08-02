"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ATHLETE_STATE_SCHEMA_VERSION,
  athleteStateToRow,
  createSupabaseStore,
  isBetterPersonalRecord,
  logToRow,
  mergeById,
  mergePrs,
  prAttemptToRow,
  readinessCheckToRow,
  rowToLog,
  rowToAthleteState,
  rowToPrAttempt,
  rowToReadinessCheck,
  rowToTrainingEvent,
  rowsToPrs,
  trainingEventToRow,
  unsyncedById,
  validateAthleteState,
} = require("../supabase-sync.js");

function athleteState(overrides = {}) {
  return {
    profile: {
      athleteName: "Remote Athlete",
      assessment: { backSquat: "150" },
    },
    plans: [{ id: "remote-plan", name: "Remote programme", weeks: [] }],
    activePlanId: "remote-plan",
    selectedWeek: 2,
    planSchemaVersion: 3,
    cycleStartDate: "2026-07-06",
    v2Programs: [],
    activeV2ProgramId: null,
    v2ProgramRevisions: {},
    movementRestrictions: {
      movementIds: [],
      movementFamilyIds: [],
      guidance: null,
    },
    ...overrides,
  };
}

test("athlete-state helpers map one canonical private document", () => {
  const state = athleteState();
  const row = athleteStateToRow(state, "user-1");

  assert.deepEqual(row, {
    user_id: "user-1",
    schema_version: ATHLETE_STATE_SCHEMA_VERSION,
    state,
  });
  assert.deepEqual(
    rowToAthleteState(
      { ...row, updated_at: "2026-07-21T08:00:00.000Z" },
      "user-1",
    ),
    { ...state, updatedAt: "2026-07-21T08:00:00.000Z" },
  );
});

test("athlete-state validation rejects malformed and cross-account data", () => {
  assert.throws(
    () => validateAthleteState(athleteState({ selectedWeek: 9 })),
    (error) =>
      error.name === "ForgeHourSyncError" &&
      error.operation === "validate_remote_athlete_state",
  );
  assert.throws(
    () => validateAthleteState(athleteState({ plans: {} })),
    /Athlete plans are invalid/,
  );
  assert.throws(
    () =>
      rowToAthleteState(
        {
          user_id: "user-2",
          schema_version: ATHLETE_STATE_SCHEMA_VERSION,
          state: athleteState(),
          updated_at: "2026-07-21T08:00:00.000Z",
        },
        "user-1",
      ),
    /owner does not match/,
  );
});

test("Supabase store loads and saves athlete state for the requested owner", async () => {
  const calls = [];
  const state = athleteState();
  const row = {
    user_id: "user-1",
    schema_version: ATHLETE_STATE_SCHEMA_VERSION,
    state,
    updated_at: "2026-07-21T08:00:00.000Z",
  };
  const client = {
    from(table) {
      assert.equal(table, "athlete_states");
      return {
        select(columns) {
          calls.push({ type: "select", columns });
          return {
            eq(column, value) {
              calls.push({ type: "eq", column, value });
              return {
                maybeSingle: async () => ({ data: row, error: null }),
              };
            },
          };
        },
        upsert(payload, options) {
          calls.push({ type: "upsert", payload, options });
          return {
            select(columns) {
              calls.push({ type: "returning", columns });
              return { single: async () => ({ data: row, error: null }) };
            },
          };
        },
      };
    },
  };
  const store = createSupabaseStore(client);

  assert.deepEqual(await store.loadAthleteState("user-1"), {
    ...state,
    updatedAt: row.updated_at,
  });
  assert.deepEqual(await store.saveAthleteState(state, "user-1"), {
    ...state,
    updatedAt: row.updated_at,
  });
  assert.deepEqual(
    calls.find((call) => call.type === "eq"),
    { type: "eq", column: "user_id", value: "user-1" },
  );
  assert.deepEqual(calls.find((call) => call.type === "upsert").options, {
    onConflict: "user_id",
  });
});

test("Supabase V2 store uses validated atomic RPCs and optimistic revisions", async () => {
  const calls = [];
  const program = {
    engineVersion: "v2",
    validation: { valid: true, issues: [] },
  };
  const client = {
    async rpc(name, payload) {
      calls.push({ name, payload });
      if (name === "load_active_programming_engine_v2") {
        return {
          data: { program, revision: 4 },
          error: null,
        };
      }
      return {
        data: { programId: "programme-1", revision: 5 },
        error: null,
      };
    },
  };
  const store = createSupabaseStore(client);

  assert.deepEqual(await store.loadActiveProgrammingEngineV2(), {
    program,
    revision: 4,
  });
  assert.deepEqual(await store.saveProgrammingEngineV2(program, 4), {
    programId: "programme-1",
    revision: 5,
  });
  assert.deepEqual(calls[1], {
    name: "save_programming_engine_v2",
    payload: { p_program: program, p_expected_revision: 4 },
  });

  await assert.rejects(
    () =>
      store.saveProgrammingEngineV2({
        engineVersion: "v2",
        validation: {
          valid: false,
          issues: [{ severity: "error", code: "MISSING_LOAD" }],
        },
      }),
    /validated V2 programme is required/,
  );
  assert.equal(calls.length, 2);
});

test("Supabase sync helpers merge remote records without duplicates", () => {
  const local = [
    { id: "local-only", createdAt: "2026-01-01T00:00:00.000Z", value: "local" },
    { id: "shared", createdAt: "2026-01-02T00:00:00.000Z", value: "local" },
  ];
  const remote = [
    { id: "shared", createdAt: "2026-01-03T00:00:00.000Z", value: "remote" },
    {
      id: "remote-only",
      createdAt: "2026-01-04T00:00:00.000Z",
      value: "remote",
    },
  ];

  const merged = mergeById(local, remote);

  assert.deepEqual(
    merged.map((record) => record.id),
    ["remote-only", "shared", "local-only"],
  );
  assert.equal(merged.find((record) => record.id === "shared").value, "remote");
  assert.deepEqual(
    unsyncedById(local, remote).map((record) => record.id),
    ["local-only"],
  );
});

test("Supabase sync preserves local timer and proof metadata until the remote schema catches up", () => {
  const local = [
    {
      id: "proof-log",
      createdAt: "2026-07-11T10:00:00.000Z",
      timerResult: { mode: "amrap", elapsedSeconds: 600 },
      competitionProof: { proofId: "proof-1", recorded: true },
    },
  ];
  const remote = [
    {
      id: "proof-log",
      createdAt: "2026-07-11T10:00:00.000Z",
      timerResult: null,
      competitionProof: null,
    },
  ];

  const merged = mergeById(local, remote);
  const pending = unsyncedById(local, remote);

  assert.equal(merged[0].competitionProof.proofId, "proof-1");
  assert.equal(merged[0].timerResult.elapsedSeconds, 600);
  assert.deepEqual(
    pending.map((record) => record.id),
    ["proof-log"],
  );
});

test("Supabase sync helpers map workout logs to database rows and back", () => {
  const log = {
    id: "log-1",
    date: "2026-07-08",
    week: 2,
    dayId: "day1",
    dayTitle: "Back squat + T2B",
    workoutSource: "app",
    readiness: "green",
    difficulty: null,
    movementPatterns: [],
    durationMinutes: null,
    rpe: "8",
    strengthResult: "Back squat smooth",
    wodScore: "4 rounds",
    timerResult: {
      mode: "amrap",
      elapsedSeconds: 724,
      plannedSeconds: 720,
      splits: [{ label: "Round 1", elapsedSeconds: 95 }],
    },
    competitionProof: {
      version: 1,
      proofId: "proof-1",
      recorded: true,
      durationSeconds: 724,
      interrupted: false,
      overlayEmbedded: true,
    },
    trainingEventId: "event-1",
    readinessCheckId: "checkin-1",
    structuredScore: {
      scoreType: "rounds_reps",
      primaryValue: 4,
      secondaryValue: 8,
      unit: "reps",
    },
    recommendationSnapshot: {
      action: "train",
      reasons: ["Ready for planned work."],
    },
    rxStatus: "rx",
    notes: "Good pacing",
    mobilityDone: true,
    createdAt: "2026-07-08T10:00:00.000Z",
  };

  const row = logToRow(log, "user-1");

  assert.equal(row.user_id, "user-1");
  assert.equal(row.day_id, "day1");
  assert.equal(row.wod_score, "4 rounds");
  assert.equal(row.timer_result.mode, "amrap");
  assert.equal(row.competition_proof.proofId, "proof-1");
  assert.equal(row.training_event_id, "event-1");
  assert.equal(row.structured_score.scoreType, "rounds_reps");
  assert.deepEqual(rowToLog(row), log);

  const ordinaryRow = logToRow(
    { ...log, id: "log-2", competitionProof: null },
    "user-1",
  );
  assert.equal("competition_proof" in ordinaryRow, false);
});

test("Supabase sync maps lightweight box workout logs", () => {
  const log = {
    id: "box-log-1",
    date: "2026-07-29",
    week: 1,
    dayId: "box-2026-07-29",
    dayTitle: "Community WOD",
    workoutSource: "box",
    readiness: null,
    difficulty: 4,
    movementPatterns: ["squat", "long_conditioning"],
    durationMinutes: 55,
    rpe: "",
    strengthResult: "",
    wodScore: "",
    timerResult: null,
    competitionProof: null,
    trainingEventId: null,
    readinessCheckId: null,
    structuredScore: null,
    recommendationSnapshot: null,
    rxStatus: "scaled",
    notes: "Heavy legs",
    mobilityDone: false,
    createdAt: "2026-07-29T10:00:00.000Z",
  };
  const row = logToRow(log, "user-1");
  assert.equal(row.workout_source, "box");
  assert.equal(row.readiness, null);
  assert.equal(row.rx_status, "scaled");
  assert.deepEqual(row.movement_patterns, ["squat", "long_conditioning"]);
  assert.deepEqual(rowToLog(row), log);
});

test("Supabase sync maps owner-scoped training events and readiness checks", () => {
  const event = {
    id: "event-1",
    date: "2026-07-31",
    kind: "box",
    status: "planned",
    sessionId: null,
    title: "CrossFit box WOD",
    rawBoxText: "AMRAP 15: thrusters and pull-ups",
    movementIds: ["thrusters", "pull-ups"],
    stimuli: ["vertical_push", "vertical_pull", "medium_conditioning"],
    recommendation: { action: "swap", recommendedSessionId: "cycle-1-day2" },
    createdAt: "2026-07-31T08:00:00.000Z",
    updatedAt: "2026-07-31T08:05:00.000Z",
  };
  const checkin = {
    id: "checkin-1",
    date: "2026-07-31",
    energy: 4,
    soreness: "manageable",
    pain: false,
    availableMinutes: 60,
    createdAt: "2026-07-31T08:00:00.000Z",
  };

  const eventRow = trainingEventToRow(event, "user-1");
  const checkinRow = readinessCheckToRow(checkin, "user-1");
  assert.equal(eventRow.user_id, "user-1");
  assert.equal(checkinRow.user_id, "user-1");
  assert.deepEqual(rowToTrainingEvent(eventRow), event);
  assert.deepEqual(rowToReadinessCheck(checkinRow), checkin);
});

test("Supabase sync rejects invalid coach metadata before upload or hydration", () => {
  assert.throws(
    () =>
      trainingEventToRow(
        {
          id: "event-1",
          date: "2026-07-31",
          kind: "box",
          status: "planned",
          stimuli: ["invented_stimulus"],
          createdAt: "2026-07-31T08:00:00.000Z",
        },
        "user-1",
      ),
    /Training-event metadata is invalid/,
  );
  assert.throws(
    () =>
      readinessCheckToRow(
        {
          id: "checkin-1",
          date: "2026-07-31",
          energy: 6,
          soreness: "none",
          pain: false,
          availableMinutes: 60,
          createdAt: "2026-07-31T08:00:00.000Z",
        },
        "user-1",
      ),
    /Readiness metadata is invalid/,
  );
  assert.throws(
    () =>
      rowToReadinessCheck({
        id: "checkin-1",
        date: "2026-07-31",
        energy: 3,
        soreness: "unknown",
        pain: false,
        available_minutes: 60,
        created_at: "2026-07-31T08:00:00.000Z",
      }),
    /Readiness metadata is invalid/,
  );
});

test("Supabase sync preserves box metadata across a legacy workout-log schema", async () => {
  const boxLog = {
    id: "legacy-box-log",
    date: "2026-07-29",
    week: 1,
    dayId: "box-2026-07-29",
    dayTitle: "Community WOD",
    workoutSource: "box",
    readiness: null,
    difficulty: 4,
    movementPatterns: ["squat", "long_conditioning"],
    durationMinutes: 55,
    notes: "Heavy legs",
    createdAt: "2026-07-29T10:00:00.000Z",
  };
  const missingColumns = [
    "workout_source",
    "difficulty",
    "movement_patterns",
    "duration_minutes",
  ];
  const calls = [];
  const client = {
    from: () => ({
      upsert: async (payload) => {
        calls.push(payload);
        const missingColumn = missingColumns.find(
          (column) => column in payload,
        );
        if (missingColumn) {
          return {
            data: null,
            error: {
              code: "PGRST204",
              message: `Could not find the '${missingColumn}' column in the schema cache`,
            },
          };
        }
        return { data: payload, error: null };
      },
    }),
  };

  const result = await createSupabaseStore(client).saveLog(boxLog, "user-1");
  const compatiblePayload = calls.at(-1);
  assert.equal(result.workoutMetadataSynced, false);
  missingColumns.forEach((column) => {
    assert.equal(Object.hasOwn(compatiblePayload, column), false);
  });
  assert.equal(compatiblePayload.readiness, "green");

  const legacyRemote = rowToLog({
    ...compatiblePayload,
    id: boxLog.id,
    date: boxLog.date,
    week: boxLog.week,
    day_id: boxLog.dayId,
    day_title: boxLog.dayTitle,
    created_at: boxLog.createdAt,
  });
  const merged = mergeById([boxLog], [legacyRemote]);
  assert.equal(merged[0].workoutSource, "box");
  assert.equal(merged[0].readiness, null);
  assert.equal(merged[0].difficulty, 4);
  assert.deepEqual(merged[0].movementPatterns, ["squat", "long_conditioning"]);
  assert.equal(merged[0].durationMinutes, 55);
  assert.deepEqual(
    unsyncedById([boxLog], [legacyRemote]).map((log) => log.id),
    [boxLog.id],
  );
});

test("Supabase sync omits optional log columns missing from a legacy schema", async () => {
  const calls = [];
  const client = {
    from: () => ({
      upsert: async (payload) => {
        calls.push(payload);
        if (calls.length <= 2) {
          const missingColumn =
            calls.length === 1 ? "competition_proof" : "timer_result";
          return {
            data: null,
            error: {
              code: "PGRST204",
              message: `Could not find the '${missingColumn}' column in the schema cache`,
            },
          };
        }
        return { data: payload, error: null };
      },
    }),
  };
  const store = createSupabaseStore(client);
  const result = await store.saveLog(
    {
      id: "proof-log",
      date: "2026-07-11",
      week: 1,
      dayId: "day1",
      dayTitle: "Competition WOD",
      readiness: "green",
      timerResult: { mode: "amrap", elapsedSeconds: 600 },
      competitionProof: { recorded: true, proofId: "proof-1" },
      createdAt: "2026-07-11T10:00:00.000Z",
    },
    "user-1",
  );

  assert.equal(result.competitionProofSynced, false);
  assert.equal(result.timerResultSynced, false);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].competition_proof.proofId, "proof-1");
  assert.equal("competition_proof" in calls[1], false);
  assert.equal("timer_result" in calls[1], true);
  assert.equal("competition_proof" in calls[2], false);
  assert.equal("timer_result" in calls[2], false);
});

test("Supabase retry sends timer and proof payloads after a legacy schema upgrade", async () => {
  const calls = [];
  const client = {
    from: () => ({
      upsert: async (payload) => {
        calls.push(payload);
        const attempt = calls.length - 1;
        if (attempt < 2) {
          const missingColumn =
            attempt === 0 ? "competition_proof" : "timer_result";
          return {
            data: null,
            error: {
              code: "PGRST204",
              message: `Could not find the '${missingColumn}' column in the schema cache`,
            },
          };
        }
        return { data: payload, error: null };
      },
    }),
  };
  const log = {
    id: "pending-optional-log",
    date: "2026-07-11",
    week: 1,
    dayId: "day1",
    dayTitle: "Competition WOD",
    readiness: "green",
    timerResult: { mode: "amrap", elapsedSeconds: 600 },
    competitionProof: { recorded: true, proofId: "proof-1" },
    createdAt: "2026-07-11T10:00:00.000Z",
  };
  const state = { logs: [log], prAttempts: [], prs: {} };
  const remoteState = {
    ownerId: "user-1",
    hydrated: true,
    logs: [
      {
        id: log.id,
        timerResult: null,
        competitionProof: null,
      },
    ],
    prAttempts: [],
    prs: {},
  };
  const store = createSupabaseStore(client);

  const first = await store.uploadLocalScores(state, "user-1", remoteState);
  const retry = await store.uploadLocalScores(state, "user-1", remoteState);

  assert.deepEqual(first, {
    logs: 1,
    prAttempts: 0,
    prs: 0,
    trainingEvents: 0,
    readinessChecks: 0,
    competitionProofPending: 1,
    timerResultPending: 1,
    workoutMetadataPending: 0,
  });
  assert.deepEqual(retry, {
    logs: 1,
    prAttempts: 0,
    prs: 0,
    trainingEvents: 0,
    readinessChecks: 0,
    competitionProofPending: 0,
    timerResultPending: 0,
    workoutMetadataPending: 0,
  });
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0].competition_proof.proofId, "proof-1");
  assert.equal(calls[0][0].timer_result.elapsedSeconds, 600);
  assert.equal(calls[3][0].competition_proof.proofId, "proof-1");
  assert.equal(calls[3][0].timer_result.elapsedSeconds, 600);
});

test("Supabase sync loads workout logs while a schema migration is rolling out", async () => {
  const selectedColumns = [];
  const client = {
    from(table) {
      return {
        select(columns) {
          if (table === "personal_records") {
            return Promise.resolve({ data: [], error: null });
          }
          const builder = {
            order: () => builder,
            range: async () => {
              if (
                table === "pr_attempts" ||
                table === "training_events" ||
                table === "readiness_checks"
              ) {
                return { data: [], error: null };
              }
              selectedColumns.push(columns);
              if (selectedColumns.length <= 2) {
                const missingColumn =
                  selectedColumns.length === 1
                    ? "competition_proof"
                    : "timer_result";
                return {
                  data: null,
                  error: {
                    code: "PGRST204",
                    message: `Could not find the '${missingColumn}' column in the schema cache`,
                  },
                };
              }
              return {
                data: [
                  {
                    id: "legacy-log",
                    date: "2026-07-11",
                    week: 1,
                    day_id: "day1",
                    day_title: "Legacy workout",
                    readiness: "green",
                    created_at: "2026-07-11T10:00:00.000Z",
                  },
                ],
                error: null,
              };
            },
          };
          return builder;
        },
      };
    },
  };

  const scores = await createSupabaseStore(client).loadUserData();

  assert.equal(selectedColumns.length, 3);
  assert.match(selectedColumns[0], /competition_proof/);
  assert.doesNotMatch(selectedColumns[1], /competition_proof/);
  assert.doesNotMatch(selectedColumns[2], /timer_result/);
  assert.equal(scores.logs[0].id, "legacy-log");
  assert.equal(scores.logs[0].timerResult, null);
});

test("Supabase sync paginates logs and attempts with deterministic tie-breakers", async () => {
  const createdAt = "2026-07-14T10:00:00.000Z";
  const workoutRows = Array.from({ length: 1005 }, (_, index) => ({
    id: `log-${String(index).padStart(4, "0")}`,
    date: "2026-07-14",
    week: 1,
    day_id: "day1",
    day_title: "Paginated workout",
    readiness: "green",
    created_at: createdAt,
  }));
  const attemptRows = Array.from({ length: 1003 }, (_, index) => ({
    id: `attempt-${String(index).padStart(4, "0")}`,
    metric_id: "backSquat",
    metric_name: "Back squat",
    value: index + 1,
    display: `${index + 1} kg`,
    date: "2026-07-14",
    notes: null,
    is_pr: false,
    created_at: createdAt,
  }));
  const rowsByTable = {
    workout_logs: workoutRows,
    pr_attempts: attemptRows,
    training_events: [],
    readiness_checks: [],
  };
  const queries = [];
  const client = {
    from(table) {
      return {
        select() {
          if (table === "personal_records") {
            return Promise.resolve({ data: [], error: null });
          }
          const orders = [];
          const builder = {
            order(column, options) {
              orders.push({ column, ascending: options?.ascending });
              return builder;
            },
            range(from, to) {
              queries.push({ table, from, to, orders: [...orders] });
              const rows = [...rowsByTable[table]].sort((left, right) =>
                right.id.localeCompare(left.id),
              );
              return Promise.resolve({
                data: rows.slice(from, to + 1),
                error: null,
              });
            },
          };
          return builder;
        },
      };
    },
  };

  const scores = await createSupabaseStore(client).loadUserData();

  assert.equal(scores.logs.length, 1005);
  assert.equal(scores.prAttempts.length, 1003);
  assert.equal(new Set(scores.logs.map((log) => log.id)).size, 1005);
  assert.equal(
    new Set(scores.prAttempts.map((attempt) => attempt.id)).size,
    1003,
  );
  assert.equal(scores.logs[0].id, "log-1004");
  assert.equal(scores.logs.at(-1).id, "log-0000");
  assert.equal(scores.prAttempts[0].id, "attempt-1002");
  assert.equal(scores.prAttempts.at(-1).id, "attempt-0000");
  for (const table of ["workout_logs", "pr_attempts"]) {
    const tableQueries = queries.filter((query) => query.table === table);
    assert.deepEqual(
      tableQueries.map(({ from, to }) => [from, to]),
      [
        [0, 999],
        [1000, 1999],
      ],
    );
    tableQueries.forEach((query) =>
      assert.deepEqual(query.orders, [
        { column: "created_at", ascending: false },
        { column: "id", ascending: false },
      ]),
    );
  }
});

test("Supabase sync rejects malformed remote records at the trust boundary", () => {
  assert.throws(
    () =>
      rowToLog({
        id: "bad-log",
        date: "2026-07-11",
        week: 99,
        day_id: "day1",
        day_title: "Bad workout",
        readiness: "green",
        created_at: "2026-07-11T10:00:00.000Z",
      }),
    (error) =>
      error.name === "ForgeHourSyncError" &&
      error.operation === "validate_remote_data",
  );
});

test("Supabase sync rejects malformed local writes before contacting Supabase", async () => {
  let contacted = false;
  const store = createSupabaseStore({
    from() {
      contacted = true;
      throw new Error("The malformed record reached Supabase");
    },
  });

  await assert.rejects(
    store.saveLog(
      {
        id: "bad-local-log",
        date: "2026-07-11",
        week: 0,
        dayId: "day1",
        dayTitle: "Bad workout",
        readiness: "unknown",
        createdAt: "2026-07-11T10:00:00.000Z",
      },
      "user-1",
    ),
    (error) =>
      error.name === "ForgeHourSyncError" &&
      error.operation === "validate_local_data",
  );
  assert.equal(contacted, false);
});

test("Supabase score sync never uploads canonical training plans", async () => {
  const tables = [];
  const client = {
    from(table) {
      tables.push(table);
      throw new Error(`Unexpected Supabase write to ${table}`);
    },
  };
  const store = createSupabaseStore(client);
  const result = await store.uploadLocalScores(
    {
      plans: [
        {
          id: "local-plan",
          title: "Local only",
          sessions: [{ id: "local-session", wod: ["AMRAP 10"] }],
        },
      ],
      activePlanId: "local-plan",
      logs: [],
      prAttempts: [],
      prs: {},
    },
    "user-1",
    {
      ownerId: "user-1",
      hydrated: true,
      logs: [],
      prAttempts: [],
      prs: {},
    },
  );

  assert.deepEqual(result, {
    logs: 0,
    prAttempts: 0,
    prs: 0,
    trainingEvents: 0,
    readinessChecks: 0,
    competitionProofPending: 0,
    timerResultPending: 0,
    workoutMetadataPending: 0,
  });
  assert.deepEqual(tables, []);
});

test("Supabase sync helpers map PR attempts and personal records", () => {
  const attempt = {
    id: "attempt-1",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 150,
    display: "150 kg",
    date: "2026-07-08",
    notes: "Fast",
    isPr: true,
    createdAt: "2026-07-08T10:00:00.000Z",
  };

  const row = prAttemptToRow(attempt, "user-1");
  const prs = mergePrs(
    { snatch: { display: "75 kg" } },
    rowsToPrs([
      {
        metric_id: "backSquat",
        value: 150,
        display: "150 kg",
        date: "2026-07-08",
        notes: "Fast",
        updated_at: "2026-07-08T10:00:00.000Z",
      },
    ]),
  );

  assert.equal(row.metric_id, "backSquat");
  assert.equal(row.is_pr, true);
  assert.deepEqual(rowToPrAttempt(row), attempt);
  assert.equal(prs.backSquat.display, "150 kg");
  assert.equal(prs.snatch.display, "75 kg");
});

test("Supabase PR saves use the atomic ownership-safe database function", async () => {
  const calls = [];
  const client = {
    rpc(name, payload) {
      calls.push({ name, payload });
      return Promise.resolve({ data: null, error: null });
    },
  };
  const store = createSupabaseStore(client);
  const attempt = {
    id: "attempt-atomic",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 155,
    display: "155 kg",
    date: "2026-07-12",
    notes: "Smooth",
    isPr: true,
    createdAt: "2026-07-12T10:00:00.000Z",
  };

  const canonicalRecord = await store.savePrAttempt(
    attempt,
    {
      backSquat: {
        metricId: "backSquat",
        value: 155,
        display: "155 kg",
        date: "2026-07-12",
        notes: "Smooth",
        updatedAt: "2026-07-12T10:00:00.000Z",
      },
    },
    "untrusted-client-user-id",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_pr_attempt");
  assert.equal("user_id" in calls[0].payload.p_attempt, false);
  assert.equal("user_id" in calls[0].payload.p_personal_record, false);
  assert.equal(calls[0].payload.p_attempt.metric_id, "backSquat");
  assert.equal(canonicalRecord, null);
});

test("Supabase PR saves return the validated canonical database record", async () => {
  const client = {
    rpc() {
      return Promise.resolve({
        data: {
          metric_id: "backSquat",
          value: 165,
          display: "165 kg",
          date: "2026-07-13",
          notes: "Existing database winner",
          updated_at: "2026-07-13T10:00:00.000Z",
        },
        error: null,
      });
    },
  };
  const attempt = {
    id: "attempt-canonical",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 160,
    display: "160 kg",
    date: "2026-07-14",
    notes: "Client candidate",
    isPr: true,
    createdAt: "2026-07-14T10:00:00.000Z",
  };

  const canonicalRecord = await createSupabaseStore(client).savePrAttempt(
    attempt,
    {
      backSquat: {
        metricId: "backSquat",
        value: 160,
        display: "160 kg",
        date: "2026-07-14",
        notes: "Client candidate",
        updatedAt: attempt.createdAt,
      },
    },
    "user-1",
  );

  assert.deepEqual(canonicalRecord, {
    metricId: "backSquat",
    value: 165,
    display: "165 kg",
    date: "2026-07-13",
    notes: "Existing database winner",
    updatedAt: "2026-07-13T10:00:00.000Z",
  });
});

test("Supabase PR saves reject malformed canonical RPC records", async () => {
  const client = {
    rpc() {
      return Promise.resolve({
        data: { metric_id: "backSquat", value: 165 },
        error: null,
      });
    },
  };
  const attempt = {
    id: "attempt-malformed-canonical",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 165,
    display: "165 kg",
    date: "2026-07-14",
    isPr: false,
    createdAt: "2026-07-14T10:00:00.000Z",
  };

  await assert.rejects(
    createSupabaseStore(client).savePrAttempt(attempt, {}, "user-1"),
    (error) =>
      error.name === "ForgeHourSyncError" &&
      error.operation === "validate_remote_data",
  );
});

test("Supabase retry sync also saves PR attempts through the atomic function", async () => {
  const calls = [];
  const client = {
    rpc(name, payload) {
      calls.push({ type: "rpc", name, payload });
      return Promise.resolve({ data: null, error: null });
    },
    from(table) {
      return {
        upsert(payload) {
          calls.push({ type: "upsert", table, payload });
          return Promise.resolve({ data: payload, error: null });
        },
      };
    },
  };
  const attempt = {
    id: "retry-attempt",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 160,
    display: "160 kg",
    date: "2026-07-13",
    notes: "Offline PR",
    isPr: true,
    createdAt: "2026-07-13T10:00:00.000Z",
  };
  const scores = {
    logs: [],
    prAttempts: [attempt],
    prs: {
      backSquat: {
        metricId: "backSquat",
        value: 160,
        display: "160 kg",
        date: "2026-07-13",
        notes: "Offline PR",
        updatedAt: "2026-07-13T10:00:00.000Z",
      },
    },
  };

  await createSupabaseStore(client).uploadLocalScores(scores, "user-1", {
    ownerId: "user-1",
    hydrated: true,
    logs: [],
    prAttempts: [],
    prs: {},
  });

  assert.equal(calls[0].type, "rpc");
  assert.equal(calls[0].name, "save_pr_attempt");
  assert.equal(
    calls.some(
      (call) => call.type === "upsert" && call.table === "pr_attempts",
    ),
    false,
  );
});

test("Supabase retry requires a hydrated index for the same authenticated owner", async () => {
  const store = createSupabaseStore({});
  const scores = { logs: [], prAttempts: [], prs: {} };

  await assert.rejects(
    store.uploadLocalScores(scores, "user-1", {
      ownerId: "user-2",
      hydrated: true,
      logs: [],
      prAttempts: [],
      prs: {},
    }),
    (error) =>
      error.name === "ForgeHourSyncError" &&
      error.operation === "prepare_score_sync",
  );
});

test("Supabase local validation rejects nonpositive PR attempts before RPC", async () => {
  let contacted = false;
  const store = createSupabaseStore({
    rpc() {
      contacted = true;
      return Promise.resolve({ data: null, error: null });
    },
  });
  const attempt = {
    id: "invalid-attempt",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 0,
    display: "0 kg",
    date: "2026-07-13",
    isPr: false,
    createdAt: "2026-07-13T10:00:00.000Z",
  };

  await assert.rejects(
    store.savePrAttempt(attempt, {}, "user-1"),
    (error) =>
      error.name === "ForgeHourSyncError" &&
      error.operation === "validate_local_data",
  );
  assert.equal(contacted, false);
});

test("Supabase retry uploads historical PR attempts without mismatched current records", async () => {
  const calls = [];
  const client = {
    rpc(name, payload) {
      calls.push({ name, payload });
      return Promise.resolve({ data: null, error: null });
    },
  };
  const attempt = (id, value, createdAt) => ({
    id,
    metricId: "backSquat",
    metricName: "Back squat",
    value,
    display: `${value} kg`,
    date: createdAt.slice(0, 10),
    isPr: true,
    createdAt,
  });
  const historical = attempt("historical-pr", 150, "2026-07-12T10:00:00.000Z");
  const current = attempt("current-pr", 160, "2026-07-13T10:00:00.000Z");

  await createSupabaseStore(client).uploadLocalScores(
    {
      logs: [],
      prAttempts: [historical, current],
      prs: {
        backSquat: {
          metricId: "backSquat",
          value: 160,
          display: "160 kg",
          date: "2026-07-13",
          notes: "",
          updatedAt: current.createdAt,
        },
      },
    },
    "user-1",
    {
      ownerId: "user-1",
      hydrated: true,
      logs: [],
      prAttempts: [],
      prs: {},
    },
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].payload.p_personal_record, null);
  assert.equal(calls[1].payload.p_personal_record.value, 160);
});

test("Supabase retry sends standalone records only when they improve remote state", async () => {
  const calls = [];
  const client = {
    rpc(name, payload) {
      calls.push({ name, payload });
      return Promise.resolve({ data: null, error: null });
    },
  };
  const store = createSupabaseStore(client);
  const record = (value, updatedAt) => ({
    metricId: "row1k",
    value,
    display: `${value} sec`,
    date: "2026-07-13",
    notes: "",
    updatedAt,
  });

  assert.equal(
    isBetterPersonalRecord(
      record(205, "2026-07-13T10:00:00.000Z"),
      record(210, "2026-07-12T10:00:00.000Z"),
      "row1k",
    ),
    true,
  );
  assert.equal(
    isBetterPersonalRecord(
      record(215, "2026-07-14T10:00:00.000Z"),
      record(210, "2026-07-12T10:00:00.000Z"),
      "row1k",
    ),
    false,
  );

  await store.uploadLocalScores(
    {
      logs: [],
      prAttempts: [],
      prs: { row1k: record(205, "2026-07-13T10:00:00.000Z") },
    },
    "user-1",
    {
      ownerId: "user-1",
      hydrated: true,
      logs: [],
      prAttempts: [],
      prs: { row1k: record(210, "2026-07-12T10:00:00.000Z") },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_personal_record");
  assert.equal(calls[0].payload.p_personal_record.value, 205);
  assert.equal("user_id" in calls[0].payload.p_personal_record, false);
});
