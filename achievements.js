"use strict";

(function initializeAchievements(globalScope) {
  const ACHIEVEMENT_STATE_VERSION = 1;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEK_MS = 7 * DAY_MS;
  const ENGINE_BENCHMARK_IDS = new Set([
    "row1k",
    "row2k",
    "run5k",
    "bike10MinCalories",
    "murph",
  ]);

  /** @type {Array<[string, string, string, string, string, number]>} */
  const definitions = [
    [
      "first-session",
      "consistency",
      "First Session",
      "Log your first workout.",
      "1",
      1,
    ],
    [
      "training-habit",
      "consistency",
      "Training Habit",
      "Log three workouts.",
      "3",
      3,
    ],
    [
      "four-week-fire",
      "consistency",
      "Four-Week Fire",
      "Train in four consecutive weeks.",
      "4W",
      4,
    ],
    [
      "consistency-engine",
      "consistency",
      "Consistency Engine",
      "Log 12 sessions in 28 days.",
      "12",
      12,
    ],
    [
      "new-standard",
      "pr",
      "New Standard",
      "Set your first personal record.",
      "PR",
      1,
    ],
    [
      "pr-collector",
      "pr",
      "PR Collector",
      "Set five personal records.",
      "5",
      5,
    ],
    [
      "record-machine",
      "pr",
      "Record Machine",
      "Set ten personal records.",
      "10",
      10,
    ],
    [
      "benchmark-breakthrough",
      "benchmark",
      "Benchmark Breakthrough",
      "Improve an engine benchmark.",
      "B1",
      1,
    ],
    [
      "engine-builder",
      "benchmark",
      "Engine Builder",
      "Improve three engine benchmarks.",
      "B3",
      3,
    ],
    [
      "first-bar-muscle-up",
      "skill",
      "First Bar Muscle-Up",
      "Record one unassisted bar muscle-up.",
      "BMU",
      1,
    ],
    [
      "first-ring-muscle-up",
      "skill",
      "First Ring Muscle-Up",
      "Record one unassisted ring muscle-up.",
      "RMU",
      1,
    ],
    [
      "upside-down",
      "skill",
      "Upside Down",
      "Record one strict handstand push-up.",
      "HSPU",
      1,
    ],
    [
      "handstand-traveller",
      "skill",
      "Handstand Traveller",
      "Record at least one metre of handstand walking.",
      "HSW",
      1,
    ],
    ["rx-rising", "rx", "RX Rising", "Reach RX Level 25.", "25", 25],
    ["rx-contender", "rx", "RX Contender", "Reach RX Level 50.", "50", 50],
    ["rx-ready", "rx", "RX Ready", "Reach RX Level 75.", "75", 75],
  ];

  const ACHIEVEMENT_DEFINITIONS = Object.freeze(
    definitions.map(([id, category, title, description, icon, target]) =>
      Object.freeze({ id, category, title, description, icon, target }),
    ),
  );
  const DEFINITION_IDS = new Set(
    ACHIEVEMENT_DEFINITIONS.map((definition) => definition.id),
  );

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function timestamp(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function recordTimestamp(record) {
    return timestamp(record?.date) ?? timestamp(record?.createdAt);
  }

  function uniqueRecords(records) {
    const seen = new Set();
    return (Array.isArray(records) ? records : [])
      .filter((record) => {
        if (!record || typeof record !== "object") return false;
        const id = String(record.id || "");
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .sort((left, right) => {
        const leftTime = recordTimestamp(left) ?? 0;
        const rightTime = recordTimestamp(right) ?? 0;
        return (
          leftTime - rightTime ||
          String(left.id).localeCompare(String(right.id))
        );
      });
  }

  function mondayWeekStart(value) {
    const source = new Date(value);
    if (!Number.isFinite(source.getTime())) return null;
    const date = new Date(
      Date.UTC(
        source.getUTCFullYear(),
        source.getUTCMonth(),
        source.getUTCDate(),
      ),
    );
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return date.getTime();
  }

  function consecutiveWeekEvidence(logs) {
    const weeks = new Map();
    logs.forEach((log) => {
      const eventTime = recordTimestamp(log);
      const weekStart = eventTime == null ? null : mondayWeekStart(eventTime);
      if (weekStart == null) return;
      const existing = weeks.get(weekStart);
      if (existing == null || eventTime < existing)
        weeks.set(weekStart, eventTime);
    });
    const ordered = [...weeks.keys()].sort((left, right) => left - right);
    let longest = 0;
    let current = 0;
    let evidenceAt = null;
    ordered.forEach((weekStart, index) => {
      current =
        index > 0 && weekStart - ordered[index - 1] === WEEK_MS
          ? current + 1
          : 1;
      if (current > longest) {
        longest = current;
        evidenceAt = weeks.get(weekStart);
      }
    });
    return { current: longest, evidenceAt };
  }

  function milestone(records, target) {
    const current = records.length;
    const evidence = current >= target ? records[target - 1] : null;
    return { current, evidenceAt: evidence ? recordTimestamp(evidence) : null };
  }

  function skillValue(profile, key) {
    const value = Number(profile?.benchmarks?.[key]);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function progressText(definition, current) {
    if (definition.category === "rx") {
      return `RX Level ${Math.round(current)}/${definition.target}`;
    }
    if (definition.id === "four-week-fire") {
      return `${Math.round(current)}/${definition.target} consecutive weeks`;
    }
    if (definition.category === "skill") {
      return current >= definition.target
        ? "Skill recorded"
        : "Not recorded yet";
    }
    return `${Math.round(current)}/${definition.target}`;
  }

  function evaluateAchievementProgress(input = {}) {
    const now = timestamp(input.now) ?? Date.now();
    const logs = uniqueRecords(input.logs).filter(
      (record) => (recordTimestamp(record) ?? Infinity) <= now,
    );
    const prAttempts = uniqueRecords(input.prAttempts).filter(
      (record) =>
        record.isPr === true && (recordTimestamp(record) ?? Infinity) <= now,
    );
    const benchmarkPrs = prAttempts.filter((record) =>
      ENGINE_BENCHMARK_IDS.has(record.metricId),
    );
    const recentLogs = logs.filter((record) => {
      const eventTime = recordTimestamp(record);
      return (
        eventTime != null &&
        now - eventTime >= 0 &&
        now - eventTime <= 28 * DAY_MS
      );
    });
    const weekProgress = consecutiveWeekEvidence(logs);
    const profile = input.profile || {};
    const rxLevel = clamp(Number(input.rxLevel) || 0, 0, 100);

    return ACHIEVEMENT_DEFINITIONS.map((definition) => {
      let result;
      switch (definition.id) {
        case "first-session":
        case "training-habit":
          result = milestone(logs, definition.target);
          break;
        case "four-week-fire":
          result = weekProgress;
          break;
        case "consistency-engine":
          result = milestone(recentLogs, definition.target);
          break;
        case "new-standard":
        case "pr-collector":
        case "record-machine":
          result = milestone(prAttempts, definition.target);
          break;
        case "benchmark-breakthrough":
        case "engine-builder":
          result = milestone(benchmarkPrs, definition.target);
          break;
        case "first-bar-muscle-up":
          result = {
            current: skillValue(profile, "barMuscleUp"),
            evidenceAt: null,
          };
          break;
        case "first-ring-muscle-up":
          result = {
            current: skillValue(profile, "ringMuscleUp"),
            evidenceAt: null,
          };
          break;
        case "upside-down":
          result = {
            current: skillValue(profile, "strictHspu"),
            evidenceAt: null,
          };
          break;
        case "handstand-traveller":
          result = {
            current: skillValue(profile, "handstandWalk"),
            evidenceAt: null,
          };
          break;
        default:
          result = { current: rxLevel, evidenceAt: null };
      }
      const current = Math.max(0, Number(result.current) || 0);
      return Object.freeze({
        ...definition,
        current,
        earned: current >= definition.target,
        evidenceAt:
          result.evidenceAt == null
            ? null
            : new Date(result.evidenceAt).toISOString(),
        progress: clamp(current / definition.target, 0, 1),
        progressText: progressText(definition, current),
      });
    });
  }

  function normalizeAchievementState(value) {
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const earned = Object.fromEntries(
      Object.entries(source.earned || {})
        .filter(
          ([id, earnedAt]) =>
            DEFINITION_IDS.has(id) && timestamp(earnedAt) != null,
        )
        .map(([id, earnedAt]) => [
          id,
          new Date(timestamp(earnedAt)).toISOString(),
        ]),
    );
    const acknowledgedIds = [
      ...new Set(
        (Array.isArray(source.acknowledgedIds) ? source.acknowledgedIds : [])
          .map(String)
          .filter((id) => DEFINITION_IDS.has(id)),
      ),
    ];
    const evaluatedAt = timestamp(source.lastEvaluatedAt);
    return {
      version: ACHIEVEMENT_STATE_VERSION,
      earned,
      acknowledgedIds,
      lastEvaluatedAt:
        evaluatedAt == null ? null : new Date(evaluatedAt).toISOString(),
    };
  }

  function reconcileAchievementState(previousState, progress, evaluatedAt) {
    const previous = normalizeAchievementState(previousState);
    const evaluationTime = timestamp(evaluatedAt) ?? Date.now();
    const earned = { ...previous.earned };
    const newlyEarnedIds = [];
    (Array.isArray(progress) ? progress : []).forEach((item) => {
      if (!item?.earned || earned[item.id]) return;
      earned[item.id] =
        item.evidenceAt || new Date(evaluationTime).toISOString();
      newlyEarnedIds.push(item.id);
    });
    return {
      state: {
        ...previous,
        earned,
        lastEvaluatedAt: new Date(evaluationTime).toISOString(),
      },
      newlyEarnedIds,
    };
  }

  const api = Object.freeze({
    ACHIEVEMENT_DEFINITIONS,
    ACHIEVEMENT_STATE_VERSION,
    evaluateAchievementProgress,
    normalizeAchievementState,
    reconcileAchievementState,
  });

  /** @type {any} */ (globalScope).ForgeHourAchievements = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
