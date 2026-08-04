"use strict";

(function initializeLocalStateStore(globalScope) {
  const runtimeScope = /** @type {any} */ (globalScope);
  const LEGACY_KEY = "forge-hour-state-v1";
  const META_KEY = "forge-hour-meta-v2";
  const ATHLETE_PREFIX = "forge-hour-athlete-v2:";
  const SCORES_PREFIX = "forge-hour-scores-v2:";
  const SYNC_PREFIX = "forge-hour-sync-v1:";
  const PROGRAM_PREFIX = "crossfit:v2:programme:";
  const COMPLETION_PREFIX = "crossfit:v2:completion:";
  const LEGACY_SNAPSHOT_DELAY = 5000;

  function ownerKey(prefix, ownerId) {
    return `${prefix}${encodeURIComponent(String(ownerId || "guest"))}`;
  }

  function parse(storage, key, fallback = null) {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  }

  function createLocalStateStore(storage, options = {}) {
    let legacySnapshotTimer = null;
    const legacySnapshotDelay = Number.isFinite(options.legacySnapshotDelay)
      ? Math.max(0, options.legacySnapshotDelay)
      : LEGACY_SNAPSHOT_DELAY;

    function load() {
      const meta = parse(storage, META_KEY);
      if (!meta || meta.version !== 2 || !Array.isArray(meta.owners)) {
        return parse(storage, LEGACY_KEY);
      }

      const athleteStateByOwner = {};
      const scoreDataByOwner = {};
      const syncStateByOwner = {};
      for (const ownerId of meta.owners) {
        const athlete = parse(storage, ownerKey(ATHLETE_PREFIX, ownerId));
        const scores = parse(storage, ownerKey(SCORES_PREFIX, ownerId));
        const sync = parse(storage, ownerKey(SYNC_PREFIX, ownerId));
        if (athlete) athleteStateByOwner[ownerId] = athlete;
        if (scores) scoreDataByOwner[ownerId] = scores;
        if (sync) syncStateByOwner[ownerId] = sync;
      }

      const activeOwner = String(meta.activeScoreOwner || "guest");
      const activeAthlete = athleteStateByOwner[activeOwner] || {};
      return {
        ...activeAthlete,
        v2Programs: activeAthlete.v2Programs || [],
        schemaVersion: Number(meta.schemaVersion) || 4,
        activeScoreOwner: activeOwner,
        themePreference: meta.themePreference || "system",
        athleteStateByOwner,
        scoreDataByOwner,
        syncStateByOwner,
      };
    }

    function scheduleLegacySnapshot(state) {
      if (legacySnapshotDelay === 0) {
        storage.setItem(LEGACY_KEY, JSON.stringify(state));
        return;
      }
      const schedule = runtimeScope?.setTimeout || setTimeout;
      const cancel = runtimeScope?.clearTimeout || clearTimeout;
      if (legacySnapshotTimer) cancel(legacySnapshotTimer);
      legacySnapshotTimer = schedule(() => {
        legacySnapshotTimer = null;
        try {
          storage.setItem(LEGACY_KEY, JSON.stringify(state));
        } catch {
          // The canonical v2 slices were already written successfully.
        }
      }, legacySnapshotDelay);
    }

    function save(state, previousState = null) {
      const previousMeta = parse(storage, META_KEY, { programmeIds: [] });
      const athleteBuckets = state.athleteStateByOwner || {};
      const scoreBuckets = state.scoreDataByOwner || {};
      const syncBuckets = state.syncStateByOwner || {};
      const owners = [
        ...new Set([
          "guest",
          ...Object.keys(athleteBuckets),
          ...Object.keys(scoreBuckets),
          ...Object.keys(syncBuckets),
        ]),
      ];
      const previousAthletes = previousState?.athleteStateByOwner || {};
      const previousScores = previousState?.scoreDataByOwner || {};
      const previousSync = previousState?.syncStateByOwner || {};
      const currentProgrammeIds = new Set(
        (
          state.v2Programs ||
          owners.flatMap((ownerId) => athleteBuckets[ownerId]?.v2Programs || [])
        ).map((program) => String(program.id)),
      );
      for (const programmeId of previousMeta.programmeIds || []) {
        if (currentProgrammeIds.has(programmeId)) continue;
        const program = parse(
          storage,
          `${PROGRAM_PREFIX}${encodeURIComponent(programmeId)}`,
        );
        for (const session of program?.trainingBlocks?.flatMap(
          (block) =>
            block.trainingWeeks?.flatMap((week) => week.sessions || []) || [],
        ) || []) {
          storage.removeItem(
            `${COMPLETION_PREFIX}${encodeURIComponent(programmeId)}:${encodeURIComponent(session.id)}`,
          );
        }
        storage.removeItem(
          `${PROGRAM_PREFIX}${encodeURIComponent(programmeId)}`,
        );
      }

      storage.setItem(
        META_KEY,
        JSON.stringify({
          version: 2,
          schemaVersion: Number(state.schemaVersion) || 4,
          activeScoreOwner: state.activeScoreOwner || "guest",
          themePreference: state.themePreference || "system",
          owners,
          programmeIds: [
            ...new Set(
              owners.flatMap((ownerId) =>
                (athleteBuckets[ownerId]?.v2Programs || []).map((program) =>
                  String(program.id),
                ),
              ),
            ),
          ],
        }),
      );

      for (const program of state.v2Programs || []) {
        if (program?.id) {
          storage.setItem(
            `${PROGRAM_PREFIX}${encodeURIComponent(program.id)}`,
            JSON.stringify(program),
          );
          for (const session of program.trainingBlocks?.flatMap(
            (block) =>
              block.trainingWeeks?.flatMap((week) => week.sessions || []) || [],
          ) || []) {
            if (session.status === "completed" || session.feedback) {
              storage.setItem(
                `${COMPLETION_PREFIX}${encodeURIComponent(program.id)}:${encodeURIComponent(session.id)}`,
                JSON.stringify({
                  status: session.status,
                  feedback: session.feedback,
                  revision: session.revision,
                }),
              );
            }
          }
        }
      }

      for (const ownerId of owners) {
        if (
          athleteBuckets[ownerId] &&
          athleteBuckets[ownerId] !== previousAthletes[ownerId]
        ) {
          storage.setItem(
            ownerKey(ATHLETE_PREFIX, ownerId),
            JSON.stringify(athleteBuckets[ownerId]),
          );
        }
        if (
          scoreBuckets[ownerId] &&
          scoreBuckets[ownerId] !== previousScores[ownerId]
        ) {
          storage.setItem(
            ownerKey(SCORES_PREFIX, ownerId),
            JSON.stringify(scoreBuckets[ownerId]),
          );
        }
        if (
          syncBuckets[ownerId] &&
          syncBuckets[ownerId] !== previousSync[ownerId]
        ) {
          storage.setItem(
            ownerKey(SYNC_PREFIX, ownerId),
            JSON.stringify(syncBuckets[ownerId]),
          );
        }
      }

      scheduleLegacySnapshot(state);
      return true;
    }

    function clear() {
      if (legacySnapshotTimer) {
        const cancel = runtimeScope?.clearTimeout || clearTimeout;
        cancel(legacySnapshotTimer);
        legacySnapshotTimer = null;
      }
      const meta = parse(storage, META_KEY, { owners: [] });
      for (const ownerId of meta.owners || []) {
        storage.removeItem(ownerKey(ATHLETE_PREFIX, ownerId));
        storage.removeItem(ownerKey(SCORES_PREFIX, ownerId));
        storage.removeItem(ownerKey(SYNC_PREFIX, ownerId));
      }
      for (const programId of meta.programmeIds || []) {
        const program = parse(
          storage,
          `${PROGRAM_PREFIX}${encodeURIComponent(programId)}`,
        );
        for (const session of program?.trainingBlocks?.flatMap(
          (block) =>
            block.trainingWeeks?.flatMap((week) => week.sessions || []) || [],
        ) || []) {
          storage.removeItem(
            `${COMPLETION_PREFIX}${encodeURIComponent(programId)}:${encodeURIComponent(session.id)}`,
          );
        }
        storage.removeItem(`${PROGRAM_PREFIX}${encodeURIComponent(programId)}`);
      }
      storage.removeItem(META_KEY);
      storage.removeItem(LEGACY_KEY);
    }

    return { clear, load, save };
  }

  const api = Object.freeze({
    ATHLETE_PREFIX,
    LEGACY_KEY,
    META_KEY,
    PROGRAM_PREFIX,
    COMPLETION_PREFIX,
    SCORES_PREFIX,
    SYNC_PREFIX,
    createLocalStateStore,
  });

  runtimeScope.ForgeHourLocalState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
