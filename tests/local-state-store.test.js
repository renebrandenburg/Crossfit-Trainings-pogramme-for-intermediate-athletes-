"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ATHLETE_PREFIX,
  COMPLETION_PREFIX,
  LEGACY_KEY,
  META_KEY,
  PROGRAM_PREFIX,
  SCORES_PREFIX,
  createLocalStateStore,
} = require("../local-state-store.js");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      writes.push(key);
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key),
  };
}

function exampleState() {
  const athlete = {
    profile: { athleteName: "Guest" },
    plans: [],
    activePlanId: null,
    selectedWeek: 1,
    planSchemaVersion: 5,
    updatedAt: "2026-07-30T08:00:00.000Z",
  };
  return {
    ...athlete,
    schemaVersion: 4,
    activeScoreOwner: "guest",
    themePreference: "system",
    athleteStateByOwner: { guest: athlete },
    scoreDataByOwner: { guest: { logs: [], prs: {}, prAttempts: [] } },
    syncStateByOwner: {},
  };
}

test("local state store imports the legacy document and writes owner slices", () => {
  const legacy = exampleState();
  const storage = memoryStorage({ [LEGACY_KEY]: JSON.stringify(legacy) });
  const store = createLocalStateStore(storage, { legacySnapshotDelay: 0 });

  assert.deepEqual(store.load(), legacy);
  store.save(legacy);

  assert.ok(storage.getItem(META_KEY));
  assert.ok(storage.getItem(`${ATHLETE_PREFIX}guest`));
  assert.ok(storage.getItem(`${SCORES_PREFIX}guest`));
  assert.equal(store.load().profile.athleteName, "Guest");
});

test("local state store only rewrites changed owner slices", () => {
  const storage = memoryStorage();
  const store = createLocalStateStore(storage, { legacySnapshotDelay: 0 });
  const first = exampleState();
  store.save(first);
  storage.writes.length = 0;

  const second = {
    ...first,
    scoreDataByOwner: {
      guest: { ...first.scoreDataByOwner.guest, logs: [{ id: "log-1" }] },
    },
  };
  store.save(second, first);

  assert.equal(storage.writes.includes(`${ATHLETE_PREFIX}guest`), false);
  assert.equal(storage.writes.includes(`${SCORES_PREFIX}guest`), true);
});

test("local state store keeps achievement progress in the active owner score slice", () => {
  const storage = memoryStorage();
  const store = createLocalStateStore(storage, { legacySnapshotDelay: 0 });
  const state = exampleState();
  state.schemaVersion = 6;
  state.scoreDataByOwner.guest.achievementState = {
    version: 1,
    earned: { "first-session": "2026-08-01T10:00:00.000Z" },
    acknowledgedIds: ["first-session"],
    lastEvaluatedAt: "2026-08-01T10:00:00.000Z",
  };

  store.save(state);

  const loaded = store.load();
  assert.equal(loaded.schemaVersion, 6);
  assert.deepEqual(
    loaded.scoreDataByOwner.guest.achievementState,
    state.scoreDataByOwner.guest.achievementState,
  );
});

test("local state store clears legacy and sliced owner data", () => {
  const storage = memoryStorage();
  const store = createLocalStateStore(storage, { legacySnapshotDelay: 0 });
  store.save(exampleState());
  store.clear();

  assert.equal(storage.getItem(LEGACY_KEY), null);
  assert.equal(storage.getItem(META_KEY), null);
  assert.equal(storage.getItem(`${ATHLETE_PREFIX}guest`), null);
  assert.equal(storage.getItem(`${SCORES_PREFIX}guest`), null);
});

test("clearing local state cancels a pending legacy snapshot", async () => {
  const storage = memoryStorage();
  const store = createLocalStateStore(storage, { legacySnapshotDelay: 10 });

  store.save(exampleState());
  store.clear();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(storage.getItem(LEGACY_KEY), null);
});

test("V2 programme and completion cache keys are isolated by programme and session", () => {
  const storage = memoryStorage();
  const store = createLocalStateStore(storage, { legacySnapshotDelay: 0 });
  const session = (id, status = "completed") => ({
    id,
    status,
    feedback: { notes: id },
    revision: 2,
  });
  const programme = (id, sessionId) => ({
    id,
    trainingBlocks: [{ trainingWeeks: [{ sessions: [session(sessionId)] }] }],
  });
  const state = {
    ...exampleState(),
    v2Programs: [
      programme("programme-a", "session-a"),
      programme("programme-b", "session-b"),
    ],
  };

  store.save(state);

  assert.ok(storage.getItem(`${PROGRAM_PREFIX}programme-a`));
  assert.ok(storage.getItem(`${PROGRAM_PREFIX}programme-b`));
  assert.ok(storage.getItem(`${COMPLETION_PREFIX}programme-a:session-a`));
  assert.ok(storage.getItem(`${COMPLETION_PREFIX}programme-b:session-b`));
});
