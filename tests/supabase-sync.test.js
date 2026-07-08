"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  logToRow,
  mergeById,
  mergePrs,
  prAttemptToRow,
  rowToLog,
  rowToPrAttempt,
  rowsToPrs,
  unsyncedById
} = require("../supabase-sync.js");

test("Supabase sync helpers merge remote records without duplicates", () => {
  const local = [
    { id: "local-only", createdAt: "2026-01-01T00:00:00.000Z", value: "local" },
    { id: "shared", createdAt: "2026-01-02T00:00:00.000Z", value: "local" }
  ];
  const remote = [
    { id: "shared", createdAt: "2026-01-03T00:00:00.000Z", value: "remote" },
    { id: "remote-only", createdAt: "2026-01-04T00:00:00.000Z", value: "remote" }
  ];

  const merged = mergeById(local, remote);

  assert.deepEqual(merged.map((record) => record.id), ["remote-only", "shared", "local-only"]);
  assert.equal(merged.find((record) => record.id === "shared").value, "remote");
  assert.deepEqual(unsyncedById(local, remote).map((record) => record.id), ["local-only"]);
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
    notes: "Good pacing",
    mobilityDone: true,
    createdAt: "2026-07-08T10:00:00.000Z"
  };

  const row = logToRow(log, "user-1");

  assert.equal(row.user_id, "user-1");
  assert.equal(row.day_id, "day1");
  assert.equal(row.wod_score, "4 rounds");
  assert.deepEqual(rowToLog(row), log);
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
    createdAt: "2026-07-08T10:00:00.000Z"
  };

  const row = prAttemptToRow(attempt, "user-1");
  const prs = mergePrs({ snatch: { display: "75 kg" } }, rowsToPrs([
    { metric_id: "backSquat", value: 150, display: "150 kg", date: "2026-07-08", notes: "Fast" }
  ]));

  assert.equal(row.metric_id, "backSquat");
  assert.equal(row.is_pr, true);
  assert.deepEqual(rowToPrAttempt(row), attempt);
  assert.equal(prs.backSquat.display, "150 kg");
  assert.equal(prs.snatch.display, "75 kg");
});
