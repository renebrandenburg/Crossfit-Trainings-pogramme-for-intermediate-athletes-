"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createSupabaseStore,
  logToRow,
  mergeById,
  mergePrs,
  prAttemptToRow,
  rowToLog,
  rowToPrAttempt,
  rowsToPrs,
  unsyncedById,
} = require("../supabase-sync.js");

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

test("Supabase sync preserves local proof metadata until the remote schema catches up", () => {
  const local = [
    {
      id: "proof-log",
      createdAt: "2026-07-11T10:00:00.000Z",
      competitionProof: { proofId: "proof-1", recorded: true },
    },
  ];
  const remote = [
    {
      id: "proof-log",
      createdAt: "2026-07-11T10:00:00.000Z",
      competitionProof: null,
    },
  ];

  const merged = mergeById(local, remote);
  const pending = unsyncedById(local, remote);

  assert.equal(merged[0].competitionProof.proofId, "proof-1");
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
    readiness: "green",
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
  assert.deepEqual(rowToLog(row), log);

  const ordinaryRow = logToRow(
    { ...log, id: "log-2", competitionProof: null },
    "user-1",
  );
  assert.equal("competition_proof" in ordinaryRow, false);
});

test("Supabase sync falls back safely when competition_proof is not migrated", async () => {
  const calls = [];
  const client = {
    from: () => ({
      upsert: async (payload) => {
        calls.push(payload);
        if (calls.length === 1) {
          return {
            data: null,
            error: {
              code: "PGRST204",
              message:
                "Could not find the 'competition_proof' column in the schema cache",
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
      competitionProof: { recorded: true, proofId: "proof-1" },
      createdAt: "2026-07-11T10:00:00.000Z",
    },
    "user-1",
  );

  assert.equal(result.competitionProofSynced, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].competition_proof.proofId, "proof-1");
  assert.equal("competition_proof" in calls[1], false);
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
    { logs: [], prAttempts: [], prs: {} },
  );

  assert.deepEqual(result, {
    logs: 0,
    prAttempts: 0,
    prs: 0,
    competitionProofPending: 0,
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
      },
    ]),
  );

  assert.equal(row.metric_id, "backSquat");
  assert.equal(row.is_pr, true);
  assert.deepEqual(rowToPrAttempt(row), attempt);
  assert.equal(prs.backSquat.display, "150 kg");
  assert.equal(prs.snatch.display, "75 kg");
});
