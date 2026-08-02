"use strict";

(function mountForgeHourReact() {
  const rootElement = document.querySelector("#root");
  const api = window.ForgeHour;
  const syncApi = window.ForgeHourSync;
  const localStateApi = window.ForgeHourLocalState;
  const ReactRuntime = window.React;
  const ReactDOMRuntime = window.ReactDOM;

  if (!rootElement) return;

  if (!api || !syncApi || !localStateApi || !ReactRuntime || !ReactDOMRuntime) {
    rootElement.innerHTML =
      '<div class="app-shell"><section class="panel"><h1>CrossFit Training Programme</h1><p class="muted-copy">React could not load. Check your connection and reload the app.</p></section></div>';
    return;
  }

  const {
    ATHLETE_LEVELS,
    BAR_MUSCLE_UP_LEVELS,
    DAY_OF_WEEK_OPTIONS,
    DIVISION_LABELS,
    EQUIPMENT_OPTIONS,
    GOAL_LABELS,
    MOVEMENT_LIBRARY,
    PLAN_SCHEMA_VERSION,
    PR_METRICS,
    READINESS_LABELS,
    WEEK_META,
    WEAKNESS_LABELS,
    applyReadinessVariant,
    buildCycleProgressionResult,
    buildDailyRecommendation,
    buildGeneratedProgramme,
    buildRxReadiness,
    buildSession,
    buildTrainingSchedule,
    clamp,
    cloneDefaultProfile,
    coachDateValue,
    addCoachDays,
    createGenerationSeed,
    createId,
    customPlanSegments,
    filterMovementLibrary,
    formatDate,
    formatPrValue,
    formatTimerResult,
    getNextDayForToday,
    getProgramDays,
    inferWorkoutTimer,
    isBetterPr,
    migratePlanState,
    normalizeGeneratorOptions,
    normalizePrValue,
    parseBoxWorkout,
    positiveNumber,
    regeneratePlanFrequency,
    registerServiceWorker,
    splitLines,
    startOfCoachWeek,
    trimNumber,
    selectActivePlan,
    selectActiveWeekSessions,
    timerDisplaySeconds,
    validateGeneratedProgramme,
    validateGeneratedPlansForPersistence,
    validateGeneratedWeek,
    validateGeneratedSession,
    traceGenerationStage,
    weeklyTrainingProgress,
    valueFromPath,
    workoutItemsForSession,
  } = api;

  const { createSupabaseStore, mergeById, mergePrs } = syncApi;
  const { createLocalStateStore } = localStateApi;

  const GUEST_SCORE_OWNER = "guest";
  const BASELINE_UPDATED_AT = "1970-01-01T00:00:00.000Z";
  const SUPABASE_CONFIG = {
    url: "https://wvypnaojkysxrftuqrnu.supabase.co",
    anonKey: "sb_publishable_lUuIsYjeWwY9Wsr15-_Z4Q_VqNGALR4",
  };
  const THEME_COLORS = {
    light: "#10120f",
    dark: "#070907",
  };
  const h = ReactRuntime.createElement;
  const localStateStore = createLocalStateStore(window.localStorage);

  /**
   * @typedef {Object} WorkoutSession
   * @property {string} id
   * @property {number} week
   * @property {string} title
   * @property {string=} focus
   * @property {string[]} warmup
   * @property {string[]} strength
   * @property {Object[]=} trainingBlocks
   * @property {string[]=} wod
   * @property {Object=} workoutDefinition
   * @property {string[]} mobility
   * @property {number} duration
   * @property {string=} intensity
   * @property {"clean"|"snatch"=} olympicFamily
   * @property {string[]=} olympicExposureMovementIds
   * @property {"generated"|"manual"=} origin
   * @property {boolean=} generated
   * @property {boolean=} customized
   * @property {number=} wodSchemaVersion
   * @property {string=} createdAt
   */

  /**
   * @typedef {Object} TrainingPlan
   * @property {string} id
   * @property {string} title
   * @property {"generated"|"custom"} kind
   * @property {Object|null} generatorOptions
   * @property {string|null} generationSeed
   * @property {string} createdAt
   * @property {string} updatedAt
   * @property {WorkoutSession[]} sessions
   */

  /**
   * @typedef {Object} ScoreData
   * @property {any[]} logs
   * @property {Object<string, any>} prs
   * @property {any[]} prAttempts
   * @property {any[]} trainingEvents
   * @property {any[]} readinessChecks
   */

  /**
   * @typedef {Object} AppState
   * @property {number} schemaVersion
   * @property {number} planSchemaVersion
   * @property {any} profile
   * @property {TrainingPlan[]} plans
   * @property {string|null} activePlanId
   * @property {Object<string, any>} athleteStateByOwner
   * @property {Object<string, ScoreData>} scoreDataByOwner
   * @property {string} activeScoreOwner
   * @property {number} selectedWeek
   * @property {string} cycleStartDate
   * @property {string} themePreference
   * @property {any[]=} logs
   * @property {any[]=} prAttempts
   * @property {Object<string, any>=} prs
   */

  /** @returns {AppState} */
  function fallbackState() {
    const guestAthleteState = defaultAthleteState();
    return {
      schemaVersion: 5,
      planSchemaVersion: PLAN_SCHEMA_VERSION,
      ...guestAthleteState,
      athleteStateByOwner: {
        [GUEST_SCORE_OWNER]: guestAthleteState,
      },
      scoreDataByOwner: {
        [GUEST_SCORE_OWNER]: emptyScoreData(),
      },
      activeScoreOwner: GUEST_SCORE_OWNER,
      selectedWeek: 1,
      themePreference: "system",
    };
  }

  /** @returns {AppState} */
  function loadState() {
    const fallback = fallbackState();

    try {
      const parsed = localStateStore.load();
      if (!parsed) return seedState(fallback);
      return seedState({
        ...fallback,
        ...parsed,
        athleteStateByOwner: parsed.athleteStateByOwner || {
          [GUEST_SCORE_OWNER]: parsed,
        },
        activeScoreOwner: GUEST_SCORE_OWNER,
        themePreference: normalizeThemePreference(parsed.themePreference),
      });
    } catch (error) {
      console.warn("Could not read saved state.", error);
      return seedState(fallback);
    }
  }

  /** @param {AppState} state @returns {AppState} */
  function seedState(state) {
    let next = migrateScoreState(state);
    next = migratePlanState(next).state;
    next = migrateAthleteStateBuckets(next);
    next = activateAthleteOwner(next, GUEST_SCORE_OWNER);
    next = seedPrs(next);
    next = withActiveAthleteState(next);

    saveState(next);
    return next;
  }

  /** @param {AppState} state @param {AppState|null=} previous @returns {boolean} */
  function saveState(state, previous = null) {
    try {
      validateGeneratedPlansForPersistence(state.plans);
      state.plans
        .filter((plan) => plan?.kind === "generated")
        .flatMap((plan) => plan.sessions || [])
        .forEach((session) =>
          traceGenerationStage("7. Object saved locally", {
            sessionId: session.id,
            strength: session.strength,
            strengthAndSkillBlocks: session.trainingBlocks,
          }),
        );
      return localStateStore.save(state, previous);
    } catch (error) {
      console.warn("Could not save state.", error);
      return false;
    }
  }

  /** @returns {ScoreData} */
  function emptyScoreData() {
    return {
      logs: [],
      prs: {},
      prAttempts: [],
      trainingEvents: [],
      readinessChecks: [],
    };
  }

  function defaultAthleteState() {
    return {
      profile: cloneDefaultProfile(),
      plans: [],
      activePlanId: null,
      selectedWeek: 1,
      cycleStartDate: startOfCoachWeek(),
      planSchemaVersion: PLAN_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeAthleteState(value) {
    const fallback = defaultAthleteState();
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const profile = {
      ...fallback.profile,
      ...(source.profile || {}),
      maxes: {
        ...fallback.profile.maxes,
        ...((source.profile && source.profile.maxes) || {}),
      },
      benchmarks: {
        ...fallback.profile.benchmarks,
        ...((source.profile && source.profile.benchmarks) || {}),
      },
    };
    const migration = migratePlanState({
      ...source,
      profile,
      plans: Array.isArray(source.plans) ? source.plans : [],
      activePlanId:
        typeof source.activePlanId === "string" ? source.activePlanId : null,
      selectedWeek: clamp(Number(source.selectedWeek) || 1, 1, 8),
      cycleStartDate: coachDateValue(
        source.cycleStartDate || fallback.cycleStartDate,
      ),
      planSchemaVersion:
        Number(source.planSchemaVersion) || PLAN_SCHEMA_VERSION,
    });
    const normalized = migration.state;
    const activePlan = selectActivePlan(normalized);
    const selection = activePlan
      ? resolvePlanTransition(activePlan, normalized.selectedWeek)
      : { selectedWeek: normalized.selectedWeek };
    return {
      profile: normalized.profile,
      plans: normalized.plans,
      activePlanId: normalized.activePlanId,
      selectedWeek: selection.selectedWeek,
      cycleStartDate: normalized.cycleStartDate,
      planSchemaVersion: PLAN_SCHEMA_VERSION,
      updatedAt:
        typeof source.updatedAt === "string"
          ? source.updatedAt
          : fallback.updatedAt,
    };
  }

  function athleteStateFromAppState(
    state,
    updatedAt = new Date().toISOString(),
  ) {
    return {
      profile: state.profile,
      plans: state.plans,
      activePlanId: state.activePlanId,
      selectedWeek: state.selectedWeek,
      cycleStartDate: coachDateValue(
        state.cycleStartDate || startOfCoachWeek(),
      ),
      planSchemaVersion: PLAN_SCHEMA_VERSION,
      updatedAt,
    };
  }

  function athleteStateChanged(previous, next) {
    return (
      previous.profile !== next.profile ||
      previous.plans !== next.plans ||
      previous.activePlanId !== next.activePlanId ||
      previous.selectedWeek !== next.selectedWeek ||
      previous.cycleStartDate !== next.cycleStartDate ||
      previous.planSchemaVersion !== next.planSchemaVersion ||
      previous.updatedAt !== next.updatedAt ||
      previous.activeScoreOwner !== next.activeScoreOwner
    );
  }

  function withActiveAthleteState(state, updatedAt) {
    const ownerId = state.activeScoreOwner || GUEST_SCORE_OWNER;
    const athleteState = athleteStateFromAppState(
      state,
      updatedAt || state.updatedAt || new Date().toISOString(),
    );
    return {
      ...state,
      schemaVersion: Math.max(Number(state.schemaVersion) || 0, 5),
      athleteStateByOwner: {
        ...(state.athleteStateByOwner || {}),
        [ownerId]: athleteState,
      },
    };
  }

  function activateAthleteOwner(state, ownerId, providedState = null) {
    const resolvedOwner = ownerId || GUEST_SCORE_OWNER;
    const stashed = withActiveAthleteState(state);
    const athleteState = normalizeAthleteState(
      providedState ||
        stashed.athleteStateByOwner?.[resolvedOwner] ||
        defaultAthleteState(),
    );
    return {
      ...stashed,
      ...athleteState,
      activeScoreOwner: resolvedOwner,
      athleteStateByOwner: {
        ...stashed.athleteStateByOwner,
        [resolvedOwner]: athleteState,
      },
      scoreDataByOwner: {
        ...stashed.scoreDataByOwner,
        [resolvedOwner]: selectScoreData(stashed, resolvedOwner),
      },
    };
  }

  function migrateAthleteStateBuckets(state) {
    const sourceBuckets =
      state.athleteStateByOwner &&
      typeof state.athleteStateByOwner === "object" &&
      !Array.isArray(state.athleteStateByOwner)
        ? state.athleteStateByOwner
        : {};
    const athleteStateByOwner = Object.fromEntries(
      Object.entries(sourceBuckets).map(([ownerId, athleteState]) => [
        ownerId,
        normalizeAthleteState(athleteState),
      ]),
    );
    if (!athleteStateByOwner[GUEST_SCORE_OWNER]) {
      athleteStateByOwner[GUEST_SCORE_OWNER] = normalizeAthleteState(state);
    }
    return {
      ...state,
      schemaVersion: Math.max(Number(state.schemaVersion) || 0, 5),
      athleteStateByOwner,
    };
  }

  /** @param {unknown} value @returns {ScoreData} */
  function normalizeScoreData(value) {
    /** @type {any} */
    const source =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const logs = Array.isArray(source.logs)
      ? source.logs.filter(
          (record) =>
            record && typeof record === "object" && String(record.id || ""),
        )
      : [];
    const prAttempts = Array.isArray(source.prAttempts)
      ? source.prAttempts.filter(
          (record) =>
            record && typeof record === "object" && String(record.id || ""),
        )
      : [];
    const trainingEvents = Array.isArray(source.trainingEvents)
      ? source.trainingEvents.filter(
          (record) =>
            record && typeof record === "object" && String(record.id || ""),
        )
      : [];
    const readinessChecks = Array.isArray(source.readinessChecks)
      ? source.readinessChecks.filter(
          (record) =>
            record && typeof record === "object" && String(record.id || ""),
        )
      : [];
    const prs =
      source.prs && typeof source.prs === "object" && !Array.isArray(source.prs)
        ? Object.fromEntries(
            Object.entries(source.prs).filter(
              ([metricId, record]) =>
                metricId && record && typeof record === "object",
            ),
          )
        : {};
    return { logs, prs, prAttempts, trainingEvents, readinessChecks };
  }

  /** @param {AppState|any} state @returns {AppState} */
  function migrateScoreState(state) {
    const sourceBuckets =
      state.scoreDataByOwner &&
      typeof state.scoreDataByOwner === "object" &&
      !Array.isArray(state.scoreDataByOwner)
        ? state.scoreDataByOwner
        : {};
    const scoreDataByOwner = Object.fromEntries(
      Object.entries(sourceBuckets).map(([ownerId, scores]) => [
        ownerId,
        normalizeScoreData(scores),
      ]),
    );
    const legacyScores = normalizeScoreData({
      logs: state.logs,
      prs: state.prs,
      prAttempts: state.prAttempts,
      trainingEvents: state.trainingEvents,
      readinessChecks: state.readinessChecks,
    });
    const guestScores = normalizeScoreData(scoreDataByOwner[GUEST_SCORE_OWNER]);
    scoreDataByOwner[GUEST_SCORE_OWNER] = {
      logs: mergeById(legacyScores.logs, guestScores.logs),
      prs: mergePrs(legacyScores.prs, guestScores.prs),
      prAttempts: mergeById(legacyScores.prAttempts, guestScores.prAttempts),
      trainingEvents: mergeById(
        legacyScores.trainingEvents,
        guestScores.trainingEvents,
      ),
      readinessChecks: mergeById(
        legacyScores.readinessChecks,
        guestScores.readinessChecks,
      ),
    };

    const activeScoreOwner =
      typeof state.activeScoreOwner === "string" && state.activeScoreOwner
        ? state.activeScoreOwner
        : GUEST_SCORE_OWNER;
    if (!scoreDataByOwner[activeScoreOwner]) {
      scoreDataByOwner[activeScoreOwner] = emptyScoreData();
    }

    const next = {
      ...state,
      schemaVersion: Math.max(Number(state.schemaVersion) || 0, 5),
      scoreDataByOwner,
      activeScoreOwner,
    };
    delete next.logs;
    delete next.prs;
    delete next.prAttempts;
    delete next.trainingEvents;
    delete next.readinessChecks;
    return next;
  }

  /** @param {AppState} state @param {string=} ownerId @returns {ScoreData} */
  function selectScoreData(state, ownerId = state.activeScoreOwner) {
    return normalizeScoreData(
      state.scoreDataByOwner?.[ownerId || GUEST_SCORE_OWNER],
    );
  }

  /**
   * @param {AppState} state
   * @param {(scores: ScoreData) => ScoreData} updater
   * @param {string=} ownerId
   * @returns {AppState}
   */
  function updateScoreData(state, updater, ownerId = state.activeScoreOwner) {
    const resolvedOwner = ownerId || GUEST_SCORE_OWNER;
    return {
      ...state,
      scoreDataByOwner: {
        ...state.scoreDataByOwner,
        [resolvedOwner]: normalizeScoreData(
          updater(selectScoreData(state, resolvedOwner)),
        ),
      },
    };
  }

  /** @param {ScoreData} scores @param {any} profile @returns {ScoreData} */
  function seedScorePrs(scores, profile) {
    const prs = { ...(scores.prs || {}) };
    let changed = false;

    PR_METRICS.forEach((metric) => {
      if (prs[metric.id]) {
        if (prs[metric.id].date === "Baseline" && !prs[metric.id].updatedAt) {
          prs[metric.id] = {
            ...prs[metric.id],
            updatedAt: BASELINE_UPDATED_AT,
          };
          changed = true;
        }
        return;
      }
      const value = normalizePrValue(
        valueFromPath(profile, metric.seed),
        metric,
      );
      prs[metric.id] = {
        metricId: metric.id,
        value,
        display: formatPrValue(value, metric),
        date: "Baseline",
        notes: "Seeded from initial research numbers.",
        updatedAt: BASELINE_UPDATED_AT,
      };
      changed = true;
    });

    return changed ? { ...scores, prs } : scores;
  }

  function seedPrs(state, ownerId = state.activeScoreOwner) {
    return updateScoreData(
      state,
      (scores) => seedScorePrs(scores, state.profile),
      ownerId,
    );
  }

  function syncBaselinePrsFromProfile(state) {
    const scores = selectScoreData(state);
    const prs = { ...scores.prs };
    const updatedAt = new Date().toISOString();
    let changed = false;

    PR_METRICS.forEach((metric) => {
      const current = prs[metric.id];
      const hasAttempts = scores.prAttempts.some(
        (attempt) => attempt.metricId === metric.id,
      );
      if (!current || current.date !== "Baseline" || hasAttempts) return;

      const value = normalizePrValue(
        valueFromPath(state.profile, metric.seed),
        metric,
      );
      prs[metric.id] = {
        ...current,
        value,
        display: formatPrValue(value, metric),
        updatedAt,
      };
      changed = true;
    });

    return changed
      ? updateScoreData(state, (current) => ({ ...current, prs }))
      : state;
  }

  function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeThemePreference(value) {
    return ["system", "light", "dark"].includes(value) ? value : "system";
  }

  function getSystemTheme() {
    if (typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function resolveTheme(preference, systemTheme) {
    return preference === "system" ? systemTheme : preference;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const themeColor = THEME_COLORS[theme] || THEME_COLORS.light;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColor);
  }

  function createRemoteStore() {
    const externalConfig = window.ForgeHourSupabaseConfig || {};
    const config = {
      url: externalConfig.url || SUPABASE_CONFIG.url,
      anonKey: externalConfig.anonKey || SUPABASE_CONFIG.anonKey,
    };
    const hasConfig = Boolean(config.url && config.anonKey);
    if (
      !hasConfig ||
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      return null;
    }
    return createSupabaseStore(
      window.supabase.createClient(config.url, config.anonKey),
    );
  }

  function remoteSetupMessage() {
    const externalConfig = window.ForgeHourSupabaseConfig || {};
    const hasConfig = Boolean(
      (externalConfig.url || SUPABASE_CONFIG.url) &&
      (externalConfig.anonKey || SUPABASE_CONFIG.anonKey),
    );
    if (!hasConfig) return "Add Supabase config to enable database sync.";
    return "Supabase SDK could not load. Refresh the page or check whether your browser is blocking the Supabase script.";
  }

  function authRedirectUrl() {
    const redirect = new URL(window.location.href);
    redirect.search = "";
    redirect.hash = "";
    return redirect.toString();
  }

  function weekOptions() {
    return WEEK_META.map((week) =>
      h(
        "option",
        { key: week.week, value: String(week.week) },
        `Week ${week.week}`,
      ),
    );
  }

  function viewClass(viewId, activeView) {
    return `view${viewId === activeView ? " is-active" : ""}`;
  }

  function defaultSessionSelection(state, week = state.selectedWeek) {
    const selectedWeek = clamp(Number(week) || 1, 1, 8);
    const activePlan = selectActivePlan(state);
    const activeSessions = selectActiveWeekSessions(state, selectedWeek);
    return {
      dayId:
        activeSessions[0]?.id || (activePlan ? "" : getNextDayForToday().id),
    };
  }

  function resolvePlanTransition(plan, preferredWeek) {
    const currentWeek = clamp(Number(preferredWeek) || 1, 1, 8);
    const session =
      plan?.sessions.find((item) => Number(item.week) === currentWeek) ||
      plan?.sessions[0];
    return {
      selectedWeek: clamp(Number(session?.week) || currentWeek, 1, 8),
      dayId: session?.id || (plan ? "" : getNextDayForToday().id),
    };
  }

  function indexRemoteScores(scores, ownerId) {
    const normalized = normalizeScoreData(scores);
    return {
      ownerId,
      hydrated: true,
      logs: normalized.logs.map((log) => ({
        id: log.id,
        timerResult: log.timerResult || null,
        competitionProof: log.competitionProof || null,
      })),
      prAttempts: normalized.prAttempts.map((attempt) => ({ id: attempt.id })),
      trainingEvents: normalized.trainingEvents.map((event) => ({
        id: event.id,
        updatedAt: event.updatedAt || event.createdAt || BASELINE_UPDATED_AT,
      })),
      readinessChecks: normalized.readinessChecks.map((checkin) => ({
        id: checkin.id,
        createdAt: checkin.createdAt || BASELINE_UPDATED_AT,
      })),
      prs: Object.fromEntries(
        Object.entries(normalized.prs).map(([metricId, record]) => [
          metricId,
          {
            value: record.value,
            updatedAt: record.updatedAt || BASELINE_UPDATED_AT,
          },
        ]),
      ),
    };
  }

  function prMetric(metricId) {
    return PR_METRICS.find((metric) => metric.id === metricId) || null;
  }

  function isStrictlyBetterRecord(candidate, current, metricId) {
    if (!candidate) return false;
    const metric = prMetric(metricId);
    const candidateValue = Number(candidate.value);
    if (!metric || !Number.isFinite(candidateValue) || candidateValue < 0) {
      return false;
    }
    if (!current) return true;
    const currentValue = Number(current.value);
    if (candidateValue === currentValue) return false;
    if (!Number.isFinite(currentValue) || currentValue < 0) return true;
    if (candidateValue === 0) return false;
    if (currentValue === 0) return true;
    return isBetterPr(candidateValue, currentValue, metric);
  }

  function mergeBestPrs(leftPrs = {}, rightPrs = {}, preferRightOnTie = false) {
    const merged = { ...leftPrs };
    Object.entries(rightPrs).forEach(([metricId, candidate]) => {
      const current = merged[metricId];
      if (isStrictlyBetterRecord(candidate, current, metricId)) {
        merged[metricId] = candidate;
        return;
      }
      if (current && Number(candidate?.value) === Number(current.value)) {
        const candidateUpdatedAt = Date.parse(
          String(candidate?.updatedAt || BASELINE_UPDATED_AT),
        );
        const currentUpdatedAt = Date.parse(
          String(current.updatedAt || BASELINE_UPDATED_AT),
        );
        if (
          candidateUpdatedAt > currentUpdatedAt ||
          (candidateUpdatedAt === currentUpdatedAt && preferRightOnTie)
        ) {
          merged[metricId] = candidate;
        }
      }
    });
    return merged;
  }

  function mergeAccountScores(localScores, remoteScores) {
    return {
      logs: mergeById(localScores.logs, remoteScores.logs),
      prAttempts: mergeById(localScores.prAttempts, remoteScores.prAttempts),
      trainingEvents: mergeById(
        localScores.trainingEvents,
        remoteScores.trainingEvents,
      ),
      readinessChecks: mergeById(
        localScores.readinessChecks,
        remoteScores.readinessChecks,
      ),
      prs: mergeBestPrs(localScores.prs, remoteScores.prs, true),
    };
  }

  function App() {
    const [appState, setAppState] = ReactRuntime.useState(loadState);
    const appStateRef = ReactRuntime.useRef(appState);
    appStateRef.current = appState;
    const [activeView, setActiveView] = ReactRuntime.useState("dashboardView");
    const [visitedViews, setVisitedViews] = ReactRuntime.useState(
      () => new Set(["dashboardView"]),
    );
    const [toast, setToast] = ReactRuntime.useState("");
    const [systemTheme, setSystemTheme] = ReactRuntime.useState(getSystemTheme);
    const [remoteStore] = ReactRuntime.useState(createRemoteStore);
    const [remoteUser, setRemoteUser] = ReactRuntime.useState(null);
    const [localSaveError, setLocalSaveError] = ReactRuntime.useState("");
    const [syncStatus, setSyncStatus] = ReactRuntime.useState(() => ({
      state: remoteStore ? "signed-out" : "not-configured",
      message: remoteStore
        ? "Sign in to sync your private athlete account."
        : remoteSetupMessage(),
    }));
    const [pendingTimerResult, setPendingTimerResult] =
      ReactRuntime.useState(null);
    const [logSelection, setLogSelection] = ReactRuntime.useState(
      /** @type {any} */ (defaultSessionSelection(appState)),
    );
    const toastTimer = ReactRuntime.useRef(null);
    const authenticatedOwnerRef = ReactRuntime.useRef(null);
    const loadingOwnerRef = ReactRuntime.useRef(null);
    const loadedOwnerRef = ReactRuntime.useRef(null);
    const hydratedAthleteOwnerRef = ReactRuntime.useRef(null);
    const skipAthleteSaveRef = ReactRuntime.useRef(null);
    const athleteSaveTimerRef = ReactRuntime.useRef(null);
    const authEpochRef = ReactRuntime.useRef(0);
    const themePreference = normalizeThemePreference(appState.themePreference);
    const activeTheme = resolveTheme(themePreference, systemTheme);
    const scoreData = selectScoreData(appState);
    const viewState = { ...appState, ...scoreData };

    const updateAppState = ReactRuntime.useCallback((updater) => {
      const current = appStateRef.current;
      const candidate =
        typeof updater === "function" ? updater(current) : updater;
      const next = athleteStateChanged(current, candidate)
        ? withActiveAthleteState(candidate)
        : candidate;
      try {
        validateGeneratedPlansForPersistence(next.plans);
      } catch (error) {
        console.error(
          "State update rejected invalid generated programme.",
          error,
        );
        window.setTimeout(
          () =>
            setLocalSaveError(
              "Invalid generated programme was rejected and not saved or shown.",
            ),
          0,
        );
        return;
      }
      appStateRef.current = next;
      const saved = saveState(next, current);
      setAppState(next);
      window.setTimeout(
        () =>
          setLocalSaveError(
            saved
              ? ""
              : "Changes could not be saved on this device. Free storage and retry.",
          ),
        0,
      );
    }, []);

    const isCurrentAuth = ReactRuntime.useCallback((ownerId, authEpoch) => {
      return (
        authenticatedOwnerRef.current === ownerId &&
        authEpochRef.current === authEpoch
      );
    }, []);

    const mergeRemoteState = ReactRuntime.useCallback(
      (remoteData, ownerId, authEpoch, transformScores = null) => {
        if (!isCurrentAuth(ownerId, authEpoch)) return null;
        const current = appStateRef.current;
        let mergedScores = mergeAccountScores(
          selectScoreData(current, ownerId),
          remoteData,
        );
        if (typeof transformScores === "function") {
          mergedScores = transformScores(mergedScores, current);
          mergedScores = mergeAccountScores(mergedScores, remoteData);
        }
        mergedScores = seedScorePrs(mergedScores, current.profile);
        updateAppState(
          updateScoreData(
            { ...current, activeScoreOwner: ownerId },
            () => mergedScores,
            ownerId,
          ),
        );
        const nextRemoteIndex = indexRemoteScores(remoteData, ownerId);
        return { scores: mergedScores, remoteIndex: nextRemoteIndex };
      },
      [isCurrentAuth, updateAppState],
    );

    const hydrateRemoteScores = ReactRuntime.useCallback(
      async (ownerId, authEpoch, transformScores = null) => {
        if (!remoteStore || !isCurrentAuth(ownerId, authEpoch)) return null;
        const remoteData = await remoteStore.loadUserData();
        if (!isCurrentAuth(ownerId, authEpoch)) return null;
        return mergeRemoteState(
          remoteData,
          ownerId,
          authEpoch,
          transformScores,
        );
      },
      [isCurrentAuth, mergeRemoteState, remoteStore],
    );

    const loadRemoteScores = ReactRuntime.useCallback(
      async (session, authEpoch = authEpochRef.current) => {
        if (!remoteStore || !session || !session.user) return;
        const ownerId = String(session.user.id || "");
        if (!ownerId || !isCurrentAuth(ownerId, authEpoch)) return;
        const authToken = { ownerId, authEpoch };
        if (
          loadingOwnerRef.current?.ownerId === ownerId &&
          loadingOwnerRef.current?.authEpoch === authEpoch
        ) {
          return;
        }
        if (
          loadedOwnerRef.current?.ownerId === ownerId &&
          loadedOwnerRef.current?.authEpoch === authEpoch
        ) {
          setRemoteUser(session.user);
          return;
        }
        loadingOwnerRef.current = authToken;
        hydratedAthleteOwnerRef.current = null;
        setRemoteUser(session.user);
        updateAppState((current) => activateAthleteOwner(current, ownerId));
        setSyncStatus({
          state: "loading",
          message: "Loading your private athlete account...",
        });
        try {
          let athleteState = await remoteStore.loadAthleteState(ownerId);
          if (!isCurrentAuth(ownerId, authEpoch)) return;
          if (!athleteState) {
            athleteState = await remoteStore.saveAthleteState(
              defaultAthleteState(),
              ownerId,
            );
          }
          if (!isCurrentAuth(ownerId, authEpoch)) return;
          skipAthleteSaveRef.current = authToken;
          hydratedAthleteOwnerRef.current = ownerId;
          updateAppState((current) =>
            seedPrs(
              activateAthleteOwner(current, ownerId, athleteState),
              ownerId,
            ),
          );
          const hydrated = await hydrateRemoteScores(ownerId, authEpoch);
          if (!hydrated || !isCurrentAuth(ownerId, authEpoch)) return;
          loadedOwnerRef.current = authToken;
          setSyncStatus({
            state: "signed-in",
            message: "Profile, programmes, logs, and PRs are syncing.",
          });
        } catch (error) {
          console.warn("Could not load Supabase account.", error);
          if (!isCurrentAuth(ownerId, authEpoch)) return;
          setSyncStatus({
            state: "error",
            message: "Could not load your private athlete account.",
          });
        } finally {
          if (
            loadingOwnerRef.current?.ownerId === ownerId &&
            loadingOwnerRef.current?.authEpoch === authEpoch
          ) {
            loadingOwnerRef.current = null;
          }
        }
      },
      [hydrateRemoteScores, isCurrentAuth, remoteStore, updateAppState],
    );

    const transitionToSignedOut = ReactRuntime.useCallback(
      (message = "Sign in to sync your private athlete account.") => {
        authEpochRef.current += 1;
        authenticatedOwnerRef.current = null;
        loadingOwnerRef.current = null;
        loadedOwnerRef.current = null;
        hydratedAthleteOwnerRef.current = null;
        skipAthleteSaveRef.current = null;
        window.clearTimeout(athleteSaveTimerRef.current);
        setRemoteUser(null);
        updateAppState((current) =>
          activateAthleteOwner(current, GUEST_SCORE_OWNER),
        );
        setSyncStatus({ state: "signed-out", message });
      },
      [updateAppState],
    );

    const notify = ReactRuntime.useCallback((message) => {
      setToast(message);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(""), 2400);
    }, []);

    const activateView = ReactRuntime.useCallback((viewId) => {
      setVisitedViews((current) => {
        if (current.has(viewId)) return current;
        return new Set([...current, viewId]);
      });
      setActiveView(viewId);
      window.requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: "smooth" }),
      );
    }, []);

    const setSelectedWeek = ReactRuntime.useCallback(
      (week) => {
        const selectedWeek = clamp(Number(week) || 1, 1, 8);
        updateAppState((current) => ({ ...current, selectedWeek }));
      },
      [updateAppState],
    );

    const jumpToLog = ReactRuntime.useCallback(
      (dayId, weekNumber, context = {}) => {
        const week = clamp(Number(weekNumber) || appState.selectedWeek, 1, 8);
        setLogSelection({
          dayId,
          workoutSource: context.workoutSource || "app",
          ...context,
        });
        updateAppState((current) => ({ ...current, selectedWeek: week }));
        activateView("logView");
      },
      [activateView, appState.selectedWeek, updateAppState],
    );

    const finishTimerToLog = ReactRuntime.useCallback(
      (session, timerResult, competitionProof = null) => {
        const week = clamp(Number(session.week) || appState.selectedWeek, 1, 8);
        const dayId = session.logDayId || session.id;
        setPendingTimerResult({
          ...timerResult,
          competitionProof,
          sessionSnapshot: session,
          dayId,
          week,
        });
        setLogSelection({ dayId });
        updateAppState((current) => ({ ...current, selectedWeek: week }));
        activateView("logView");
        notify("Timer result ready to save.");
      },
      [activateView, appState.selectedWeek, notify, updateAppState],
    );

    ReactRuntime.useEffect(() => {
      setLogSelection((current) => {
        const activePlan = selectActivePlan(appState);
        const sessions = selectActiveWeekSessions(
          appState,
          appState.selectedWeek,
        );
        const validIds = new Set(
          sessions.length
            ? sessions.map((session) => session.id)
            : activePlan
              ? [""]
              : getProgramDays().map((day) => day.id),
        );
        return validIds.has(current.dayId)
          ? current
          : defaultSessionSelection(appState);
      });
    }, [appState.activePlanId, appState.selectedWeek, appState.plans]);

    ReactRuntime.useEffect(() => {
      registerServiceWorker();
      return () => window.clearTimeout(toastTimer.current);
    }, []);

    ReactRuntime.useEffect(() => {
      if (!remoteStore) return undefined;
      let isMounted = true;
      let authEventSeen = false;

      const applySession = (session) => {
        if (!isMounted) return;
        if (!session || !session.user) {
          transitionToSignedOut();
          return;
        }

        const ownerId = String(session.user.id || "");
        if (!ownerId) {
          transitionToSignedOut();
          return;
        }
        if (authenticatedOwnerRef.current !== ownerId) {
          authEpochRef.current += 1;
          authenticatedOwnerRef.current = ownerId;
          loadingOwnerRef.current = null;
          loadedOwnerRef.current = null;
          skipAthleteSaveRef.current = null;
        }
        setRemoteUser(session.user);
        loadRemoteScores(session, authEpochRef.current);
      };

      const unsubscribe = remoteStore.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        authEventSeen = true;
        applySession(session);
      });

      remoteStore
        .getSession()
        .then((session) => {
          if (!isMounted || authEventSeen) return;
          applySession(session);
        })
        .catch((error) => {
          console.warn("Could not read Supabase session.", error);
          if (isMounted && !authEventSeen)
            setSyncStatus({
              state: "error",
              message: "Could not read Supabase session.",
            });
        });

      return () => {
        isMounted = false;
        unsubscribe();
      };
    }, [loadRemoteScores, remoteStore, transitionToSignedOut]);

    ReactRuntime.useEffect(() => {
      window.clearTimeout(athleteSaveTimerRef.current);
      const ownerId = authenticatedOwnerRef.current;
      const authEpoch = authEpochRef.current;
      if (
        !remoteStore ||
        !ownerId ||
        hydratedAthleteOwnerRef.current !== ownerId ||
        appState.activeScoreOwner !== ownerId ||
        !isCurrentAuth(ownerId, authEpoch)
      ) {
        return undefined;
      }
      if (
        skipAthleteSaveRef.current?.ownerId === ownerId &&
        skipAthleteSaveRef.current?.authEpoch === authEpoch
      ) {
        skipAthleteSaveRef.current = null;
        return undefined;
      }

      const athleteState = athleteStateFromAppState(appState);
      setSyncStatus({
        state: "signed-in",
        message: "Saving profile and programme changes...",
      });
      athleteSaveTimerRef.current = window.setTimeout(async () => {
        try {
          const saved = await remoteStore.saveAthleteState(
            athleteState,
            ownerId,
          );
          if (!isCurrentAuth(ownerId, authEpoch)) return;
          updateAppState((current) => ({
            ...current,
            updatedAt: saved.updatedAt,
          }));
          setSyncStatus({
            state: "signed-in",
            message: "Profile and programme changes synced.",
          });
        } catch (error) {
          console.warn("Could not save athlete state.", error);
          if (!isCurrentAuth(ownerId, authEpoch)) return;
          setSyncStatus({
            state: "error",
            message:
              "Profile or programme changes are saved locally and need a sync retry.",
          });
        }
      }, 750);

      return () => window.clearTimeout(athleteSaveTimerRef.current);
    }, [
      appState.activePlanId,
      appState.activeScoreOwner,
      appState.plans,
      appState.profile,
      appState.selectedWeek,
      appState.cycleStartDate,
      isCurrentAuth,
      remoteStore,
      updateAppState,
    ]);

    ReactRuntime.useEffect(() => {
      if (typeof window.matchMedia !== "function") return undefined;
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (event) =>
        setSystemTheme(event.matches ? "dark" : "light");

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }

      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }, []);

    ReactRuntime.useLayoutEffect(() => {
      applyTheme(activeTheme);
    }, [activeTheme]);

    /**
     * @param {{sessions: WorkoutSession[], options: any, generationSeed: string, replaceActive: boolean}} payload
     */
    function handleGenerateProgramme({
      sessions,
      options,
      generationSeed,
      replaceActive,
    }) {
      const currentActivePlan = selectActivePlan(appState);
      const normalizedOptions = normalizeGeneratorOptions(options);
      const previousOptions = currentActivePlan?.generatorOptions
        ? normalizeGeneratorOptions(currentActivePlan.generatorOptions)
        : null;
      const frequencyChanged = Boolean(
        replaceActive &&
        currentActivePlan?.kind === "generated" &&
        previousOptions?.programDaysPerWeek !==
          normalizedOptions.programDaysPerWeek,
      );
      if (
        frequencyChanged &&
        !window.confirm(
          "Changing your weekly frequency will regenerate future workouts. Completed workouts will remain unchanged.",
        )
      ) {
        return;
      }
      if (
        replaceActive &&
        currentActivePlan?.kind === "generated" &&
        currentActivePlan.sessions.some((session) => session.customized) &&
        !window.confirm(
          `Regenerate "${currentActivePlan.title}" and replace customized sessions?`,
        )
      ) {
        return;
      }

      const now = new Date().toISOString();
      const normalizedSessions = sessions.map((session) => ({
        ...session,
        origin: "generated",
        customized: false,
        generationSeed,
      }));
      normalizedSessions.forEach(validateGeneratedSession);
      validateGeneratedProgramme(normalizedSessions, normalizedOptions);
      const planId =
        replaceActive && currentActivePlan?.kind === "generated"
          ? currentActivePlan.id
          : createId();
      const nextPlan = frequencyChanged
        ? {
            ...regeneratePlanFrequency({
              plan: currentActivePlan,
              options: normalizedOptions,
              profile: appState.profile,
              selectedWeek: appState.selectedWeek,
              logs: selectScoreData(appStateRef.current).logs || [],
              regeneratedSessions: normalizedSessions,
            }),
            title: `${GOAL_LABELS[normalizedOptions.primaryGoal] || "Generated"} programme`,
            generationSeed,
            updatedAt: now,
          }
        : {
            id: planId,
            title: `${GOAL_LABELS[normalizedOptions.primaryGoal] || "Generated"} programme`,
            kind: "generated",
            generatorOptions: normalizedOptions,
            generationSeed,
            createdAt:
              planId === currentActivePlan?.id
                ? currentActivePlan.createdAt
                : now,
            updatedAt: now,
            sessions: normalizedSessions,
          };

      updateAppState((current) => ({
        ...current,
        plans:
          planId === current.activePlanId
            ? current.plans.map((plan) =>
                plan.id === planId ? nextPlan : plan,
              )
            : [nextPlan, ...current.plans],
        activePlanId: planId,
        selectedWeek: frequencyChanged ? current.selectedWeek : 1,
      }));
      const selectionWeek = frequencyChanged ? appState.selectedWeek : 1;
      const nextSelectedSession = nextPlan.sessions.find(
        (session) => Number(session.week) === selectionWeek,
      );
      setLogSelection({
        dayId: nextSelectedSession?.id || getNextDayForToday().id,
      });
      setPendingTimerResult(null);
      notify(
        frequencyChanged
          ? `Updated to ${normalizedOptions.programDaysPerWeek} app sessions per week. Completed workouts were preserved.`
          : planId === currentActivePlan?.id
            ? `Regenerated ${sessions.length} sessions.`
            : `Generated ${sessions.length} sessions.`,
      );
    }

    /** @param {WorkoutSession} session @param {string|null} editingSessionId */
    function handleSaveCustomSession(session, editingSessionId = null) {
      const activePlan = selectActivePlan(appState);
      const now = new Date().toISOString();

      if (activePlan && editingSessionId) {
        const current = appStateRef.current;
        const storedPlan = current.plans.find(
          (plan) => plan.id === activePlan.id,
        );
        if (!storedPlan) return;
        const updatedPlan = {
          ...storedPlan,
          updatedAt: now,
          sessions: storedPlan.sessions.map((existing) => {
            if (existing.id !== editingSessionId) return existing;
            const updatedSession = {
              ...existing,
              ...session,
              id: existing.id,
              createdAt: existing.createdAt,
              customized:
                existing.origin === "generated" || existing.generated
                  ? true
                  : existing.customized,
            };
            delete updatedSession.workoutDefinition;
            delete updatedSession.wodSchemaVersion;
            return updatedSession;
          }),
        };
        const selection = resolvePlanTransition(
          updatedPlan,
          current.selectedWeek,
        );
        updateAppState({
          ...current,
          plans: current.plans.map((plan) =>
            plan.id === updatedPlan.id ? updatedPlan : plan,
          ),
          selectedWeek: selection.selectedWeek,
        });
        setLogSelection({ dayId: selection.dayId });
        notify("Training session updated.");
        return;
      }

      const nextSession = {
        ...session,
        origin: "manual",
        customized: true,
      };
      if (activePlan) {
        const selectedWeek = clamp(Number(nextSession.week) || 1, 1, 8);
        updateAppState((current) => ({
          ...current,
          plans: current.plans.map((plan) =>
            plan.id === activePlan.id
              ? {
                  ...plan,
                  updatedAt: now,
                  sessions: [nextSession, ...plan.sessions],
                }
              : plan,
          ),
          selectedWeek,
        }));
        setLogSelection({ dayId: nextSession.id });
      } else {
        const plan = {
          id: createId(),
          title: "My custom programme",
          kind: "custom",
          generatorOptions: null,
          generationSeed: null,
          createdAt: now,
          updatedAt: now,
          sessions: [nextSession],
        };
        updateAppState((current) => ({
          ...current,
          plans: [plan, ...current.plans],
          activePlanId: plan.id,
          selectedWeek: clamp(Number(nextSession.week) || 1, 1, 8),
        }));
        setLogSelection({ dayId: nextSession.id });
      }
      notify("Training session saved.");
    }

    /** @param {string} planId */
    function handleSelectPlan(planId) {
      const plan = appState.plans.find((item) => item.id === planId);
      if (!plan) return;
      const selection = resolvePlanTransition(plan, appState.selectedWeek);
      updateAppState((current) => ({
        ...current,
        activePlanId: plan.id,
        selectedWeek: selection.selectedWeek,
      }));
      setLogSelection({ dayId: selection.dayId });
      setPendingTimerResult(null);
    }

    /** @param {string} planId @param {unknown} title */
    function handleRenamePlan(planId, title) {
      const normalizedTitle = String(title || "").trim();
      if (!normalizedTitle) {
        notify("Add a name for the custom plan.");
        return;
      }
      updateAppState((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                title: normalizedTitle,
                updatedAt: new Date().toISOString(),
              }
            : plan,
        ),
      }));
      notify("Custom plan updated.");
    }

    /** @param {string} planId */
    function handleDeletePlan(planId) {
      const plan = appState.plans.find((item) => item.id === planId);
      if (!plan || !window.confirm(`Delete custom plan "${plan.title}"?`))
        return;
      const deletedSessionIds = new Set(
        plan.sessions.map((session) => session.id),
      );
      const remainingPlans = appState.plans.filter(
        (item) => item.id !== planId,
      );
      const deletingActivePlan = appState.activePlanId === planId;
      const nextPlan = deletingActivePlan ? remainingPlans[0] || null : null;
      const selection = resolvePlanTransition(nextPlan, appState.selectedWeek);
      updateAppState((current) => ({
        ...current,
        plans: current.plans.filter((item) => item.id !== planId),
        activePlanId:
          current.activePlanId === planId
            ? nextPlan?.id || null
            : current.activePlanId,
        selectedWeek:
          current.activePlanId === planId
            ? selection.selectedWeek
            : current.selectedWeek,
      }));
      if (deletingActivePlan) setLogSelection({ dayId: selection.dayId });
      if (
        pendingTimerResult &&
        deletedSessionIds.has(pendingTimerResult.dayId)
      ) {
        setPendingTimerResult(null);
      }
      activateView("calendarView");
      notify("Custom plan deleted.");
    }

    /** @param {string} sessionId */
    function handleDeleteSession(sessionId) {
      const activePlan = selectActivePlan(appState);
      const session = activePlan?.sessions.find(
        (item) => item.id === sessionId,
      );
      if (
        !activePlan ||
        !session ||
        !window.confirm(`Delete "${session.title}"?`)
      )
        return;
      const current = appStateRef.current;
      const storedPlan = current.plans.find(
        (plan) => plan.id === activePlan.id,
      );
      if (!storedPlan) return;
      const updatedPlan = {
        ...storedPlan,
        updatedAt: new Date().toISOString(),
        sessions: storedPlan.sessions.filter((item) => item.id !== sessionId),
      };
      const selection = resolvePlanTransition(
        updatedPlan,
        current.selectedWeek,
      );
      updateAppState({
        ...current,
        plans: current.plans.map((plan) =>
          plan.id === updatedPlan.id ? updatedPlan : plan,
        ),
        selectedWeek: selection.selectedWeek,
      });
      setLogSelection({ dayId: selection.dayId });
      if (pendingTimerResult?.dayId === sessionId) setPendingTimerResult(null);
      notify("Custom session deleted.");
    }

    function coachSyncContext() {
      const localOwnerId = appStateRef.current.activeScoreOwner;
      const ownerId = remoteUser ? String(remoteUser.id || "") : "";
      const authEpoch = authEpochRef.current;
      return {
        localOwnerId,
        ownerId,
        authEpoch,
        syncRemotely: Boolean(
          remoteStore &&
          ownerId &&
          localOwnerId === ownerId &&
          isCurrentAuth(ownerId, authEpoch),
        ),
      };
    }

    function handleSaveTrainingEvent(event) {
      const context = coachSyncContext();
      updateAppState((current) =>
        updateScoreData(
          current,
          (scores) => ({
            ...scores,
            trainingEvents: mergeById(scores.trainingEvents, [event]),
          }),
          context.localOwnerId,
        ),
      );
      if (!context.syncRemotely) return Promise.resolve(event);
      return remoteStore
        .saveTrainingEvent(event, context.ownerId)
        .then((saved) => {
          if (!isCurrentAuth(context.ownerId, context.authEpoch)) return saved;
          updateAppState((current) =>
            updateScoreData(
              current,
              (scores) => ({
                ...scores,
                trainingEvents: mergeById(scores.trainingEvents, [saved]),
              }),
              context.localOwnerId,
            ),
          );
          return saved;
        })
        .catch((error) => {
          console.warn("Could not sync training event.", error);
          if (isCurrentAuth(context.ownerId, context.authEpoch)) {
            setSyncStatus({
              state: "error",
              message:
                "Calendar change is saved locally and needs a sync retry.",
            });
          }
          return event;
        });
    }

    function handleDeleteTrainingEvent(eventId) {
      const context = coachSyncContext();
      updateAppState((current) =>
        updateScoreData(
          current,
          (scores) => ({
            ...scores,
            trainingEvents: scores.trainingEvents.filter(
              (event) => event.id !== eventId,
            ),
          }),
          context.localOwnerId,
        ),
      );
      if (context.syncRemotely) {
        remoteStore
          .deleteTrainingEvent(eventId, context.ownerId)
          .catch((error) => {
            console.warn("Could not delete remote training event.", error);
            if (isCurrentAuth(context.ownerId, context.authEpoch)) {
              setSyncStatus({
                state: "error",
                message:
                  "Calendar deletion is local; remote cleanup is pending.",
              });
            }
          });
      }
    }

    function handleSaveReadinessCheck(checkin) {
      const context = coachSyncContext();
      updateAppState((current) =>
        updateScoreData(
          current,
          (scores) => ({
            ...scores,
            readinessChecks: mergeById(scores.readinessChecks, [checkin]),
          }),
          context.localOwnerId,
        ),
      );
      if (!context.syncRemotely) return Promise.resolve(checkin);
      return remoteStore
        .saveReadinessCheck(checkin, context.ownerId)
        .then((saved) => {
          if (!isCurrentAuth(context.ownerId, context.authEpoch)) return saved;
          updateAppState((current) =>
            updateScoreData(
              current,
              (scores) => ({
                ...scores,
                readinessChecks: mergeById(scores.readinessChecks, [saved]),
              }),
              context.localOwnerId,
            ),
          );
          return saved;
        })
        .catch((error) => {
          console.warn("Could not sync readiness check.", error);
          if (isCurrentAuth(context.ownerId, context.authEpoch)) {
            setSyncStatus({
              state: "error",
              message:
                "Readiness check is saved locally and needs a sync retry.",
            });
          }
          return checkin;
        });
    }

    function handleDeleteLog(logId) {
      const context = coachSyncContext();
      updateAppState((current) =>
        updateScoreData(
          current,
          (scores) => ({
            ...scores,
            logs: scores.logs.filter((log) => log.id !== logId),
          }),
          context.localOwnerId,
        ),
      );
      notify("Workout log deleted.");
      if (!context.syncRemotely) return;
      remoteStore.deleteLog(logId, context.ownerId).catch((error) => {
        console.warn("Could not delete remote workout log.", error);
        if (isCurrentAuth(context.ownerId, context.authEpoch)) {
          setSyncStatus({
            state: "error",
            message: "Log deletion is local; remote cleanup is pending.",
          });
        }
      });
    }

    function handleRestoreBackup(payload) {
      if (!payload || typeof payload !== "object") {
        throw new Error("Backup is invalid.");
      }
      const athleteState = normalizeAthleteState(payload.athleteState);
      const scores = normalizeScoreData(payload.scoreData);
      const ownerId = appStateRef.current.activeScoreOwner || GUEST_SCORE_OWNER;
      updateAppState((current) => ({
        ...current,
        ...athleteState,
        athleteStateByOwner: {
          ...current.athleteStateByOwner,
          [ownerId]: athleteState,
        },
        scoreDataByOwner: {
          ...current.scoreDataByOwner,
          [ownerId]: seedScorePrs(scores, athleteState.profile),
        },
      }));
      notify("Backup restored on this device.");
    }

    return h(
      ReactRuntime.Fragment,
      null,
      h(
        "div",
        {
          className: "app-shell",
          "data-sync-state": syncStatus.state,
          "data-sync-message": syncStatus.message,
        },
        h(
          "header",
          { className: "topbar" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Intermediate CrossFit"),
            h("h1", null, "CrossFit Training Programme"),
          ),
          h(
            "div",
            { className: "topbar-actions" },
            h(
              "div",
              {
                className: `status-pill${localSaveError ? " status-error" : ""}`,
                title: localSaveError || "Changes are saved on this device.",
              },
              localSaveError ? "Local save failed" : "Saved locally",
            ),
          ),
        ),
        h(
          "main",
          null,
          h(DashboardView, {
            appState: viewState,
            activeView,
            onWeekChange: setSelectedWeek,
            onJumpLog: jumpToLog,
            onTimerFinish: finishTimerToLog,
            onViewPlan: () => activateView("calendarView"),
            onActivate: activateView,
            onSaveTrainingEvent: handleSaveTrainingEvent,
            onSaveReadinessCheck: handleSaveReadinessCheck,
            onRestoreBackup: handleRestoreBackup,
            onSaveProfile: (profile) => {
              updateAppState((current) =>
                syncBaselinePrsFromProfile({ ...current, profile }),
              );
              notify("Masters RX assessment saved.");
            },
            onReset: () => {
              if (
                !window.confirm(
                  "Reset profile, custom sessions, logs, and PRs on this device?",
                )
              )
                return;
              localStateStore.clear();
              let next = loadState();
              const ownerId = String(remoteUser?.id || "");
              if (ownerId) {
                next = seedPrs(activateAthleteOwner(next, ownerId), ownerId);
                loadedOwnerRef.current = null;
                hydratedAthleteOwnerRef.current = null;
              }
              updateAppState(next);
              setLogSelection(defaultSessionSelection(next));
              if (remoteUser && isCurrentAuth(ownerId, authEpochRef.current)) {
                loadRemoteScores({ user: remoteUser }, authEpochRef.current);
              }
              notify("Demo data reset.");
            },
            accountSyncPanel: h(AccountSyncPanel, {
              appState: viewState,
              remoteStore,
              remoteUser,
              syncStatus,
              onSignIn: async (email) => {
                if (!remoteStore) return;
                const authEpoch = authEpochRef.current;
                setSyncStatus({
                  state: "loading",
                  message: "Sending sign-in email...",
                });
                try {
                  await remoteStore.signIn(email, authRedirectUrl());
                  if (authEpochRef.current !== authEpoch) return;
                  setSyncStatus({
                    state: "signed-out",
                    message: "Check your email for the sign-in link.",
                  });
                  notify("Check your email for the sign-in link.");
                } catch (error) {
                  console.warn("Could not send Supabase sign-in link.", error);
                  if (authEpochRef.current !== authEpoch) return;
                  setSyncStatus({
                    state: "error",
                    message: "Could not send sign-in email.",
                  });
                  notify("Could not send sign-in email.");
                }
              },
              onSignOut: async () => {
                if (!remoteStore) return;
                const ownerId = authenticatedOwnerRef.current;
                const authEpoch = authEpochRef.current;
                try {
                  await remoteStore.signOut();
                  if (
                    authEpochRef.current !== authEpoch ||
                    authenticatedOwnerRef.current !== ownerId
                  ) {
                    return;
                  }
                  transitionToSignedOut(
                    "Signed out. Local cache remains on this device.",
                  );
                  notify("Signed out.");
                } catch (error) {
                  console.warn("Could not sign out.", error);
                  if (
                    authEpochRef.current !== authEpoch ||
                    authenticatedOwnerRef.current !== ownerId
                  ) {
                    return;
                  }
                  setSyncStatus({
                    state: "error",
                    message: "Could not sign out.",
                  });
                  notify("Could not sign out.");
                }
              },
              onSyncLocal: async () => {
                if (!remoteStore || !remoteUser) return;
                const ownerId = String(remoteUser.id || "");
                const authEpoch = authEpochRef.current;
                if (!ownerId || !isCurrentAuth(ownerId, authEpoch)) return;
                setSyncStatus({
                  state: "loading",
                  message: "Refreshing and saving your private account...",
                });
                try {
                  const savedAthleteState = await remoteStore.saveAthleteState(
                    athleteStateFromAppState(appStateRef.current),
                    ownerId,
                  );
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  updateAppState((current) => ({
                    ...current,
                    updatedAt: savedAthleteState.updatedAt,
                  }));
                  const hydrated = await hydrateRemoteScores(
                    ownerId,
                    authEpoch,
                  );
                  if (!hydrated || !isCurrentAuth(ownerId, authEpoch)) return;
                  const uploaded = await remoteStore.uploadLocalScores(
                    hydrated.scores,
                    ownerId,
                    hydrated.remoteIndex,
                  );
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  const refreshed = await hydrateRemoteScores(
                    ownerId,
                    authEpoch,
                  );
                  if (!refreshed || !isCurrentAuth(ownerId, authEpoch)) return;
                  const proofPending = uploaded.competitionProofPending || 0;
                  const timerPending = uploaded.timerResultPending || 0;
                  const workoutMetadataPending =
                    uploaded.workoutMetadataPending || 0;
                  const optionalMetadataPending =
                    proofPending + timerPending + workoutMetadataPending;
                  setSyncStatus({
                    state: "signed-in",
                    message: optionalMetadataPending
                      ? "Account synced. Some workout metadata stays local until the Supabase schema is updated."
                      : "Private athlete account synced to Supabase.",
                  });
                  notify(
                    optionalMetadataPending
                      ? `Synced local records; ${optionalMetadataPending} optional metadata item${optionalMetadataPending === 1 ? "" : "s"} still need the Supabase schema update.`
                      : `Synced ${uploaded.logs + uploaded.prAttempts + uploaded.prs} local records.`,
                  );
                } catch (error) {
                  console.warn("Could not sync local account.", error);
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  setSyncStatus({
                    state: "error",
                    message: "Could not sync the private athlete account.",
                  });
                  notify("Could not sync the private athlete account.");
                }
              },
              onImportGuest: async () => {
                if (!remoteStore || !remoteUser) return;
                const ownerId = String(remoteUser.id || "");
                const authEpoch = authEpochRef.current;
                if (!ownerId || !isCurrentAuth(ownerId, authEpoch)) return;
                if (
                  !window.confirm(
                    "Replace this account's profile and programmes with the guest data on this device? Guest scores will be merged and the guest copy will remain available.",
                  )
                ) {
                  return;
                }
                setSyncStatus({
                  state: "loading",
                  message: "Importing guest profile, programmes, and scores...",
                });
                try {
                  const hydrated = await hydrateRemoteScores(
                    ownerId,
                    authEpoch,
                    (accountScores, current) => {
                      const guestScores = selectScoreData(
                        current,
                        GUEST_SCORE_OWNER,
                      );
                      return {
                        logs: mergeById(accountScores.logs, guestScores.logs),
                        prAttempts: mergeById(
                          accountScores.prAttempts,
                          guestScores.prAttempts,
                        ),
                        trainingEvents: mergeById(
                          accountScores.trainingEvents,
                          guestScores.trainingEvents,
                        ),
                        readinessChecks: mergeById(
                          accountScores.readinessChecks,
                          guestScores.readinessChecks,
                        ),
                        prs: mergeBestPrs(accountScores.prs, guestScores.prs),
                      };
                    },
                  );
                  if (!hydrated || !isCurrentAuth(ownerId, authEpoch)) return;
                  const uploaded = await remoteStore.uploadLocalScores(
                    hydrated.scores,
                    ownerId,
                    hydrated.remoteIndex,
                  );
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  const current = appStateRef.current;
                  const guestAthleteState = normalizeAthleteState(
                    current.athleteStateByOwner?.[GUEST_SCORE_OWNER],
                  );
                  const savedAthleteState = await remoteStore.saveAthleteState(
                    guestAthleteState,
                    ownerId,
                  );
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  updateAppState((latest) =>
                    seedPrs(
                      activateAthleteOwner(latest, ownerId, savedAthleteState),
                      ownerId,
                    ),
                  );
                  const refreshed = await hydrateRemoteScores(
                    ownerId,
                    authEpoch,
                  );
                  if (!refreshed || !isCurrentAuth(ownerId, authEpoch)) return;
                  const optionalMetadataPending =
                    (uploaded.competitionProofPending || 0) +
                    (uploaded.timerResultPending || 0) +
                    (uploaded.workoutMetadataPending || 0);
                  setSyncStatus({
                    state: "signed-in",
                    message: optionalMetadataPending
                      ? "Guest data imported. Some workout metadata stays local until the Supabase schema is updated."
                      : "Guest profile, programmes, and scores imported.",
                  });
                  notify(
                    optionalMetadataPending
                      ? `Imported guest data; ${optionalMetadataPending} optional metadata item${optionalMetadataPending === 1 ? "" : "s"} still need the Supabase schema update.`
                      : `Imported guest profile, programmes, and ${uploaded.logs + uploaded.prAttempts + uploaded.prs + (uploaded.trainingEvents || 0) + (uploaded.readinessChecks || 0)} training records.`,
                  );
                } catch (error) {
                  console.warn("Could not import guest data.", error);
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  setSyncStatus({
                    state: "error",
                    message: "Could not safely import all guest data.",
                  });
                  notify("Guest data import is incomplete. Retry when online.");
                }
              },
            }),
            themeControl: h(ThemeControl, {
              value: themePreference,
              onChange: (nextPreference) => {
                updateAppState((current) => ({
                  ...current,
                  themePreference: normalizeThemePreference(nextPreference),
                }));
              },
            }),
          }),
          visitedViews.has("calendarView")
            ? h(MemoProgramView, {
                appState: viewState,
                activeView,
                onWeekChange: setSelectedWeek,
                onLogSession: jumpToLog,
                onTimerFinish: finishTimerToLog,
                onCycleStartChange: (cycleStartDate) =>
                  updateAppState((current) => ({
                    ...current,
                    cycleStartDate: coachDateValue(cycleStartDate),
                  })),
                onSaveTrainingEvent: handleSaveTrainingEvent,
                onDeleteTrainingEvent: handleDeleteTrainingEvent,
              })
            : null,
          visitedViews.has("builderView")
            ? h(MemoBuilderView, {
                appState: viewState,
                activeView,
                onNotify: notify,
                onGenerate: handleGenerateProgramme,
                onSaveSession: handleSaveCustomSession,
                onSelectPlan: handleSelectPlan,
                onRenamePlan: handleRenamePlan,
                onDeletePlan: handleDeletePlan,
                onDeleteSession: handleDeleteSession,
                onLogSession: jumpToLog,
                onTimerFinish: finishTimerToLog,
              })
            : null,
          visitedViews.has("learnView")
            ? h(MemoLearnView, { activeView })
            : null,
          visitedViews.has("proofView")
            ? h(MemoProofView, {
                appState: viewState,
                activeView,
                onFinish: finishTimerToLog,
              })
            : null,
          visitedViews.has("logView")
            ? h(MemoLogView, {
                appState: viewState,
                activeView,
                logSelection,
                pendingTimerResult,
                onLogSelectionChange: setLogSelection,
                onWeekChange: setSelectedWeek,
                onNotify: notify,
                onSaveLog: (log) => {
                  const localOwnerId = appState.activeScoreOwner;
                  const ownerId = remoteUser ? String(remoteUser.id || "") : "";
                  const authEpoch = authEpochRef.current;
                  const syncRemotely = Boolean(
                    remoteStore &&
                    ownerId &&
                    localOwnerId === ownerId &&
                    isCurrentAuth(ownerId, authEpoch),
                  );
                  const clearMatchingTimer = () => {
                    if (
                      pendingTimerResult &&
                      pendingTimerResult.dayId === log.dayId &&
                      pendingTimerResult.week === log.week
                    ) {
                      setPendingTimerResult(null);
                    }
                  };
                  const linkedEvent = log.trainingEventId
                    ? scoreData.trainingEvents.find(
                        (event) => event.id === log.trainingEventId,
                      )
                    : null;
                  const completedEvent = linkedEvent
                    ? {
                        ...linkedEvent,
                        status: "completed",
                        updatedAt: new Date().toISOString(),
                      }
                    : null;
                  updateAppState((current) =>
                    updateScoreData(
                      current,
                      (scores) => ({
                        ...scores,
                        logs: mergeById(scores.logs, [log]),
                        trainingEvents: completedEvent
                          ? mergeById(scores.trainingEvents, [completedEvent])
                          : scores.trainingEvents,
                      }),
                      localOwnerId,
                    ),
                  );
                  clearMatchingTimer();
                  notify(
                    syncRemotely
                      ? "Workout saved locally. Syncing..."
                      : "Workout log saved.",
                  );
                  if (syncRemotely) {
                    if (completedEvent) {
                      remoteStore
                        .saveTrainingEvent(completedEvent, ownerId)
                        .catch((error) =>
                          console.warn(
                            "Could not mark the linked training event complete.",
                            error,
                          ),
                        );
                    }
                    remoteStore
                      .saveLog(log, ownerId)
                      .then((syncResult) => {
                        if (!isCurrentAuth(ownerId, authEpoch)) return;
                        const optionalMetadataPending =
                          syncResult?.competitionProofSynced === false ||
                          syncResult?.timerResultSynced === false ||
                          syncResult?.workoutMetadataSynced === false;
                        setSyncStatus({
                          state: "signed-in",
                          message: optionalMetadataPending
                            ? "Workout saved. Some workout metadata remains local until the Supabase schema is updated."
                            : "Scores are syncing with Supabase.",
                        });
                        notify(
                          optionalMetadataPending
                            ? "Workout saved. Some workout metadata stays local until the Supabase schema is updated."
                            : "Workout log saved.",
                        );
                      })
                      .catch((error) => {
                        console.warn(
                          "Could not save workout log to Supabase.",
                          error,
                        );
                        if (!isCurrentAuth(ownerId, authEpoch)) return;
                        setSyncStatus({
                          state: "error",
                          message:
                            "Workout is saved locally. Remote sync is pending; retry from Account.",
                        });
                        notify(
                          "Workout saved locally. Remote sync is pending.",
                        );
                      });
                  }
                  return Promise.resolve();
                },
                onClearLogs: () => {
                  if (!scoreData.logs.length) return;
                  if (!window.confirm("Clear all workout logs on this device?"))
                    return;
                  const localOwnerId = appState.activeScoreOwner;
                  const ownerId = remoteUser ? String(remoteUser.id || "") : "";
                  const authEpoch = authEpochRef.current;
                  const syncRemotely = Boolean(
                    remoteStore &&
                    ownerId &&
                    localOwnerId === ownerId &&
                    isCurrentAuth(ownerId, authEpoch),
                  );
                  const clearLocalLogs = (showNotice = true) => {
                    updateAppState((current) =>
                      updateScoreData(
                        current,
                        (scores) => ({
                          ...scores,
                          logs: [],
                        }),
                        localOwnerId,
                      ),
                    );
                    if (showNotice) notify("Workout logs cleared.");
                  };
                  if (syncRemotely) {
                    remoteStore
                      .clearLogs()
                      .then(() => {
                        const isCurrent = isCurrentAuth(ownerId, authEpoch);
                        clearLocalLogs(isCurrent);
                        if (!isCurrent) return;
                      })
                      .catch((error) => {
                        console.warn(
                          "Could not clear Supabase workout logs.",
                          error,
                        );
                        if (!isCurrentAuth(ownerId, authEpoch)) return;
                        notify("Could not clear Supabase workout logs.");
                      });
                    return;
                  }
                  clearLocalLogs();
                },
                onDeleteLog: handleDeleteLog,
              })
            : null,
          visitedViews.has("progressView")
            ? h(MemoPrView, {
                appState: viewState,
                activeView,
                onNotify: notify,
                onSaveAttempt: (attempt) => {
                  const localOwnerId = appState.activeScoreOwner;
                  const ownerScores = selectScoreData(
                    appStateRef.current,
                    localOwnerId,
                  );
                  const prs = { ...ownerScores.prs };
                  if (attempt.isPr) {
                    prs[attempt.metricId] = {
                      metricId: attempt.metricId,
                      value: attempt.value,
                      display: attempt.display,
                      date: attempt.date,
                      notes: attempt.notes,
                      updatedAt: attempt.createdAt,
                    };
                  }

                  const ownerId = remoteUser ? String(remoteUser.id || "") : "";
                  const authEpoch = authEpochRef.current;
                  const syncRemotely = Boolean(
                    remoteStore &&
                    ownerId &&
                    localOwnerId === ownerId &&
                    isCurrentAuth(ownerId, authEpoch),
                  );

                  const saveLocalAttempt = () => {
                    updateAppState((current) =>
                      updateScoreData(
                        current,
                        (scores) => ({
                          ...scores,
                          prs: attempt.isPr
                            ? {
                                ...scores.prs,
                                [attempt.metricId]: prs[attempt.metricId],
                              }
                            : scores.prs,
                          prAttempts: mergeById(scores.prAttempts, [attempt]),
                        }),
                        localOwnerId,
                      ),
                    );
                    notify(
                      syncRemotely
                        ? `${attempt.isPr ? "New PR" : "Attempt"} saved locally. Syncing...`
                        : attempt.isPr
                          ? "New PR saved."
                          : "Attempt saved.",
                    );
                  };

                  saveLocalAttempt();
                  if (syncRemotely) {
                    remoteStore
                      .savePrAttempt(attempt, prs, ownerId)
                      .then((canonicalRecord) => {
                        if (!isCurrentAuth(ownerId, authEpoch)) return;
                        if (canonicalRecord) {
                          updateAppState((current) =>
                            updateScoreData(
                              current,
                              (scores) => ({
                                ...scores,
                                prs: mergeBestPrs(
                                  scores.prs,
                                  {
                                    [canonicalRecord.metricId]: canonicalRecord,
                                  },
                                  true,
                                ),
                              }),
                              localOwnerId,
                            ),
                          );
                        }
                        setSyncStatus({
                          state: "signed-in",
                          message: "Scores are syncing with Supabase.",
                        });
                        notify(
                          attempt.isPr ? "New PR synced." : "Attempt synced.",
                        );
                      })
                      .catch((error) => {
                        console.warn(
                          "Could not save PR attempt to Supabase.",
                          error,
                        );
                        if (!isCurrentAuth(ownerId, authEpoch)) return;
                        setSyncStatus({
                          state: "error",
                          message:
                            "PR attempt is saved locally. Remote sync is pending; retry from Account.",
                        });
                        notify(
                          "PR attempt saved locally. Remote sync is pending.",
                        );
                      });
                  }
                  return Promise.resolve();
                },
              })
            : null,
        ),
        h(BottomNav, { activeView, onActivate: activateView }),
      ),
      h(
        "div",
        {
          id: "toast",
          className: `toast${toast ? " is-visible" : ""}`,
          role: "status",
          "aria-live": "polite",
        },
        toast,
      ),
    );
  }

  function AccountSyncPanel({
    appState,
    remoteStore,
    remoteUser,
    syncStatus,
    onSignIn,
    onSignOut,
    onSyncLocal,
    onImportGuest,
  }) {
    const [email, setEmail] = ReactRuntime.useState("");
    const guestScores = normalizeScoreData(
      appState.scoreDataByOwner?.[GUEST_SCORE_OWNER],
    );
    const guestRecordCount =
      guestScores.logs.length +
      guestScores.prAttempts.length +
      Object.keys(guestScores.prs).length;
    const guestAthleteState = normalizeAthleteState(
      appState.athleteStateByOwner?.[GUEST_SCORE_OWNER],
    );
    const guestProfileChanged =
      JSON.stringify(guestAthleteState.profile) !==
      JSON.stringify(cloneDefaultProfile());
    const guestDataCount =
      guestRecordCount +
      guestAthleteState.plans.length +
      (guestProfileChanged ? 1 : 0);

    return h(
      "section",
      { className: "panel", "aria-labelledby": "accountSyncTitle" },
      h(
        "div",
        { className: "panel-title" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Account"),
          h("h3", { id: "accountSyncTitle" }, "Database sync"),
        ),
        h(
          "span",
          { className: "metric-pill" },
          remoteUser ? "Signed in" : "Local only",
        ),
      ),
      h("p", { className: "muted-copy" }, syncStatus.message),
      !remoteStore
        ? h("div", { className: "empty-state" }, syncStatus.message)
        : null,
      remoteStore && !remoteUser
        ? h(
            "form",
            {
              className: "sync-form",
              onSubmit: (event) => {
                event.preventDefault();
                const normalizedEmail = email.trim();
                if (!normalizedEmail) return;
                onSignIn(normalizedEmail);
              },
            },
            h(
              "label",
              null,
              "Email",
              h("input", {
                type: "email",
                value: email,
                placeholder: "athlete@example.com",
                autoComplete: "email",
                onChange: (event) => setEmail(event.target.value),
              }),
            ),
            h(
              "button",
              {
                className: "primary-button",
                type: "submit",
                disabled: syncStatus.state === "loading",
              },
              "Email sign-in link",
            ),
          )
        : null,
      remoteStore && remoteUser
        ? h(
            "div",
            { className: "sync-actions" },
            h(
              "p",
              { className: "muted-copy" },
              remoteUser.email || "Signed in athlete",
            ),
            h(
              "div",
              { className: "quick-actions" },
              h(
                "button",
                {
                  className: "primary-button",
                  type: "button",
                  onClick: onSyncLocal,
                  disabled: syncStatus.state === "loading",
                },
                "Retry account sync",
              ),
              guestDataCount
                ? h(
                    "button",
                    {
                      className: "ghost-button",
                      type: "button",
                      onClick: onImportGuest,
                      disabled: syncStatus.state === "loading",
                    },
                    `Import guest data (${guestDataCount})`,
                  )
                : null,
              h(
                "button",
                {
                  className: "ghost-button",
                  type: "button",
                  onClick: onSignOut,
                  disabled: syncStatus.state === "loading",
                },
                "Sign out",
              ),
            ),
          )
        : null,
    );
  }

  function ThemeControl({ value, onChange }) {
    return h(
      "label",
      { className: "theme-control" },
      h("span", { className: "theme-control-label" }, "Theme"),
      h(
        "select",
        {
          "aria-label": "Theme preference",
          value,
          onChange: (event) => onChange(event.target.value),
        },
        h("option", { value: "system" }, "System"),
        h("option", { value: "light" }, "Light"),
        h("option", { value: "dark" }, "Dark"),
      ),
    );
  }

  function WeekSelect({ id, label, value, onChange }) {
    return h(
      "select",
      {
        id,
        "aria-label": label,
        value: String(value),
        onChange: (event) =>
          onChange(/** @type {HTMLSelectElement} */ (event.target).value),
      },
      weekOptions(),
    );
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadTextFile(filename, contents, mimeType) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function workoutLogsCsv(logs) {
    const headers = [
      "date",
      "week",
      "source",
      "workout",
      "readiness",
      "rpe",
      "rx_status",
      "score_type",
      "score_value",
      "wod_score",
      "strength_result",
      "notes",
    ];
    return [
      headers.join(","),
      ...logs.map((log) =>
        [
          log.date,
          log.week,
          log.workoutSource || "app",
          log.dayTitle,
          log.readiness || "",
          log.rpe || "",
          log.rxStatus || "",
          log.structuredScore?.scoreType || "",
          log.structuredScore?.primaryValue || "",
          log.wodScore || "",
          log.strengthResult || "",
          log.notes || "",
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");
  }

  function prHistoryCsv(attempts) {
    const headers = ["date", "metric", "value", "display", "is_pr", "notes"];
    return [
      headers.join(","),
      ...attempts.map((attempt) =>
        [
          attempt.date,
          attempt.metricName || attempt.metricId,
          attempt.value,
          attempt.display,
          attempt.isPr ? "yes" : "no",
          attempt.notes || "",
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");
  }

  function builtInCycleSessions(profile) {
    return WEEK_META.flatMap((week) =>
      getProgramDays().map((day) => ({
        ...buildSession(day.id, week.week, profile),
        id: `cycle-${week.week}-${day.id}`,
        logDayId: day.id,
        week: week.week,
        preferredDay: day.weekday,
      })),
    );
  }

  function sessionMovementGuides(session) {
    if (!session) return [];
    const exerciseIds = new Set();
    const definition = session.workoutDefinition;
    if (definition) {
      [
        ...(definition.buyIn || []),
        ...(definition.exercises || []),
        ...(definition.format?.stations || []).flatMap(
          (station) => station.exercises || [],
        ),
        ...(definition.afterEachRound || []),
        ...(definition.cashOut || []),
      ].forEach((exercise) => {
        if (exercise?.movementId) exerciseIds.add(exercise.movementId);
      });
    }
    (session.trainingBlocks || []).forEach((trainingBlock) => {
      (trainingBlock?.prescription?.exercises || []).forEach((exercise) => {
        if (exercise?.movementId) exerciseIds.add(exercise.movementId);
      });
    });
    const normalizedText = [
      session.title,
      session.shortTitle,
      session.focus,
      ...(session.segments || []).flatMap((segment) => segment.items || []),
      ...(session.warmup || []),
      ...(session.strength || []),
      ...workoutItemsForSession(session),
      ...(session.mobility || []),
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");
    return MOVEMENT_LIBRARY.filter((movement) => {
      if (exerciseIds.has(movement.id)) return true;
      const tokens = movement.id.split("-").filter((token) => token.length > 2);
      return (
        tokens.length && tokens.every((token) => normalizedText.includes(token))
      );
    }).slice(0, 3);
  }

  function MovementGuides({ session }) {
    const guides = sessionMovementGuides(session);
    if (!guides.length) return null;
    return h(
      "details",
      { className: "movement-guides" },
      h("summary", null, `Movement coaching (${guides.length})`),
      h(
        "div",
        { className: "movement-guide-grid" },
        guides.map((guide) =>
          h(
            "article",
            { className: "movement-guide", key: guide.id },
            h("h4", null, guide.name),
            h("p", null, guide.focus),
            h(
              "ul",
              null,
              guide.cues.slice(0, 3).map((cue) => h("li", { key: cue }, cue)),
            ),
            h("p", { className: "muted-copy" }, `Scale: ${guide.scale}`),
            h(
              "a",
              {
                href: guide.videoUrl,
                target: "_blank",
                rel: "noreferrer",
              },
              "Watch movement guide",
            ),
          ),
        ),
      ),
    );
  }

  function DashboardView({
    appState,
    activeView,
    onWeekChange,
    onJumpLog,
    onTimerFinish,
    onViewPlan,
    onActivate,
    onSaveTrainingEvent,
    onSaveReadinessCheck,
    onRestoreBackup,
    onSaveProfile,
    onReset,
    accountSyncPanel,
    themeControl,
  }) {
    const activePlan = selectActivePlan(appState);
    const allSessions = activePlan
      ? activePlan.sessions.map(customPlanToSession)
      : builtInCycleSessions(appState.profile);
    const weekSessions = allSessions.filter(
      (session) => Number(session.week) === Number(appState.selectedWeek),
    );
    const logsThisWeek = appState.logs.filter(
      (log) => log.week === appState.selectedWeek,
    );
    const mainDayIds = weekSessions.map(
      (session) => session.logDayId || session.id,
    );
    const completedDayIds = new Set(
      logsThisWeek
        .filter((log) => mainDayIds.includes(log.dayId))
        .map((log) => log.dayId),
    );
    const completedDays = completedDayIds.size;
    const latestRpe = appState.logs.find((log) => String(log.rpe || "").trim());
    const latestPr = appState.prAttempts.find((attempt) => attempt.isPr);
    const trainingProgress = activePlan
      ? weeklyTrainingProgress(activePlan, appState.logs, appState.selectedWeek)
      : null;
    const weekSessionCount =
      trainingProgress?.programTarget || weekSessions.length;
    const completedProgression =
      trainingProgress?.completedProgramWorkouts ?? completedDays;
    const weekPercent = weekSessionCount
      ? Math.min(
          100,
          Math.round((completedProgression / weekSessionCount) * 100),
        )
      : 0;
    const today = todayInputValue();
    const schedule = buildTrainingSchedule({
      sessions: allSessions,
      trainingEvents: appState.trainingEvents,
      logs: appState.logs,
      cycleStartDate: appState.cycleStartDate,
    });
    const currentEvent =
      schedule.find(
        (event) =>
          event.kind === "app" &&
          event.date === today &&
          event.status !== "completed" &&
          event.status !== "skipped",
      ) ||
      schedule.find(
        (event) =>
          event.kind === "app" &&
          event.date >= today &&
          event.status === "planned",
      ) ||
      schedule.find(
        (event) => event.kind === "app" && event.status === "planned",
      );
    const session =
      allSessions.find((item) => item.id === currentEvent?.sessionId) ||
      weekSessions.find(
        (item) => !completedDayIds.has(item.logDayId || item.id),
      ) ||
      weekSessions[0];
    const todaysBoxEvent = appState.trainingEvents.find(
      (event) => event.kind === "box" && event.date === today,
    );
    const todaysCheckin = appState.readinessChecks.find(
      (checkin) => checkin.date === today,
    );
    const [boxText, setBoxText] = ReactRuntime.useState(
      todaysBoxEvent?.rawBoxText || "",
    );
    const [energy, setEnergy] = ReactRuntime.useState(
      String(todaysCheckin?.energy || 3),
    );
    const [soreness, setSoreness] = ReactRuntime.useState(
      todaysCheckin?.soreness || "none",
    );
    const [pain, setPain] = ReactRuntime.useState(Boolean(todaysCheckin?.pain));
    const [availableMinutes, setAvailableMinutes] = ReactRuntime.useState(
      String(todaysCheckin?.availableMinutes || 60),
    );
    const [manualStimuli, setManualStimuli] = ReactRuntime.useState(
      todaysBoxEvent?.stimuli || [],
    );
    const [savedRecommendation, setSavedRecommendation] = ReactRuntime.useState(
      todaysBoxEvent?.recommendation || null,
    );
    const parsedBox = parseBoxWorkout(boxText);
    const boxStimuli = [...new Set([...parsedBox.stimuli, ...manualStimuli])];
    const boxWorkout = boxText.trim()
      ? { ...parsedBox, stimuli: boxStimuli }
      : null;
    const liveRecommendation = buildDailyRecommendation({
      checkin: {
        energy: Number(energy),
        soreness,
        pain,
        availableMinutes: Number(availableMinutes),
      },
      boxWorkout,
      session,
      alternatives: weekSessions.filter(
        (candidate) => !completedDayIds.has(candidate.logDayId || candidate.id),
      ),
    });
    const recommendation = savedRecommendation || liveRecommendation;
    const recommendedSession =
      allSessions.find(
        (candidate) => candidate.id === recommendation.recommendedSessionId,
      ) || session;
    const primaryRecommendationTitle =
      recommendation.action === "rest"
        ? "Recovery day"
        : boxWorkout
          ? "Complete the box WOD"
          : recommendedSession?.shortTitle ||
            recommendedSession?.title ||
            "Recovery day";

    if (activeView === "moreView") {
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        athleteState: {
          profile: appState.profile,
          plans: appState.plans,
          activePlanId: appState.activePlanId,
          selectedWeek: appState.selectedWeek,
          cycleStartDate: appState.cycleStartDate,
          planSchemaVersion: appState.planSchemaVersion,
        },
        scoreData: {
          logs: appState.logs,
          prs: appState.prs,
          prAttempts: appState.prAttempts,
          trainingEvents: appState.trainingEvents,
          readinessChecks: appState.readinessChecks,
        },
      };
      return h(
        "section",
        {
          id: "moreView",
          className: "view is-active",
          "aria-labelledby": "moreTitle",
        },
        h(
          "div",
          { className: "section-heading" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Settings and tools"),
            h("h2", { id: "moreTitle" }, "More"),
          ),
        ),
        h(
          "section",
          { className: "more-grid", "aria-label": "Training tools" },
          [
            [
              "builderView",
              "Build programme",
              "Generate or edit your eight-week progression.",
            ],
            [
              "learnView",
              "Movement library",
              "Open coaching cues, progressions, and videos.",
            ],
            [
              "proofView",
              "Competition proof",
              "Record a workout with a synchronized timer.",
            ],
          ].map(([viewId, title, detail]) =>
            h(
              "button",
              {
                key: viewId,
                className: "panel more-card",
                type: "button",
                "aria-label": title,
                onClick: () => onActivate(viewId),
              },
              h("strong", null, title),
              h("span", null, detail),
            ),
          ),
        ),
        h(
          "section",
          { className: "panel", "aria-labelledby": "dataOwnershipTitle" },
          h("p", { className: "eyebrow" }, "Data ownership"),
          h("h3", { id: "dataOwnershipTitle" }, "Backup and export"),
          h(
            "p",
            { className: "muted-copy" },
            "Download a complete private backup or a spreadsheet-ready workout history.",
          ),
          h(
            "div",
            { className: "quick-actions" },
            h(
              "button",
              {
                className: "primary-button",
                type: "button",
                onClick: () =>
                  downloadTextFile(
                    `crossfit-backup-${today}.json`,
                    JSON.stringify(backup, null, 2),
                    "application/json",
                  ),
              },
              "Download JSON backup",
            ),
            h(
              "button",
              {
                className: "ghost-button",
                type: "button",
                onClick: () =>
                  downloadTextFile(
                    `crossfit-logs-${today}.csv`,
                    workoutLogsCsv(appState.logs),
                    "text/csv;charset=utf-8",
                  ),
              },
              "Export logs CSV",
            ),
            h(
              "button",
              {
                className: "ghost-button",
                type: "button",
                onClick: () =>
                  downloadTextFile(
                    `crossfit-pr-history-${today}.csv`,
                    prHistoryCsv(appState.prAttempts),
                    "text/csv;charset=utf-8",
                  ),
              },
              "Export PR history CSV",
            ),
          ),
          h(
            "label",
            { className: "file-input-label" },
            "Restore JSON backup",
            h("input", {
              type: "file",
              accept: "application/json,.json",
              onChange: async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const payload = JSON.parse(await file.text());
                if (
                  window.confirm(
                    "Replace this account's local profile, plans, logs, and PR data with the selected backup?",
                  )
                ) {
                  onRestoreBackup(payload);
                }
                event.target.value = "";
              },
            }),
          ),
        ),
        h(ProfilePanel, {
          profile: appState.profile,
          onSave: onSaveProfile,
          onReset,
        }),
        h(
          "section",
          { className: "panel", "aria-labelledby": "appearanceTitle" },
          h("p", { className: "eyebrow" }, "Display"),
          h("h3", { id: "appearanceTitle" }, "Appearance"),
          themeControl,
        ),
        h(
          "section",
          { className: "panel", "aria-labelledby": "debugTitle" },
          h("p", { className: "eyebrow" }, "Debug"),
          h("h3", { id: "debugTitle" }, "Deployment"),
          h(
            "p",
            { className: "muted-copy" },
            "Commit SHA: ",
            h(
              "code",
              { "data-testid": "deployment-commit-sha" },
              window.ForgeHourBuild?.commitSha || "unavailable",
            ),
          ),
          h(
            "p",
            { className: "muted-copy" },
            `Generation trace entries: ${window.__FORGE_HOUR_GENERATION_TRACE__?.length || 0}. Inspect window.__FORGE_HOUR_GENERATION_TRACE__ in developer tools for all nine strength-and-skill snapshots.`,
          ),
        ),
        accountSyncPanel,
      );
    }

    return h(
      "section",
      {
        id: "dashboardView",
        className: viewClass("dashboardView", activeView),
        "aria-labelledby": "dashboardTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, formatDate(today)),
          h("h2", { id: "dashboardTitle" }, "Today coach"),
        ),
        h(WeekSelect, {
          id: "dashboardWeek",
          label: "Dashboard week",
          value: appState.selectedWeek,
          onChange: onWeekChange,
        }),
      ),
      h(
        "section",
        {
          className: `panel today-hero recommendation-${recommendation.action}`,
          "aria-live": "polite",
          "aria-labelledby": "todayHeroTitle",
        },
        h(
          "div",
          { className: "recommendation-heading" },
          h("p", { className: "eyebrow" }, "Today's decision"),
          h(
            "span",
            { className: "recommendation-action" },
            recommendation.action.toUpperCase(),
          ),
        ),
        h("h3", { id: "todayHeroTitle" }, primaryRecommendationTitle),
        h("p", { className: "today-hero-reason" }, recommendation.reasons[0]),
        h(
          "div",
          { className: "quick-actions" },
          recommendedSession && recommendation.action !== "rest"
            ? h(
                "button",
                {
                  className: "primary-button",
                  type: "button",
                  onClick: () =>
                    onJumpLog(
                      recommendedSession.logDayId || recommendedSession.id,
                      recommendedSession.week,
                      {
                        workoutSource: boxWorkout ? "box" : "app",
                        boxWorkoutTitle: boxWorkout ? "CrossFit box WOD" : null,
                        trainingEventId: boxWorkout
                          ? todaysBoxEvent?.id || null
                          : currentEvent?.id || null,
                        readinessCheckId: todaysCheckin?.id || null,
                        recommendationSnapshot: recommendation,
                      },
                    ),
                },
                boxWorkout ? "Log box workout" : "Start and log workout",
              )
            : null,
          h(
            "button",
            { className: "ghost-button", type: "button", onClick: onViewPlan },
            "Open calendar",
          ),
        ),
      ),
      h(
        "div",
        { className: "stats-grid", id: "statsGrid" },
        h(StatCard, {
          value: `${completedProgression}/${weekSessionCount}`,
          label:
            activePlan?.kind === "generated"
              ? "App progression"
              : "Sessions logged",
        }),
        trainingProgress
          ? h(StatCard, {
              value: `${trainingProgress.totalCompleted}/${trainingProgress.totalTarget}`,
              label: "Total training",
            })
          : h(StatCard, { value: `${weekPercent}%`, label: "Week complete" }),
        trainingProgress
          ? h(StatCard, {
              value: `${trainingProgress.completedBoxWorkouts}/${trainingProgress.expectedBoxDays}`,
              label: "Box workouts",
            })
          : h(StatCard, {
              value: latestRpe ? latestRpe.rpe : "-",
              label: "Latest RPE",
            }),
        h(StatCard, {
          value: trainingProgress
            ? trainingProgress.progressionComplete
              ? "Complete"
              : `${weekPercent}%`
            : latestPr
              ? latestPr.metricName
              : "-",
          label: trainingProgress ? "Progression week" : "Latest PR",
        }),
      ),
      h(
        "form",
        {
          className: "panel today-checkin",
          onSubmit: (event) => {
            event.preventDefault();
            const createdAt = new Date().toISOString();
            const checkin = {
              id: todaysCheckin?.id || createId(),
              date: today,
              energy: Number(energy),
              soreness,
              pain,
              availableMinutes: Number(availableMinutes),
              createdAt: todaysCheckin?.createdAt || createdAt,
            };
            onSaveReadinessCheck(checkin);
            let appliedRecommendation = liveRecommendation;
            if (
              boxWorkout &&
              currentEvent?.kind === "app" &&
              currentEvent.status === "planned" &&
              currentEvent.date === today
            ) {
              const latestPlannedDate = schedule
                .filter(
                  (item) =>
                    item.kind === "app" &&
                    item.status === "planned" &&
                    item.sessionId !== currentEvent.sessionId,
                )
                .map((item) => item.date)
                .sort()
                .at(-1);
              const rescheduledTo = addCoachDays(latestPlannedDate || today, 1);
              appliedRecommendation = {
                ...liveRecommendation,
                reasons: [
                  ...liveRecommendation.reasons,
                  `The conflicting key session moves to ${rescheduledTo}; it is not deleted.`,
                ],
                modifications: {
                  ...liveRecommendation.modifications,
                  movedSessionId: currentEvent.sessionId,
                  rescheduledFrom: currentEvent.date,
                  rescheduledTo,
                },
              };
              onSaveTrainingEvent({
                id: currentEvent.generated ? createId() : currentEvent.id,
                date: rescheduledTo,
                kind: "app",
                status: "planned",
                sessionId: currentEvent.sessionId,
                title: currentEvent.title,
                rawBoxText: "",
                movementIds: [],
                stimuli: currentEvent.stimuli || [],
                recommendation: appliedRecommendation,
                createdAt: currentEvent.createdAt || createdAt,
                updatedAt: createdAt,
              });
            }
            if (boxWorkout) {
              onSaveTrainingEvent({
                id: todaysBoxEvent?.id || createId(),
                date: today,
                kind: "box",
                status: "planned",
                sessionId: null,
                title: "CrossFit box WOD",
                rawBoxText: boxWorkout.rawText,
                movementIds: boxWorkout.movementIds,
                stimuli: boxWorkout.stimuli,
                recommendation: appliedRecommendation,
                createdAt: todaysBoxEvent?.createdAt || createdAt,
                updatedAt: createdAt,
              });
            }
            setSavedRecommendation(appliedRecommendation);
          },
        },
        h(
          "div",
          { className: "panel-title" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Ten-second check-in"),
            h("h3", null, "How ready are you?"),
          ),
          todaysCheckin
            ? h("span", { className: "metric-pill" }, "Saved today")
            : null,
        ),
        h(
          "div",
          { className: "today-checkin-grid" },
          h(
            "label",
            null,
            "Energy",
            h(
              "select",
              {
                value: energy,
                onChange: (event) => setEnergy(event.target.value),
              },
              [1, 2, 3, 4, 5].map((value) =>
                h("option", { key: value, value: String(value) }, `${value}/5`),
              ),
            ),
          ),
          h(
            "label",
            null,
            "Soreness",
            h(
              "select",
              {
                value: soreness,
                onChange: (event) => setSoreness(event.target.value),
              },
              h("option", { value: "none" }, "None"),
              h("option", { value: "manageable" }, "Manageable"),
              h("option", { value: "high" }, "High"),
            ),
          ),
          h(
            "label",
            null,
            "Time available",
            h(
              "select",
              {
                value: availableMinutes,
                onChange: (event) => setAvailableMinutes(event.target.value),
              },
              [30, 45, 60, 75, 90].map((value) =>
                h(
                  "option",
                  { key: value, value: String(value) },
                  `${value} min`,
                ),
              ),
            ),
          ),
          h(
            "label",
            { className: "check-row pain-check" },
            h("input", {
              type: "checkbox",
              checked: pain,
              onChange: (event) => setPain(event.target.checked),
            }),
            "Pain today",
          ),
        ),
        h(
          "label",
          null,
          "Paste today's box WOD (optional)",
          h("textarea", {
            rows: "4",
            value: boxText,
            placeholder: "AMRAP 15: 10 thrusters, 10 chest-to-bar, 200 m run",
            onChange: (event) => {
              setBoxText(event.target.value);
              setSavedRecommendation(null);
            },
          }),
        ),
        boxText.trim()
          ? h(
              "div",
              { className: "box-wod-review" },
              h(
                "p",
                { className: "stat-detail" },
                parsedBox.movements.length
                  ? `Detected: ${parsedBox.movements.map((movement) => movement.name).join(", ")}.`
                  : "No catalog movements detected yet; confirm the stimulus below.",
              ),
              parsedBox.unmatchedLines.length
                ? h(
                    "p",
                    { className: "warning-copy" },
                    `Review unmatched text: ${parsedBox.unmatchedLines.slice(0, 2).join(" · ")}`,
                  )
                : null,
              h(
                "fieldset",
                { className: "stimulus-picker" },
                h("legend", null, "Confirm extra stimulus"),
                [
                  ["squat", "Squat"],
                  ["hinge", "Hinge"],
                  ["olympic_lifting", "Olympic lifting"],
                  ["vertical_pull", "Pulling"],
                  ["gymnastics", "Gymnastics"],
                  ["aerobic", "Aerobic"],
                  ["long_conditioning", "Long conditioning"],
                ].map(([value, label]) =>
                  h(
                    "label",
                    { key: value, className: "check-row" },
                    h("input", {
                      type: "checkbox",
                      checked:
                        parsedBox.stimuli.includes(value) ||
                        manualStimuli.includes(value),
                      onChange: (event) =>
                        setManualStimuli((current) =>
                          event.target.checked
                            ? [...new Set([...current, value])]
                            : current.filter((item) => item !== value),
                        ),
                    }),
                    label,
                  ),
                ),
              ),
            )
          : null,
        h(
          "button",
          { className: "primary-button", type: "submit" },
          "Save check-in and recommendation",
        ),
      ),
      h(
        "section",
        {
          className: `panel recommendation-card recommendation-${recommendation.action}`,
          "aria-live": "polite",
          "aria-labelledby": "todayRecommendationTitle",
        },
        h(
          "div",
          { className: "recommendation-heading" },
          h("p", { className: "eyebrow" }, "Today's recommendation"),
          h(
            "span",
            { className: "recommendation-action" },
            recommendation.action.toUpperCase(),
          ),
        ),
        h("h3", { id: "todayRecommendationTitle" }, primaryRecommendationTitle),
        h(
          "ul",
          null,
          recommendation.reasons.map((reason) =>
            h("li", { key: reason }, reason),
          ),
        ),
        recommendation.action === "scale"
          ? h(
              "p",
              { className: "warning-copy" },
              `Use about ${Math.round(recommendation.modifications.volumeMultiplier * 100)}% of accessory and conditioning volume. Preserve technically sound strength sets.`,
            )
          : null,
      ),
      h(
        "div",
        { id: "nextSession" },
        recommendedSession && recommendation.action !== "rest"
          ? h(
              "section",
              { className: "panel" },
              h(
                "div",
                { className: "session-topline" },
                h(
                  "div",
                  null,
                  h(
                    "p",
                    { className: "eyebrow" },
                    boxWorkout ? "Protected progression" : "Priority session",
                  ),
                  h(
                    "h3",
                    null,
                    `${recommendedSession.weekday || `Week ${recommendedSession.week}`} - ${recommendedSession.shortTitle}`,
                  ),
                ),
                h(
                  "span",
                  { className: "metric-pill" },
                  `${recommendedSession.duration || 60} min`,
                ),
              ),
              h("p", { className: "muted-copy" }, recommendedSession.focus),
              h(MovementGuides, { session: recommendedSession }),
              h(
                "div",
                {
                  className: "completion-bar",
                  "aria-label": "Week completion",
                },
                h("span", { style: { width: `${weekPercent}%` } }),
              ),
              h(
                "div",
                { className: "quick-actions" },
                boxWorkout
                  ? null
                  : h(
                      "button",
                      {
                        className: "primary-button",
                        type: "button",
                        onClick: () =>
                          onJumpLog(
                            recommendedSession.logDayId ||
                              recommendedSession.id,
                            recommendedSession.week,
                            {
                              workoutSource: "app",
                              trainingEventId: currentEvent?.id || null,
                              readinessCheckId: todaysCheckin?.id || null,
                              recommendationSnapshot: recommendation,
                            },
                          ),
                      },
                      "Log workout",
                    ),
                h(
                  "button",
                  {
                    className: "ghost-button",
                    type: "button",
                    onClick: onViewPlan,
                  },
                  "View plan",
                ),
              ),
              boxWorkout
                ? null
                : h(WorkoutTimer, {
                    session: recommendedSession,
                    onFinish: onTimerFinish,
                  }),
            )
          : h(
              "div",
              { className: "empty-state" },
              "No progression session is scheduled. Use the calendar to move the next key session.",
            ),
      ),
    );
  }

  function StatCard({ value, label, detail = null }) {
    return h(
      "article",
      { className: "stat-card" },
      h("p", { className: "stat-label" }, label),
      h("p", { className: "stat-value" }, value),
      detail ? h("p", { className: "stat-detail" }, detail) : null,
    );
  }

  function ProfilePanel({ profile, onSave, onReset }) {
    const [draft, setDraft] = ReactRuntime.useState(() => ({
      athleteName: profile.athleteName,
      age: profile.age,
      division: profile.division,
      bodyweight: profile.bodyweight,
      maxes: { ...profile.maxes },
      benchmarks: { ...profile.benchmarks },
    }));

    ReactRuntime.useEffect(() => {
      setDraft({
        athleteName: profile.athleteName,
        age: profile.age,
        division: profile.division,
        bodyweight: profile.bodyweight,
        maxes: { ...profile.maxes },
        benchmarks: { ...profile.benchmarks },
      });
    }, [profile]);

    function updateMax(key, value) {
      setDraft((current) => ({
        ...current,
        maxes: { ...current.maxes, [key]: value },
      }));
    }

    function updateBenchmark(key, value) {
      setDraft((current) => ({
        ...current,
        benchmarks: { ...current.benchmarks, [key]: value },
      }));
    }

    return h(
      "section",
      { className: "panel", "aria-labelledby": "profileTitle" },
      h(
        "div",
        { className: "panel-title" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Profile"),
          h("h3", { id: "profileTitle" }, "Masters RX assessment"),
        ),
        h(
          "button",
          {
            className: "ghost-button",
            id: "resetDemoData",
            type: "button",
            onClick: onReset,
          },
          "Reset",
        ),
      ),
      h(
        "form",
        {
          id: "profileForm",
          className: "profile-grid",
          onSubmit: (event) => {
            event.preventDefault();
            onSave({
              ...profile,
              athleteName: String(
                draft.athleteName || "Intermediate athlete",
              ).trim(),
              age: positiveNumber(draft.age, profile.age),
              division: String(draft.division || "men35to39"),
              bodyweight: positiveNumber(draft.bodyweight, profile.bodyweight),
              maxes: {
                backSquat: positiveNumber(
                  draft.maxes.backSquat,
                  profile.maxes.backSquat,
                ),
                frontSquat: positiveNumber(
                  draft.maxes.frontSquat,
                  profile.maxes.frontSquat,
                ),
                deadlift: positiveNumber(
                  draft.maxes.deadlift,
                  profile.maxes.deadlift,
                ),
                strictPress: positiveNumber(
                  draft.maxes.strictPress,
                  profile.maxes.strictPress,
                ),
                thruster: positiveNumber(
                  draft.maxes.thruster,
                  profile.maxes.thruster,
                ),
                snatch: positiveNumber(
                  draft.maxes.snatch,
                  profile.maxes.snatch,
                ),
                cleanJerk: positiveNumber(
                  draft.maxes.cleanJerk,
                  profile.maxes.cleanJerk,
                ),
              },
              benchmarks: {
                ...profile.benchmarks,
                row1k: String(draft.benchmarks.row1k ?? "").trim(),
                row2k: String(draft.benchmarks.row2k ?? "").trim(),
                run5k: String(draft.benchmarks.run5k ?? "").trim(),
                bike10MinCalories: positiveNumber(
                  draft.benchmarks.bike10MinCalories,
                  profile.benchmarks.bike10MinCalories,
                ),
                murph: String(draft.benchmarks.murph ?? "").trim(),
                t2b: positiveNumber(
                  draft.benchmarks.t2b,
                  profile.benchmarks.t2b,
                ),
                pullUps: positiveNumber(
                  draft.benchmarks.pullUps,
                  profile.benchmarks.pullUps,
                ),
                chestToBar: positiveNumber(
                  draft.benchmarks.chestToBar,
                  profile.benchmarks.chestToBar,
                ),
                barMuscleUp:
                  Number(draft.benchmarks.barMuscleUp) >= 0
                    ? Number(draft.benchmarks.barMuscleUp)
                    : profile.benchmarks.barMuscleUp,
                ringMuscleUp:
                  Number(draft.benchmarks.ringMuscleUp) >= 0
                    ? Number(draft.benchmarks.ringMuscleUp)
                    : profile.benchmarks.ringMuscleUp,
                strictHspu:
                  Number(draft.benchmarks.strictHspu) >= 0
                    ? Number(draft.benchmarks.strictHspu)
                    : profile.benchmarks.strictHspu,
                handstandWalk:
                  Number(draft.benchmarks.handstandWalk) >= 0
                    ? Number(draft.benchmarks.handstandWalk)
                    : profile.benchmarks.handstandWalk,
                doubleUnders:
                  Number(draft.benchmarks.doubleUnders) >= 0
                    ? Number(draft.benchmarks.doubleUnders)
                    : profile.benchmarks.doubleUnders,
              },
            });
          },
        },
        h(
          "label",
          null,
          "Athlete",
          h("input", {
            id: "athleteName",
            name: "athleteName",
            type: "text",
            autoComplete: "name",
            value: draft.athleteName,
            onChange: (event) =>
              setDraft((current) => ({
                ...current,
                athleteName: event.target.value,
              })),
          }),
        ),
        h(NumberInput, {
          id: "athleteAge",
          name: "athleteAge",
          label: "Age",
          value: draft.age,
          onChange: (value) =>
            setDraft((current) => ({ ...current, age: value })),
        }),
        h(
          "label",
          null,
          "Division",
          h(
            "select",
            {
              id: "athleteDivision",
              name: "athleteDivision",
              value: draft.division || "men35to39",
              onChange: (event) =>
                setDraft((current) => ({
                  ...current,
                  division: event.target.value,
                })),
            },
            Object.entries(DIVISION_LABELS).map(([value, label]) =>
              h("option", { key: value, value }, label),
            ),
          ),
        ),
        h(NumberInput, {
          id: "bodyweight",
          name: "bodyweight",
          label: "Bodyweight kg",
          value: draft.bodyweight,
          onChange: (value) =>
            setDraft((current) => ({ ...current, bodyweight: value })),
        }),
        h(NumberInput, {
          id: "backSquatMax",
          name: "backSquatMax",
          label: "Back squat 1RM",
          value: draft.maxes.backSquat,
          onChange: (value) => updateMax("backSquat", value),
        }),
        h(NumberInput, {
          id: "frontSquatMax",
          name: "frontSquatMax",
          label: "Front squat 1RM",
          value: draft.maxes.frontSquat,
          onChange: (value) => updateMax("frontSquat", value),
        }),
        h(NumberInput, {
          id: "deadliftMax",
          name: "deadliftMax",
          label: "Deadlift 1RM",
          value: draft.maxes.deadlift,
          onChange: (value) => updateMax("deadlift", value),
        }),
        h(NumberInput, {
          id: "strictPressMax",
          name: "strictPressMax",
          label: "Strict press 1RM",
          value: draft.maxes.strictPress,
          onChange: (value) => updateMax("strictPress", value),
        }),
        h(NumberInput, {
          id: "thrusterMax",
          name: "thrusterMax",
          label: "Thruster max",
          value: draft.maxes.thruster,
          onChange: (value) => updateMax("thruster", value),
        }),
        h(NumberInput, {
          id: "snatchMax",
          name: "snatchMax",
          label: "Snatch 1RM",
          value: draft.maxes.snatch,
          onChange: (value) => updateMax("snatch", value),
        }),
        h(NumberInput, {
          id: "cleanJerkMax",
          name: "cleanJerkMax",
          label: "Clean and jerk 1RM",
          value: draft.maxes.cleanJerk,
          onChange: (value) => updateMax("cleanJerk", value),
        }),
        h(TextInput, {
          id: "row1k",
          label: "1 km row",
          value: draft.benchmarks.row1k,
          onChange: (value) => updateBenchmark("row1k", value),
          placeholder: "3:25",
        }),
        h(TextInput, {
          id: "row2k",
          label: "2 km row",
          value: draft.benchmarks.row2k,
          onChange: (value) => updateBenchmark("row2k", value),
          placeholder: "7:15",
        }),
        h(TextInput, {
          id: "run5k",
          label: "5 km run",
          value: draft.benchmarks.run5k,
          onChange: (value) => updateBenchmark("run5k", value),
          placeholder: "23:00",
        }),
        h(NumberInput, {
          id: "bike10MinCalories",
          name: "bike10MinCalories",
          label: "10 min bike calories",
          value: draft.benchmarks.bike10MinCalories,
          onChange: (value) => updateBenchmark("bike10MinCalories", value),
        }),
        h(NumberInput, {
          id: "pullUps",
          name: "pullUps",
          label: "Unbroken pull-ups",
          value: draft.benchmarks.pullUps,
          onChange: (value) => updateBenchmark("pullUps", value),
        }),
        h(NumberInput, {
          id: "chestToBar",
          name: "chestToBar",
          label: "Unbroken chest-to-bar",
          value: draft.benchmarks.chestToBar,
          onChange: (value) => updateBenchmark("chestToBar", value),
        }),
        h(NumberInput, {
          id: "t2b",
          name: "t2b",
          label: "Unbroken toes-to-bar",
          value: draft.benchmarks.t2b,
          onChange: (value) => updateBenchmark("t2b", value),
        }),
        h(NumberInput, {
          id: "barMuscleUp",
          name: "barMuscleUp",
          label: "Unbroken bar muscle-ups",
          value: draft.benchmarks.barMuscleUp,
          min: "0",
          onChange: (value) => updateBenchmark("barMuscleUp", value),
        }),
        h(NumberInput, {
          id: "ringMuscleUp",
          name: "ringMuscleUp",
          label: "Unbroken ring muscle-ups",
          value: draft.benchmarks.ringMuscleUp,
          min: "0",
          onChange: (value) => updateBenchmark("ringMuscleUp", value),
        }),
        h(NumberInput, {
          id: "strictHspu",
          name: "strictHspu",
          label: "Strict HSPU",
          value: draft.benchmarks.strictHspu,
          min: "0",
          onChange: (value) => updateBenchmark("strictHspu", value),
        }),
        h(NumberInput, {
          id: "handstandWalk",
          name: "handstandWalk",
          label: "Handstand walk meters",
          value: draft.benchmarks.handstandWalk,
          min: "0",
          onChange: (value) => updateBenchmark("handstandWalk", value),
        }),
        h(NumberInput, {
          id: "doubleUnders",
          name: "doubleUnders",
          label: "Unbroken double-unders",
          value: draft.benchmarks.doubleUnders,
          onChange: (value) => updateBenchmark("doubleUnders", value),
        }),
        h(
          "button",
          { className: "primary-button", type: "submit" },
          "Save assessment",
        ),
      ),
    );
  }

  function NumberInput({
    id = null,
    name = null,
    label,
    value,
    min = "1",
    onChange = null,
  }) {
    const valueProps = onChange
      ? {
          value,
          onChange: (event) => onChange(event.target.value),
        }
      : { defaultValue: value };
    return h(
      "label",
      null,
      label,
      h("input", {
        id,
        name,
        type: "number",
        min,
        step: "0.5",
        inputMode: "decimal",
        ...valueProps,
      }),
    );
  }

  function TextInput({ id, label, value, onChange, placeholder }) {
    return h(
      "label",
      null,
      label,
      h("input", {
        id,
        name: id,
        type: "text",
        value,
        placeholder,
        onChange: (event) => onChange(event.target.value),
      }),
    );
  }

  function RxReadinessPanel({ profile, logs }) {
    const readiness = buildRxReadiness(profile, logs);
    const priorityTests = readiness.prioritizedMissingTests.slice(0, 3);
    return h(
      "section",
      {
        className: "panel rx-readiness-panel",
        "aria-labelledby": "rxReadinessTitle",
      },
      h(
        "div",
        { className: "panel-title" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, readiness.division),
          h("h3", { id: "rxReadinessTitle" }, "RX readiness"),
        ),
        h("span", { className: "metric-pill" }, `Age ${profile.age || 36}`),
      ),
      h(
        "div",
        {
          className: `rx-level-hero rx-level-${readiness.band.id}`,
          "aria-label": `RX Level ${readiness.rxLevel} out of 100, ${readiness.band.label}`,
        },
        h(
          "div",
          { className: "rx-level-score" },
          h("p", { className: "stat-label" }, "RX Level"),
          h(
            "p",
            { className: "rx-level-value" },
            `${readiness.rxLevel}`,
            h("span", null, "/100"),
          ),
        ),
        h(
          "div",
          { className: "rx-level-context" },
          h("span", { className: "metric-pill" }, readiness.band.label),
          h(
            "div",
            {
              className: "rx-score-track",
              role: "progressbar",
              "aria-label": "Overall RX Level",
              "aria-valuemin": 1,
              "aria-valuemax": 100,
              "aria-valuenow": readiness.rxLevel,
            },
            h("span", { style: { width: `${readiness.rxLevel}%` } }),
          ),
          h("p", { className: "stat-detail" }, readiness.scoreExplanation),
        ),
      ),
      h(
        "div",
        { className: "rx-category-grid", "aria-label": "RX categories" },
        readiness.categories.map((category) =>
          h(RxCategoryCard, { category, key: category.id }),
        ),
      ),
      h(
        "section",
        { className: "rx-guidance", "aria-labelledby": "rxFocusTitle" },
        h("h4", { id: "rxFocusTitle" }, "Suggested focus"),
        h(
          "div",
          { className: "rx-focus-grid" },
          readiness.weakest.map((category) =>
            h(
              "article",
              { className: "rx-focus-card", key: category.id },
              h(
                "div",
                { className: "rx-focus-heading" },
                h("strong", null, category.label),
                h(
                  "span",
                  { className: "metric-pill" },
                  `${category.score}/100`,
                ),
              ),
              h("p", null, category.guidance),
            ),
          ),
        ),
        h("p", { className: "muted-copy" }, readiness.recommendation),
      ),
      priorityTests.length
        ? h(
            "section",
            {
              className: "rx-missing-tests",
              "aria-labelledby": "rxMissingTitle",
            },
            h(
              "div",
              { className: "rx-section-heading" },
              h("h4", { id: "rxMissingTitle" }, "Tests needed"),
              h(
                "span",
                { className: "metric-pill" },
                `${readiness.missingTests.length} missing`,
              ),
            ),
            h(
              "div",
              {
                className: "history-meta",
                "aria-label": "Priority missing RX tests",
              },
              priorityTests.map((item) =>
                h(
                  "span",
                  {
                    className: "metric-pill",
                    key: `${item.categoryId}-${item.id}`,
                  },
                  `Test needed: ${item.label}`,
                ),
              ),
            ),
            readiness.missingTests.length > priorityTests.length
              ? h(
                  "details",
                  { className: "rx-test-details" },
                  h(
                    "summary",
                    null,
                    `View all ${readiness.missingTests.length} missing tests`,
                  ),
                  h(
                    "ul",
                    null,
                    readiness.prioritizedMissingTests.map((item) =>
                      h(
                        "li",
                        { key: `all-${item.categoryId}-${item.id}` },
                        h("span", null, `Test needed: ${item.label}`),
                        ` · ${item.categoryLabel}`,
                      ),
                    ),
                  ),
                )
              : null,
          )
        : null,
    );
  }

  function RxCategoryCard({ category }) {
    const completion = Number.isInteger(category.tested)
      ? `${category.tested}/${category.total} tests`
      : null;
    return h(
      "article",
      { className: "rx-category-card" },
      h(
        "div",
        { className: "rx-category-heading" },
        h("p", { className: "stat-label" }, category.label),
        h("span", { className: "metric-pill" }, `${category.weight}% weight`),
      ),
      h("p", { className: "rx-category-value" }, `${category.score}/100`),
      h(
        "div",
        {
          className: "rx-score-track",
          role: "progressbar",
          "aria-label": `${category.label} score`,
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": category.score,
        },
        h("span", { style: { width: `${category.score}%` } }),
      ),
      completion
        ? h(
            "p",
            { className: "rx-coverage" },
            completion,
            category.missing ? ` · ${category.missing} needed` : " · complete",
          )
        : null,
      h("p", { className: "stat-detail" }, category.summary),
      h(
        "details",
        { className: "rx-score-details" },
        h("summary", null, "Why this score?"),
        h("p", null, category.explanation),
        category.contributors
          ? h(
              "ul",
              null,
              category.contributors.map((contributor) =>
                h(
                  "li",
                  { key: contributor.id },
                  `${contributor.label}: ${contributor.score}/100`,
                ),
              ),
            )
          : null,
        category.items.length
          ? h(
              "ul",
              null,
              category.items.map((item) =>
                h(
                  "li",
                  { key: item.id },
                  item.status === "missing"
                    ? `${item.label}: Test needed`
                    : `${item.label}: ${item.display} / target ${item.targetDisplay} (${item.score}/100)`,
                ),
              ),
            )
          : null,
      ),
    );
  }

  function ProgramView({
    appState,
    activeView,
    onWeekChange,
    onLogSession,
    onTimerFinish,
    onCycleStartChange,
    onSaveTrainingEvent,
    onDeleteTrainingEvent,
  }) {
    const week = WEEK_META.find((item) => item.week === appState.selectedWeek);
    const activePlan = selectActivePlan(appState);
    const programmeSessions = activePlan
      ? activePlan.sessions.map(customPlanToSession)
      : builtInCycleSessions(appState.profile);
    const schedule = buildTrainingSchedule({
      sessions: programmeSessions,
      trainingEvents: appState.trainingEvents,
      logs: appState.logs,
      cycleStartDate: appState.cycleStartDate,
    });
    const selectedSessions = programmeSessions.filter(
      (session) => Number(session.week) === Number(appState.selectedWeek),
    );
    const selectedSessionIds = new Set(
      selectedSessions.map((session) => session.id),
    );
    const weekStart = coachDateValue(
      new Date(`${appState.cycleStartDate}T12:00:00`).setDate(
        new Date(`${appState.cycleStartDate}T12:00:00`).getDate() +
          (appState.selectedWeek - 1) * 7,
      ),
    );
    const weekEndDate = new Date(`${weekStart}T12:00:00`);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = coachDateValue(weekEndDate);
    const weekEvents = schedule.filter(
      (event) =>
        selectedSessionIds.has(event.sessionId) ||
        (event.date >= weekStart && event.date <= weekEnd),
    );
    const toStoredEvent = (event, overrides = {}) => ({
      ...event,
      ...overrides,
      id: event.generated ? createId() : event.id,
      generated: undefined,
      createdAt: event.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    function moveEvent(event, date) {
      if (event.status === "completed") return;
      onSaveTrainingEvent(
        toStoredEvent(event, { date: coachDateValue(date), status: "planned" }),
      );
    }

    function swapEvent(event) {
      if (event.status === "completed") return;
      const candidate = weekEvents.find(
        (item) =>
          item.kind === "app" &&
          item.id !== event.id &&
          item.status !== "completed" &&
          item.date !== event.date,
      );
      if (!candidate) return;
      const firstDate = event.date;
      moveEvent(event, candidate.date);
      moveEvent(candidate, firstDate);
    }

    function resumeSkipped(event) {
      const today = todayInputValue();
      const plannedDates = schedule
        .filter((item) => item.status === "planned" && item.date >= today)
        .map((item) => item.date)
        .sort();
      const nextDate = plannedDates.at(-1) || today;
      const target = new Date(`${nextDate}T12:00:00`);
      target.setDate(target.getDate() + 1);
      moveEvent(event, coachDateValue(target));
    }

    return h(
      "section",
      {
        id: "calendarView",
        className: viewClass("calendarView", activeView),
        "aria-labelledby": "calendarTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h(
            "p",
            { className: "eyebrow" },
            activePlan ? "Active saved programme" : "Dated eight-week cycle",
          ),
          h("h2", { id: "calendarTitle" }, "Calendar"),
        ),
        h(WeekSelect, {
          id: "programWeek",
          label: "Programme week",
          value: appState.selectedWeek,
          onChange: onWeekChange,
        }),
      ),
      h(
        "section",
        { className: "panel calendar-controls", "aria-label": "Cycle dates" },
        h(
          "label",
          null,
          "Cycle starts",
          h("input", {
            id: "cycleStartDate",
            type: "date",
            value: appState.cycleStartDate,
            onChange: (event) => onCycleStartChange(event.target.value),
          }),
        ),
        activePlan
          ? h(
              "div",
              null,
              h("h3", null, activePlan.title),
              h(
                "p",
                { className: "muted-copy" },
                `${selectedSessions.length} progression session${selectedSessions.length === 1 ? "" : "s"} this week.`,
              ),
            )
          : h("p", { className: "muted-copy" }, `${week.title}. ${week.note}`),
      ),
      h(
        "div",
        { className: "calendar-list", id: "calendarList" },
        weekEvents.length
          ? weekEvents.map((event) => {
              const session = programmeSessions.find(
                (item) => item.id === event.sessionId,
              );
              const locked = event.status === "completed";
              return h(
                "article",
                {
                  className: `panel calendar-event event-${event.kind} status-${event.status}`,
                  key: event.id,
                },
                h(
                  "div",
                  { className: "calendar-event-heading" },
                  h(
                    "div",
                    null,
                    h(
                      "p",
                      { className: "eyebrow" },
                      `${formatDate(event.date)} · ${event.kind.toUpperCase()}`,
                    ),
                    h("h3", null, event.title || "Training event"),
                  ),
                  h("span", { className: "metric-pill" }, event.status),
                ),
                event.kind === "app" && session
                  ? h("p", { className: "muted-copy" }, session.focus)
                  : event.rawBoxText
                    ? h("p", { className: "muted-copy" }, event.rawBoxText)
                    : null,
                session
                  ? h(
                      "details",
                      { className: "calendar-session-details" },
                      h("summary", null, "Workout details and coaching intent"),
                      h(SessionCard, {
                        session,
                        tag: locked
                          ? "Logged"
                          : `${session.duration || 60} min`,
                        meta: null,
                        onLog: () =>
                          onLogSession(
                            session.logDayId || session.id,
                            session.week,
                            {
                              workoutSource: "app",
                              logDate: event.date,
                              trainingEventId: event.generated
                                ? null
                                : event.id,
                            },
                          ),
                        onTimerFinish,
                      }),
                    )
                  : null,
                !locked
                  ? h(
                      "div",
                      { className: "calendar-event-actions" },
                      h(
                        "label",
                        null,
                        "Move to",
                        h("input", {
                          type: "date",
                          value: event.date,
                          onChange: (input) =>
                            moveEvent(event, input.target.value),
                        }),
                      ),
                      event.kind === "app"
                        ? h(
                            "button",
                            {
                              className: "ghost-button",
                              type: "button",
                              onClick: () => swapEvent(event),
                            },
                            "Swap session",
                          )
                        : null,
                      event.status === "skipped"
                        ? h(
                            "button",
                            {
                              className: "primary-button",
                              type: "button",
                              onClick: () => resumeSkipped(event),
                            },
                            "Resume session",
                          )
                        : event.kind === "app"
                          ? h(
                              "button",
                              {
                                className: "ghost-button",
                                type: "button",
                                onClick: () =>
                                  onSaveTrainingEvent(
                                    toStoredEvent(event, { status: "skipped" }),
                                  ),
                              },
                              "Mark skipped",
                            )
                          : h(
                              "button",
                              {
                                className: "ghost-button danger-button",
                                type: "button",
                                onClick: () => {
                                  if (
                                    window.confirm(
                                      "Delete this calendar event?",
                                    )
                                  ) {
                                    onDeleteTrainingEvent(event.id);
                                  }
                                },
                              },
                              "Delete",
                            ),
                      event.kind === "app" && session
                        ? h(
                            "button",
                            {
                              className: "primary-button",
                              type: "button",
                              onClick: () =>
                                onLogSession(
                                  session.logDayId || session.id,
                                  session.week,
                                  {
                                    workoutSource: "app",
                                    logDate: event.date,
                                    trainingEventId: event.generated
                                      ? null
                                      : event.id,
                                  },
                                ),
                            },
                            "Mark complete / log",
                          )
                        : event.kind === "box"
                          ? h(
                              "button",
                              {
                                className: "primary-button",
                                type: "button",
                                onClick: () =>
                                  onLogSession("box", appState.selectedWeek, {
                                    workoutSource: "box",
                                    boxWorkoutTitle: event.title,
                                    logDate: event.date,
                                    trainingEventId: event.id,
                                  }),
                              },
                              "Mark complete / log",
                            )
                          : h(
                              "button",
                              {
                                className: "primary-button",
                                type: "button",
                                onClick: () =>
                                  onSaveTrainingEvent(
                                    toStoredEvent(event, {
                                      status: "completed",
                                    }),
                                  ),
                              },
                              "Mark complete",
                            ),
                    )
                  : h(
                      "p",
                      { className: "completed-lock" },
                      "Completed sessions are locked to protect training history.",
                    ),
                session && event.status !== "skipped"
                  ? h(WorkoutTimer, { session, onFinish: onTimerFinish })
                  : null,
              );
            })
          : h(
              "div",
              { className: "empty-state" },
              `No events are scheduled for week ${appState.selectedWeek}.`,
            ),
      ),
      h(
        "form",
        {
          className: "panel calendar-add-form",
          onSubmit: (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const kind = String(data.get("eventKind"));
            const rawBoxText = String(data.get("eventText") || "").trim();
            const parsed = kind === "box" ? parseBoxWorkout(rawBoxText) : null;
            const createdAt = new Date().toISOString();
            onSaveTrainingEvent({
              id: createId(),
              date: String(data.get("eventDate")),
              kind,
              status: "planned",
              sessionId: null,
              title: kind === "box" ? "CrossFit box WOD" : "Rest day",
              rawBoxText: parsed?.rawText || "",
              movementIds: parsed?.movementIds || [],
              stimuli: parsed?.stimuli || [],
              createdAt,
              updatedAt: createdAt,
            });
            event.currentTarget.reset();
          },
        },
        h("h3", null, "Add box workout or rest day"),
        h(
          "div",
          { className: "form-row" },
          h(
            "label",
            null,
            "Event",
            h(
              "select",
              { name: "eventKind", defaultValue: "box" },
              h("option", { value: "box" }, "Box workout"),
              h("option", { value: "rest" }, "Rest day"),
            ),
          ),
          h(
            "label",
            null,
            "Date",
            h("input", {
              name: "eventDate",
              type: "date",
              defaultValue: todayInputValue(),
              required: true,
            }),
          ),
        ),
        h(
          "label",
          null,
          "Box WOD (optional for rest)",
          h("textarea", { name: "eventText", rows: "3" }),
        ),
        h(
          "button",
          { className: "primary-button", type: "submit" },
          "Add to calendar",
        ),
      ),
    );
  }

  function customPlanToSession(plan) {
    return {
      id: plan.id,
      week: plan.week,
      weekday: plan.preferredDay
        ? plan.preferredDay[0].toUpperCase() + plan.preferredDay.slice(1)
        : `Week ${plan.week}`,
      shortTitle: plan.title,
      title: plan.title,
      focus: plan.focus,
      workoutDefinition: plan.workoutDefinition,
      trainingBlocks: plan.trainingBlocks || [],
      segments: customPlanSegments(plan),
      addOns: plan.addOns || [],
      duration: plan.duration,
      twoDayStrategy: Boolean(plan.twoDayStrategy),
      readinessVariant: plan.readinessVariant,
      stimuli: plan.stimuli || [],
    };
  }

  function isCustomPlanLogged(logs, plan) {
    return logs.some((log) => log.dayId === plan.id);
  }

  function customPlanMeta(plan, logged) {
    return h(
      "div",
      { className: "history-meta" },
      h("span", { className: "metric-pill" }, plan.intensity || "Moderate"),
      plan.generated
        ? h(
            "span",
            { className: "metric-pill" },
            GOAL_LABELS[plan.sourceGoal] || "Generated",
          )
        : null,
      logged ? h("span", { className: "metric-pill" }, "Logged") : null,
    );
  }

  function SessionCard({
    session,
    tag,
    meta,
    onLog,
    onEdit = null,
    onDelete = null,
    onTimerFinish,
  }) {
    traceGenerationStage("8. Object received by the React component", {
      sessionId: session.id,
      strength: session.strength,
      strengthAndSkillBlocks: session.trainingBlocks,
      finalSegments: session.segments,
    });
    const [readiness, setReadiness] = ReactRuntime.useState("normal");
    const readinessSession = session.twoDayStrategy
      ? applyReadinessVariant(session, readiness)
      : session;
    return h(
      "article",
      { className: "day-card", id: session.id },
      h(
        "div",
        { className: "day-card-header" },
        h(
          "div",
          null,
          h("p", null, session.weekday || `Week ${session.week}`),
          h("h3", null, session.shortTitle || session.title),
        ),
        h("span", { className: "tag" }, tag),
      ),
      h(
        "div",
        { className: "day-card-body" },
        meta,
        h(
          "p",
          { className: "muted-copy" },
          session.focus || "Custom training session",
        ),
        session.twoDayStrategy
          ? h(
              "label",
              null,
              "Pre-workout readiness",
              h(
                "select",
                {
                  value: readiness,
                  onChange: (event) => setReadiness(event.target.value),
                },
                h("option", { value: "low" }, "Low — reduce volume"),
                h("option", { value: "normal" }, "Normal — use the plan"),
                h("option", { value: "high" }, "High — optional accessory"),
              ),
            )
          : null,
        readiness === "low" && session.twoDayStrategy
          ? h(
              "p",
              { className: "warning-copy" },
              "Use 75% of accessory and conditioning volume. Keep technical work; avoid maximal attempts.",
            )
          : null,
        h(SegmentList, { segments: readinessSession.segments }),
        h(MovementGuides, { session: readinessSession }),
        readinessSession.addOns && readinessSession.addOns.length
          ? h(AddOnList, { addOns: readinessSession.addOns })
          : null,
        h(WorkoutTimer, { session, onFinish: onTimerFinish }),
        h(
          "div",
          { className: "quick-actions" },
          onLog
            ? h(
                "button",
                { className: "primary-button", type: "button", onClick: onLog },
                "Log session",
              )
            : null,
          onEdit
            ? h(
                "button",
                { className: "ghost-button", type: "button", onClick: onEdit },
                "Edit",
              )
            : null,
          onDelete
            ? h(
                "button",
                {
                  className: "danger-button",
                  type: "button",
                  onClick: onDelete,
                },
                "Delete",
              )
            : null,
        ),
      ),
    );
  }

  function WorkoutTimer({ session, onFinish }) {
    const config = inferWorkoutTimer(session);
    const [isOpen, setIsOpen] = ReactRuntime.useState(false);
    const [running, setRunning] = ReactRuntime.useState(false);
    const [startedAt, setStartedAt] = ReactRuntime.useState(null);
    const [baseElapsed, setBaseElapsed] = ReactRuntime.useState(0);
    const [tick, setTick] = ReactRuntime.useState(Date.now());
    const [splits, setSplits] = ReactRuntime.useState([]);
    const [completed, setCompleted] = ReactRuntime.useState(null);

    ReactRuntime.useEffect(() => {
      if (!running) return undefined;
      const interval = window.setInterval(() => setTick(Date.now()), 500);
      return () => window.clearInterval(interval);
    }, [running]);

    if (!config) return null;

    const elapsed =
      running && startedAt
        ? baseElapsed + Math.floor((tick - startedAt) / 1000)
        : baseElapsed;
    const currentRound = config.intervalSeconds
      ? Math.min(
          config.rounds || 999,
          Math.floor(elapsed / config.intervalSeconds) + 1,
        )
      : null;
    const displayTime = formatTimerSeconds(
      timerDisplaySeconds(config.mode, config.plannedSeconds, elapsed),
    );

    function startTimer() {
      setCompleted(null);
      setRunning(true);
      setStartedAt(Date.now());
      setTick(Date.now());
    }

    function pauseTimer() {
      setBaseElapsed(elapsed);
      setRunning(false);
      setStartedAt(null);
    }

    function resetTimer() {
      setRunning(false);
      setStartedAt(null);
      setBaseElapsed(0);
      setTick(Date.now());
      setSplits([]);
      setCompleted(null);
    }

    function addSplit() {
      const nextSplit = {
        label: `Split ${splits.length + 1}`,
        elapsedSeconds: elapsed,
      };
      setSplits((current) => [...current, nextSplit]);
    }

    function finishTimer() {
      const result = {
        mode: config.mode,
        source: config.source,
        workout: config.workout,
        startedAt: startedAt
          ? new Date(startedAt).toISOString()
          : new Date().toISOString(),
        completedAt: new Date().toISOString(),
        elapsedSeconds: elapsed,
        plannedSeconds: config.plannedSeconds,
        rounds: config.rounds,
        intervalSeconds: config.intervalSeconds,
        splits,
        status: "completed",
      };
      setBaseElapsed(elapsed);
      setRunning(false);
      setStartedAt(null);
      setCompleted(result);
      if (onFinish) onFinish(session, result);
    }

    return h(
      "section",
      { className: "timer-panel", "aria-label": `${config.label} timer` },
      !isOpen
        ? h(
            "button",
            {
              className: "ghost-button",
              type: "button",
              onClick: () => setIsOpen(true),
            },
            "Start timer",
          )
        : null,
      isOpen
        ? h(
            ReactRuntime.Fragment,
            null,
            h(
              "div",
              { className: "timer-display" },
              h(
                "div",
                null,
                h("p", { className: "eyebrow" }, config.label),
                h("strong", null, displayTime),
              ),
              h(
                "span",
                { className: "metric-pill" },
                currentRound
                  ? `Round ${currentRound}`
                  : timerStateLabel(running, completed),
              ),
            ),
            h("p", { className: "muted-copy" }, config.workout),
            splits.length
              ? h(
                  "ol",
                  { className: "timer-splits" },
                  splits.map((split) =>
                    h(
                      "li",
                      { key: split.label },
                      `${split.label} - ${formatTimerSeconds(split.elapsedSeconds)}`,
                    ),
                  ),
                )
              : null,
            h(
              "div",
              { className: "quick-actions" },
              !running
                ? h(
                    "button",
                    {
                      className: "primary-button",
                      type: "button",
                      onClick: startTimer,
                    },
                    elapsed ? "Resume" : "Start",
                  )
                : null,
              running
                ? h(
                    "button",
                    {
                      className: "ghost-button",
                      type: "button",
                      onClick: pauseTimer,
                    },
                    "Pause",
                  )
                : null,
              h(
                "button",
                {
                  className: "ghost-button",
                  type: "button",
                  onClick: addSplit,
                  disabled: !elapsed,
                },
                "Split",
              ),
              h(
                "button",
                {
                  className: "primary-button",
                  type: "button",
                  onClick: finishTimer,
                  disabled: !elapsed,
                },
                "Finish and log",
              ),
              h(
                "button",
                {
                  className: "ghost-button",
                  type: "button",
                  onClick: resetTimer,
                },
                "Reset",
              ),
            ),
          )
        : null,
    );
  }

  function ProofView({ appState, activeView, onFinish }) {
    const activePlan = selectActivePlan(appState);
    const programmeSessions = activePlan
      ? selectActiveWeekSessions(appState, appState.selectedWeek).map(
          customPlanToSession,
        )
      : getProgramDays().map((day) =>
          buildSession(day.id, appState.selectedWeek, appState.profile),
        );
    const allSessions = programmeSessions;
    const initialSession = allSessions[0];
    const customSessionId = ReactRuntime.useRef(`competition-${createId()}`);
    const [sourceId, setSourceId] = ReactRuntime.useState(
      initialSession?.id || "custom",
    );
    const [draft, setDraft] = ReactRuntime.useState(() =>
      proofDraftFromSession(initialSession),
    );

    ReactRuntime.useEffect(() => {
      if (sourceId === "custom") return;
      const refreshedSession = programmeSessions.find(
        (session) => session.id === sourceId,
      );
      const nextSession = refreshedSession || programmeSessions[0];
      if (!nextSession) {
        setSourceId("custom");
        setDraft(proofDraftFromSession(null));
        return;
      }
      if (!refreshedSession) setSourceId(nextSession.id);
      setDraft(proofDraftFromSession(nextSession));
    }, [appState.activePlanId, appState.plans, appState.selectedWeek]);

    const selectedSession = allSessions.find(
      (session) => session.id === sourceId,
    );
    const session = proofSessionFromDraft(
      selectedSession,
      draft,
      appState.selectedWeek,
      customSessionId.current,
    );
    const config = proofTimerConfig(draft);
    const canRecord = Boolean(draft.title.trim() && draft.workout.trim());

    function updateDraft(key, value) {
      setDraft((current) => ({ ...current, [key]: value }));
    }

    function selectSource(nextSourceId) {
      setSourceId(nextSourceId);
      if (nextSourceId === "custom") {
        setDraft({
          title: "Competition workout",
          workout: "",
          mode: "forTime",
          durationMinutes: 20,
          intervalSeconds: 60,
          countdownSeconds: 3,
        });
        return;
      }
      setDraft(
        proofDraftFromSession(
          allSessions.find((item) => item.id === nextSourceId),
        ),
      );
    }

    return h(
      "section",
      {
        id: "proofView",
        className: viewClass("proofView", activeView),
        "aria-labelledby": "proofSetupTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Competition"),
          h("h2", { id: "proofSetupTitle" }, "Competition proof"),
        ),
      ),
      h(
        "form",
        {
          className: "panel proof-setup-form",
          onSubmit: (event) => event.preventDefault(),
        },
        h(
          "label",
          null,
          "Workout source",
          h(
            "select",
            {
              value: sourceId,
              onChange: (event) => selectSource(event.target.value),
            },
            h("option", { value: "custom" }, "Custom competition workout"),
            h(
              "optgroup",
              {
                label: `${activePlan?.title || "Built-in programme"} - Week ${appState.selectedWeek}`,
              },
              programmeSessions.map((item) =>
                h(
                  "option",
                  { key: item.id, value: item.id },
                  `${item.weekday} - ${item.shortTitle}`,
                ),
              ),
            ),
          ),
        ),
        h(
          "label",
          null,
          "Workout name",
          h("input", {
            type: "text",
            required: true,
            value: draft.title,
            onChange: (event) => updateDraft("title", event.target.value),
          }),
        ),
        h(
          "label",
          null,
          "Workout details",
          h("textarea", {
            rows: "4",
            required: true,
            value: draft.workout,
            onChange: (event) => updateDraft("workout", event.target.value),
          }),
        ),
        h(
          "div",
          { className: "form-row" },
          h(
            "label",
            null,
            "Timer mode",
            h(
              "select",
              {
                value: draft.mode,
                onChange: (event) => updateDraft("mode", event.target.value),
              },
              h("option", { value: "forTime" }, "For time / time cap"),
              h("option", { value: "amrap" }, "AMRAP"),
              h("option", { value: "emom" }, "EMOM"),
              h("option", { value: "interval" }, "Intervals"),
            ),
          ),
          h(
            "label",
            null,
            "Duration or time cap (minutes)",
            h("input", {
              type: "number",
              min: "1",
              max: "180",
              step: "1",
              inputMode: "numeric",
              value: draft.durationMinutes,
              onChange: (event) =>
                updateDraft("durationMinutes", event.target.value),
            }),
          ),
        ),
        h(
          "div",
          { className: "form-row" },
          draft.mode === "interval"
            ? h(
                "label",
                null,
                "Interval length (seconds)",
                h("input", {
                  type: "number",
                  min: "10",
                  max: "3600",
                  step: "5",
                  inputMode: "numeric",
                  value: draft.intervalSeconds,
                  onChange: (event) =>
                    updateDraft("intervalSeconds", event.target.value),
                }),
              )
            : null,
          h(
            "label",
            null,
            "Countdown (seconds)",
            h("input", {
              type: "number",
              min: "0",
              max: "10",
              step: "1",
              inputMode: "numeric",
              value: draft.countdownSeconds,
              onChange: (event) =>
                updateDraft("countdownSeconds", event.target.value),
            }),
          ),
        ),
        h(
          "div",
          { className: "proof-config-actions" },
          h(
            "div",
            { className: "history-meta" },
            h("span", { className: "metric-pill" }, config.label),
            h(
              "span",
              { className: "metric-pill" },
              formatTimerSeconds(config.plannedSeconds),
            ),
          ),
          h(CompetitionProofRecorder, {
            athleteName: appState.profile.athleteName,
            buttonLabel: "Open camera",
            config,
            disabled: !canRecord,
            session,
            onFinish,
          }),
        ),
      ),
    );
  }

  function proofDraftFromSession(session) {
    const timer = session ? inferWorkoutTimer(session) : null;
    const supportedMode = ["forTime", "amrap", "emom", "interval"].includes(
      timer?.mode,
    )
      ? timer.mode
      : "forTime";
    return {
      title: session?.shortTitle || session?.title || "Competition workout",
      workout: timer?.workout || "",
      mode: supportedMode,
      durationMinutes: Math.max(
        1,
        Math.round(Number(timer?.plannedSeconds || 1200) / 60),
      ),
      intervalSeconds: Number(timer?.intervalSeconds) || 60,
      countdownSeconds: 3,
    };
  }

  function proofSessionFromDraft(
    selectedSession,
    draft,
    selectedWeek,
    customSessionId,
  ) {
    const duration = clamp(Number(draft.durationMinutes) || 20, 1, 180);
    const title = draft.title.trim() || "Competition workout";
    return {
      ...(selectedSession || {}),
      id: selectedSession?.id || customSessionId,
      week: selectedSession?.week || selectedWeek,
      weekday: selectedSession?.weekday || "Competition",
      shortTitle: title,
      title,
      focus: "Competition proof",
      segments: [
        {
          title: "WOD",
          minutes: String(duration),
          items: [draft.workout.trim()],
        },
      ],
    };
  }

  function proofTimerConfig(draft) {
    const mode = ["forTime", "amrap", "emom", "interval"].includes(draft.mode)
      ? draft.mode
      : "forTime";
    const durationMinutes = clamp(Number(draft.durationMinutes) || 20, 1, 180);
    const plannedSeconds = durationMinutes * 60;
    const intervalSeconds =
      mode === "emom"
        ? 60
        : mode === "interval"
          ? clamp(Number(draft.intervalSeconds) || 60, 10, 3600)
          : null;
    const labels = {
      amrap: "AMRAP",
      emom: "EMOM",
      forTime: "For time",
      interval: "Intervals",
    };
    return {
      mode,
      label: labels[mode],
      source: "competition-proof",
      workout: draft.workout.trim(),
      plannedSeconds,
      intervalSeconds,
      rounds: intervalSeconds
        ? Math.max(1, Math.ceil(plannedSeconds / intervalSeconds))
        : null,
      countdownSeconds: clamp(Number(draft.countdownSeconds) || 0, 0, 10),
    };
  }

  function CompetitionProofRecorder({
    athleteName = "Intermediate athlete",
    buttonLabel = "Competition proof",
    config,
    disabled = false,
    session,
    onFinish,
  }) {
    const [isOpen, setIsOpen] = ReactRuntime.useState(false);
    const [phase, setPhase] = ReactRuntime.useState("idle");
    const [error, setError] = ReactRuntime.useState("");
    const [streamReady, setStreamReady] = ReactRuntime.useState(false);
    const [countdown, setCountdown] = ReactRuntime.useState(null);
    const [startedAtMs, setStartedAtMs] = ReactRuntime.useState(null);
    const [tick, setTick] = ReactRuntime.useState(Date.now());
    const [splits, setSplits] = ReactRuntime.useState([]);
    const [interruptions, setInterruptions] = ReactRuntime.useState([]);
    const [videoBlob, setVideoBlob] = ReactRuntime.useState(null);
    const [videoUrl, setVideoUrl] = ReactRuntime.useState("");
    const [overlayEmbedded, setOverlayEmbedded] = ReactRuntime.useState(false);
    const [finalResult, setFinalResult] = ReactRuntime.useState(null);
    const [exportConfirmed, setExportConfirmed] = ReactRuntime.useState(false);
    const [temporaryStorageMode, setTemporaryStorageMode] =
      ReactRuntime.useState("");
    const previewRef = ReactRuntime.useRef(null);
    const canvasRef = ReactRuntime.useRef(null);
    const streamRef = ReactRuntime.useRef(null);
    const recorderRef = ReactRuntime.useRef(null);
    const compositeStreamRef = ReactRuntime.useRef(null);
    const chunkSinkRef = ReactRuntime.useRef(null);
    const countdownTimerRef = ReactRuntime.useRef(null);
    const interruptionsRef = ReactRuntime.useRef([]);
    const proofUiRef = ReactRuntime.useRef({});
    const videoUrlRef = ReactRuntime.useRef("");
    const startedAtRef = ReactRuntime.useRef(null);
    const splitsRef = ReactRuntime.useRef([]);
    const overlayEmbeddedRef = ReactRuntime.useRef(false);
    const pendingResultRef = ReactRuntime.useRef(null);

    const elapsed = startedAtMs
      ? phase === "review" && finalResult
        ? finalResult.timerResult.elapsedSeconds
        : Math.max(0, Math.floor((tick - startedAtMs) / 1000))
      : 0;
    const displayTime = formatTimerSeconds(
      timerDisplaySeconds(config.mode, config.plannedSeconds, elapsed),
    );
    const currentRound = config.intervalSeconds
      ? Math.min(
          config.rounds || 999,
          Math.floor(elapsed / config.intervalSeconds) + 1,
        )
      : null;

    proofUiRef.current = {
      athleteName,
      displayTime,
      phase,
      roundLabel: currentRound ? `Round ${currentRound}` : config.label,
      workout: config.workout,
    };

    ReactRuntime.useEffect(() => {
      if (phase !== "recording") return undefined;
      const interval = window.setInterval(() => setTick(Date.now()), 250);
      return () => window.clearInterval(interval);
    }, [phase]);

    ReactRuntime.useEffect(() => {
      if (!isOpen || !streamReady) return undefined;
      const video = previewRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return undefined;
      const context = canvas.getContext("2d");
      if (!context) return undefined;
      let frameId;

      const drawFrame = () => {
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 1280;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        if (video.readyState >= 2) {
          context.drawImage(video, 0, 0, width, height);
          drawProofOverlay(context, width, height, proofUiRef.current);
        }
        frameId = window.requestAnimationFrame(drawFrame);
      };

      drawFrame();
      return () => window.cancelAnimationFrame(frameId);
    }, [isOpen, streamReady]);

    ReactRuntime.useEffect(() => {
      if (!isOpen) return undefined;

      const markBackgrounded = () => {
        if (document.hidden && recorderRef.current?.state === "recording") {
          markInterruption("App backgrounded or screen locked");
        }
      };
      const warnBeforeUnload = (event) => {
        if (recorderRef.current?.state !== "recording") return;
        event.preventDefault();
        event.returnValue = "";
      };

      document.addEventListener("visibilitychange", markBackgrounded);
      window.addEventListener("beforeunload", warnBeforeUnload);
      return () => {
        document.removeEventListener("visibilitychange", markBackgrounded);
        window.removeEventListener("beforeunload", warnBeforeUnload);
      };
    }, [isOpen]);

    ReactRuntime.useEffect(() => {
      return () => {
        window.clearTimeout(countdownTimerRef.current);
        discardProofRecorder(recorderRef);
        discardProofChunkSink(chunkSinkRef.current);
        stopMediaStream(streamRef.current);
        stopCompositeStream(compositeStreamRef.current);
        if (videoUrlRef.current)
          window.URL.revokeObjectURL(videoUrlRef.current);
      };
    }, []);

    function markInterruption(reason) {
      const interruption = {
        reason,
        at: new Date().toISOString(),
      };
      interruptionsRef.current = [...interruptionsRef.current, interruption];
      setInterruptions(interruptionsRef.current);
    }

    async function openProofMode() {
      setIsOpen(true);
      await requestCamera();
    }

    async function requestCamera() {
      discardProofRecorder(recorderRef);
      discardProofChunkSink(chunkSinkRef.current);
      chunkSinkRef.current = null;
      stopMediaStream(streamRef.current);
      stopCompositeStream(compositeStreamRef.current);
      streamRef.current = null;
      compositeStreamRef.current = null;
      setError("");
      setPhase("loading");
      setStreamReady(false);

      if (!supportsCompetitionRecording()) {
        setError(
          "Competition recording is not supported in this browser. Use current iPhone Safari over HTTPS.",
        );
        setPhase("error");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
          },
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
        });
        streamRef.current = stream;
        setStreamReady(true);
        setPhase("ready");
        window.requestAnimationFrame(() => {
          if (!previewRef.current) return;
          previewRef.current.srcObject = stream;
          const playResult = previewRef.current.play();
          if (playResult && typeof playResult.catch === "function") {
            playResult.catch(() => undefined);
          }
        });
      } catch (cameraError) {
        setError(proofCameraErrorMessage(cameraError));
        setPhase("error");
      }
    }

    function startProofCountdown() {
      setError("");
      setSplits([]);
      setFinalResult(null);
      setVideoBlob(null);
      setExportConfirmed(false);
      interruptionsRef.current = [];
      setInterruptions([]);
      splitsRef.current = [];
      pendingResultRef.current = null;
      let remaining = clamp(Number(config.countdownSeconds) || 0, 0, 10);
      if (!remaining) {
        setCountdown(null);
        beginProofRecording();
        return;
      }
      setPhase("countdown");
      setCountdown(remaining);

      const advance = () => {
        remaining -= 1;
        if (remaining > 0) {
          setCountdown(remaining);
          countdownTimerRef.current = window.setTimeout(advance, 1000);
          return;
        }
        setCountdown(null);
        beginProofRecording();
      };
      countdownTimerRef.current = window.setTimeout(advance, 1000);
    }

    async function beginProofRecording() {
      const cameraStream = streamRef.current;
      if (!cameraStream) {
        setError("Camera stream was lost. Reopen proof mode and try again.");
        setPhase("error");
        return;
      }

      let recordingStream = cameraStream;
      let embedsOverlay = false;
      const canvas = canvasRef.current;

      if (canvas && typeof canvas.captureStream === "function") {
        const compositeStream = canvas.captureStream(30);
        cameraStream
          .getAudioTracks()
          .forEach((track) => compositeStream.addTrack(track));
        compositeStreamRef.current = compositeStream;
        recordingStream = compositeStream;
        embedsOverlay = true;
      }

      try {
        const mimeType = preferredProofMimeType();
        chunkSinkRef.current = await createProofChunkSink(mimeType);
        setTemporaryStorageMode(chunkSinkRef.current.mode);
        const recorder = new window.MediaRecorder(
          recordingStream,
          mimeType
            ? {
                mimeType,
                videoBitsPerSecond: 2500000,
                audioBitsPerSecond: 128000,
              }
            : undefined,
        );
        recorderRef.current = recorder;
        setOverlayEmbedded(embedsOverlay);
        overlayEmbeddedRef.current = embedsOverlay;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) {
            chunkSinkRef.current?.write(event.data);
          }
        };
        recorder.onerror = () => {
          markInterruption("Recorder error");
          setError(
            "The recording stopped unexpectedly. Review camera access and available storage.",
          );
          setPhase("error");
        };
        recorder.onstop = () => completeProofVideo(recorder);

        const started = Date.now();
        recorder.start(1000);
        startedAtRef.current = started;
        setStartedAtMs(started);
        setTick(started);
        setPhase("recording");
      } catch {
        discardProofChunkSink(chunkSinkRef.current);
        chunkSinkRef.current = null;
        stopCompositeStream(compositeStreamRef.current);
        compositeStreamRef.current = null;
        setError(
          "This browser could not start video recording. Check storage space and update iOS before retrying.",
        );
        setPhase("error");
      }
    }

    function addProofSplit() {
      const nextSplits = [
        ...splitsRef.current,
        {
          label: `Split ${splitsRef.current.length + 1}`,
          elapsedSeconds: elapsed,
        },
      ];
      splitsRef.current = nextSplits;
      setSplits(nextSplits);
    }

    function finishProofRecording() {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        setError(
          "The recorder is no longer active. Close proof mode and try again.",
        );
        setPhase("error");
        return;
      }

      const result = buildProofResult();
      pendingResultRef.current = result;
      setFinalResult(result);
      setPhase("finishing");
      recorder.stop();
    }

    function buildProofResult(unexpectedStopReason = "") {
      if (unexpectedStopReason) markInterruption(unexpectedStopReason);
      const completedAt = new Date().toISOString();
      const started = startedAtRef.current || Date.now();
      const elapsedSeconds = Math.max(
        1,
        Math.floor((Date.now() - started) / 1000),
      );
      const timerResult = {
        mode: config.mode,
        source: config.source,
        workout: config.workout,
        startedAt: new Date(started).toISOString(),
        completedAt,
        elapsedSeconds,
        plannedSeconds: config.plannedSeconds,
        rounds: config.rounds,
        intervalSeconds: config.intervalSeconds,
        splits: splitsRef.current,
        status: "completed",
      };
      return {
        timerResult,
        competitionProof: {
          version: 1,
          proofId: createId(),
          recorded: true,
          athleteName,
          workoutTitle: session.shortTitle || session.title,
          startedAt: timerResult.startedAt,
          completedAt,
          durationSeconds: elapsedSeconds,
          interrupted: interruptionsRef.current.length > 0,
          interruptions: interruptionsRef.current,
          overlayEmbedded: overlayEmbeddedRef.current,
          temporaryStorage: chunkSinkRef.current?.mode || "memory",
        },
      };
    }

    async function completeProofVideo(recorder) {
      const mimeType =
        recorder.mimeType || preferredProofMimeType() || "video/mp4";
      const result =
        pendingResultRef.current ||
        buildProofResult("Recorder stopped unexpectedly");
      pendingResultRef.current = result;
      stopCompositeStream(compositeStreamRef.current);
      compositeStreamRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      setStreamReady(false);

      let blob;
      try {
        blob = await chunkSinkRef.current?.finish();
      } catch {
        blob = null;
      }

      if (!blob || !blob.size) {
        setError(
          "The video file was empty. Free device storage and record again.",
        );
        setPhase("error");
        return;
      }

      if (videoUrl) window.URL.revokeObjectURL(videoUrl);
      const nextUrl = window.URL.createObjectURL(blob);
      videoUrlRef.current = nextUrl;
      setVideoBlob(blob);
      setVideoUrl(nextUrl);
      setFinalResult({
        ...result,
        competitionProof: {
          ...result.competitionProof,
          mimeType,
          fileName: proofFileName(session, mimeType),
        },
      });
      setPhase("review");
    }

    async function shareProofVideo() {
      if (!videoBlob || !finalResult) return;
      const fileName =
        finalResult.competitionProof.fileName ||
        proofFileName(session, videoBlob.type);
      const file = new window.File([videoBlob], fileName, {
        type: videoBlob.type,
      });

      if (
        typeof navigator.share !== "function" ||
        (typeof navigator.canShare === "function" &&
          !navigator.canShare({ files: [file] }))
      ) {
        setError("Direct sharing is unavailable. Use Save video instead.");
        return;
      }

      try {
        await navigator.share({
          files: [file],
          title: `${session.shortTitle || session.title} competition proof`,
        });
        setExportConfirmed(true);
      } catch (shareError) {
        if (shareError?.name !== "AbortError") {
          setError("The video could not be shared. Use Save video instead.");
        }
      }
    }

    function finishProofToLog() {
      if (!finalResult || !exportConfirmed) return;
      const { timerResult, competitionProof } = finalResult;
      closeProofMode(true);
      if (onFinish)
        onFinish(session, timerResult, {
          ...competitionProof,
          exportedAt: new Date().toISOString(),
        });
    }

    async function retakeProof() {
      if (videoUrl) window.URL.revokeObjectURL(videoUrl);
      videoUrlRef.current = "";
      setVideoUrl("");
      setVideoBlob(null);
      setFinalResult(null);
      setExportConfirmed(false);
      setTemporaryStorageMode("");
      setStartedAtMs(null);
      setSplits([]);
      splitsRef.current = [];
      pendingResultRef.current = null;
      await requestCamera();
    }

    function closeProofMode(force = false) {
      const hasUnsavedVideo = ["recording", "finishing", "review"].includes(
        phase,
      );
      if (
        !force &&
        hasUnsavedVideo &&
        !window.confirm("Close and discard this competition recording?")
      ) {
        return;
      }

      window.clearTimeout(countdownTimerRef.current);
      discardProofRecorder(recorderRef);
      discardProofChunkSink(chunkSinkRef.current);
      chunkSinkRef.current = null;
      stopCompositeStream(compositeStreamRef.current);
      stopMediaStream(streamRef.current);
      compositeStreamRef.current = null;
      streamRef.current = null;
      if (videoUrl) window.URL.revokeObjectURL(videoUrl);
      videoUrlRef.current = "";
      setIsOpen(false);
      setPhase("idle");
      setError("");
      setVideoUrl("");
      setVideoBlob(null);
      setFinalResult(null);
      setExportConfirmed(false);
      setStartedAtMs(null);
      setCountdown(null);
      setSplits([]);
      setStreamReady(false);
    }

    const proofFile = finalResult?.competitionProof?.fileName;

    return h(
      ReactRuntime.Fragment,
      null,
      h(
        "button",
        {
          className: "primary-button",
          type: "button",
          onClick: openProofMode,
          disabled,
        },
        buttonLabel,
      ),
      isOpen
        ? h(
            "section",
            {
              className: "proof-modal",
              role: "dialog",
              "aria-modal": "true",
              "aria-labelledby": "proofTitle",
            },
            h(
              "header",
              { className: "proof-header" },
              h(
                "div",
                null,
                h("p", { className: "eyebrow" }, "Competition proof"),
                h(
                  "h2",
                  { id: "proofTitle" },
                  session.shortTitle || session.title,
                ),
              ),
              h(
                "button",
                {
                  className: "proof-close",
                  type: "button",
                  onClick: () => closeProofMode(false),
                  "aria-label": "Close proof mode",
                },
                "Close",
              ),
            ),
            h(
              "div",
              { className: "proof-stage" },
              phase === "review" && videoUrl
                ? h("video", {
                    className: "proof-video",
                    src: videoUrl,
                    controls: true,
                    playsInline: true,
                  })
                : h("video", {
                    className: "proof-video",
                    ref: previewRef,
                    autoPlay: true,
                    muted: true,
                    playsInline: true,
                  }),
              h("canvas", {
                className: "proof-canvas",
                ref: canvasRef,
                "aria-hidden": "true",
              }),
              phase !== "review"
                ? h(
                    "div",
                    { className: "proof-overlay" },
                    h(
                      "div",
                      { className: "proof-overlay-top" },
                      h("strong", null, athleteName),
                      h(
                        "span",
                        { className: `proof-recording-state is-${phase}` },
                        phase === "recording" ? "REC" : config.label,
                      ),
                    ),
                    h(
                      "div",
                      { className: "proof-overlay-bottom" },
                      h(
                        "span",
                        null,
                        currentRound ? `Round ${currentRound}` : config.label,
                      ),
                      h("strong", null, countdown || displayTime),
                    ),
                  )
                : null,
            ),
            h(
              "div",
              { className: "proof-details" },
              h("p", null, config.workout),
              error
                ? h("p", { className: "proof-error", role: "alert" }, error)
                : null,
              phase === "ready" && !overlayEmbedded
                ? h(
                    "p",
                    { className: "muted-copy" },
                    "The timer overlay will be embedded when this browser supports canvas recording.",
                  )
                : null,
              interruptions.length
                ? h(
                    "p",
                    { className: "proof-warning" },
                    `${interruptions.length} recording interruption${interruptions.length === 1 ? "" : "s"} marked.`,
                  )
                : null,
              phase === "recording" && temporaryStorageMode === "memory"
                ? h(
                    "p",
                    { className: "proof-warning" },
                    "Temporary file storage is unavailable. This video is buffered in memory; keep the recording short and export it immediately.",
                  )
                : null,
              splits.length
                ? h(
                    "p",
                    { className: "muted-copy" },
                    `${splits.length} split${splits.length === 1 ? "" : "s"} captured.`,
                  )
                : null,
              h(
                "div",
                { className: "proof-actions" },
                phase === "loading"
                  ? h("span", { className: "metric-pill" }, "Opening camera")
                  : null,
                phase === "ready"
                  ? h(
                      "button",
                      {
                        className: "primary-button",
                        type: "button",
                        onClick: startProofCountdown,
                      },
                      config.countdownSeconds
                        ? `Start ${config.countdownSeconds}-second countdown`
                        : "Start recording",
                    )
                  : null,
                phase === "countdown"
                  ? h("strong", { className: "proof-countdown" }, countdown)
                  : null,
                phase === "recording"
                  ? h(
                      ReactRuntime.Fragment,
                      null,
                      h(
                        "button",
                        {
                          className: "ghost-button",
                          type: "button",
                          onClick: addProofSplit,
                        },
                        "Split",
                      ),
                      h(
                        "button",
                        {
                          className: "primary-button",
                          type: "button",
                          onClick: finishProofRecording,
                        },
                        "Finish recording",
                      ),
                    )
                  : null,
                phase === "finishing"
                  ? h("span", { className: "metric-pill" }, "Preparing video")
                  : null,
                phase === "review"
                  ? h(
                      ReactRuntime.Fragment,
                      null,
                      typeof navigator.share === "function"
                        ? h(
                            "button",
                            {
                              className: "ghost-button",
                              type: "button",
                              onClick: shareProofVideo,
                            },
                            "Share video",
                          )
                        : null,
                      h(
                        "a",
                        {
                          className: "ghost-button proof-download",
                          href: videoUrl,
                          download: proofFile,
                          onClick: () => setExportConfirmed(true),
                        },
                        "Save video",
                      ),
                      h(
                        "button",
                        {
                          className: "ghost-button",
                          type: "button",
                          onClick: retakeProof,
                        },
                        "Retake",
                      ),
                      h(
                        "button",
                        {
                          className: "primary-button",
                          type: "button",
                          onClick: finishProofToLog,
                          disabled: !exportConfirmed,
                        },
                        exportConfirmed
                          ? "Continue to workout log"
                          : "Save or share before continuing",
                      ),
                    )
                  : null,
                phase === "error"
                  ? h(
                      "button",
                      {
                        className: "primary-button",
                        type: "button",
                        onClick: requestCamera,
                      },
                      "Retry camera",
                    )
                  : null,
              ),
            ),
          )
        : null,
    );
  }

  function supportsCompetitionRecording() {
    return Boolean(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window.MediaRecorder === "function",
    );
  }

  function preferredProofMimeType() {
    if (typeof window.MediaRecorder !== "function") return "";
    const mimeTypes = [
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    if (typeof window.MediaRecorder.isTypeSupported !== "function") return "";
    return (
      mimeTypes.find((mimeType) =>
        window.MediaRecorder.isTypeSupported(mimeType),
      ) || ""
    );
  }

  function proofCameraErrorMessage(error) {
    if (error?.name === "NotAllowedError") {
      return "Camera or microphone access was denied. Allow both permissions in Safari settings and retry.";
    }
    if (error?.name === "NotFoundError") {
      return "No available camera or microphone was found on this device.";
    }
    if (error?.name === "NotReadableError") {
      return "The camera is already in use by another app. Close it and retry.";
    }
    return "The camera could not be opened. Use HTTPS, check permissions, and retry.";
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== "function") return;
    stream.getTracks().forEach((track) => track.stop());
  }

  function discardProofRecorder(recorderRef) {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // The browser already stopped the recorder.
      }
    }
    recorderRef.current = null;
  }

  async function createProofChunkSink(mimeType) {
    if (
      !navigator.storage ||
      typeof navigator.storage.getDirectory !== "function"
    ) {
      return createMemoryProofChunkSink(mimeType);
    }

    try {
      const root = await navigator.storage.getDirectory();
      const fileName = `forge-hour-proof-${createId()}.tmp`;
      const fileHandle = await root.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      let writeChain = Promise.resolve();
      let closed = false;

      return {
        mode: "opfs",
        write(chunk) {
          writeChain = writeChain.then(() => writable.write(chunk));
        },
        async finish() {
          await writeChain;
          if (!closed) {
            await writable.close();
            closed = true;
          }
          const file = await fileHandle.getFile();
          return file.slice(0, file.size, mimeType || file.type);
        },
        async discard() {
          try {
            await writeChain;
            if (!closed) {
              if (typeof writable.abort === "function") {
                await writable.abort();
              } else {
                await writable.close();
              }
              closed = true;
            }
          } finally {
            await root.removeEntry(fileName).catch(() => undefined);
          }
        },
      };
    } catch {
      return createMemoryProofChunkSink(mimeType);
    }
  }

  function createMemoryProofChunkSink(mimeType) {
    let chunks = [];
    return {
      mode: "memory",
      write(chunk) {
        chunks.push(chunk);
      },
      async finish() {
        const blob = new Blob(chunks, { type: mimeType || "video/mp4" });
        chunks = [];
        return blob;
      },
      async discard() {
        chunks = [];
      },
    };
  }

  function discardProofChunkSink(sink) {
    if (!sink || typeof sink.discard !== "function") return;
    Promise.resolve(sink.discard()).catch(() => undefined);
  }

  function stopCompositeStream(stream) {
    if (!stream || typeof stream.getVideoTracks !== "function") return;
    stream.getVideoTracks().forEach((track) => track.stop());
  }

  function proofFileName(session, mimeType) {
    const title = String(session.shortTitle || session.title || "workout")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
    const extension = String(mimeType).includes("webm") ? "webm" : "mp4";
    return `competition-proof-${todayInputValue()}-${title || "workout"}.${extension}`;
  }

  function drawProofOverlay(context, width, height, details) {
    const unit = Math.max(16, Math.round(Math.min(width, height) * 0.026));
    const padding = unit;
    const footerHeight = unit * 6.8;
    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    context.fillRect(0, height - footerHeight, width, footerHeight);
    context.fillStyle = "#ffffff";
    context.font = `700 ${unit}px system-ui, sans-serif`;
    context.fillText(
      details.athleteName,
      padding,
      height - footerHeight + unit * 1.45,
    );
    context.font = `600 ${Math.round(unit * 0.8)}px system-ui, sans-serif`;
    drawWrappedCanvasText(
      context,
      details.workout,
      padding,
      height - footerHeight + unit * 2.55,
      width - padding * 2,
      unit * 0.95,
      2,
    );
    context.font = `800 ${Math.round(unit * 2.25)}px ui-monospace, monospace`;
    context.fillText(details.displayTime, padding, height - unit * 0.75);
    context.textAlign = "right";
    context.font = `700 ${unit}px system-ui, sans-serif`;
    context.fillStyle = details.phase === "recording" ? "#ff5b4d" : "#ffffff";
    context.fillText(
      details.phase === "recording"
        ? `REC  ${details.roundLabel}`
        : details.roundLabel,
      width - padding,
      height - unit,
    );
    context.restore();
  }

  function drawWrappedCanvasText(
    context,
    text,
    x,
    y,
    maxWidth,
    lineHeight,
    maxLines,
  ) {
    const words = String(text || "").split(/\s+/);
    let line = "";
    let lineNumber = 0;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      context.fillText(line, x, y + lineNumber * lineHeight);
      lineNumber += 1;
      if (lineNumber >= maxLines) return;
      line = word;
    }
    if (line && lineNumber < maxLines) {
      context.fillText(line, x, y + lineNumber * lineHeight);
    }
  }

  function timerStateLabel(running, completed) {
    if (completed) return "Finished";
    return running ? "Running" : "Ready";
  }

  function formatTimerSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours)
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }

  function stripPendingTimerContext(timerResult) {
    const { competitionProof, dayId, sessionSnapshot, week, ...result } =
      timerResult;
    return result;
  }

  function SegmentList({ segments }) {
    return segments.map((segment) =>
      h(
        "section",
        {
          className: "segment",
          key: segment.blockId || `${segment.title}-${segment.minutes}`,
        },
        h(
          "h4",
          null,
          h("span", null, segment.title),
          h("span", { className: "metric-pill" }, `${segment.minutes} min`),
        ),
        h(
          "ul",
          null,
          segment.items.map((item, index) =>
            h("li", { key: `${segment.title}-${index}` }, item),
          ),
        ),
      ),
    );
  }

  function AddOnList({ addOns }) {
    return h(
      "section",
      { className: "segment optional-addons" },
      h(
        "h4",
        null,
        h("span", null, "Optional add-ons"),
        h("span", { className: "metric-pill" }, "10-20 min"),
      ),
      h(
        "ul",
        null,
        addOns.map((item, index) => h("li", { key: `addon-${index}` }, item)),
      ),
    );
  }

  function BuilderView({
    appState,
    activeView,
    onNotify,
    onGenerate,
    onSaveSession,
    onSelectPlan,
    onRenamePlan,
    onDeletePlan,
    onDeleteSession,
    onLogSession,
    onTimerFinish,
  }) {
    const [customFormVersion, setCustomFormVersion] = ReactRuntime.useState(0);
    const [editingSessionId, setEditingSessionId] = ReactRuntime.useState(null);
    const activePlan = selectActivePlan(appState);
    const editingSession = activePlan?.sessions.find(
      (session) => session.id === editingSessionId,
    );

    ReactRuntime.useEffect(() => {
      if (editingSessionId && !editingSession) setEditingSessionId(null);
    }, [editingSession, editingSessionId]);

    return h(
      "section",
      {
        id: "builderView",
        className: viewClass("builderView", activeView),
        "aria-labelledby": "builderTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Personal programming"),
          h("h2", { id: "builderTitle" }, "Programme builder"),
        ),
      ),
      h(GeneratorForm, {
        key: activePlan?.id || "new-generated-plan",
        profile: appState.profile,
        onGenerate,
        regenerating: activePlan?.kind === "generated",
        initialOptions:
          activePlan?.kind === "generated" ? activePlan.generatorOptions : null,
        onNotify,
      }),
      appState.plans.length
        ? h(
            "section",
            { className: "panel plan-manager", "aria-label": "Saved plans" },
            h(
              "div",
              { className: "form-row" },
              h(
                "label",
                null,
                "Active plan",
                h(
                  "select",
                  {
                    value: activePlan?.id || "",
                    onChange: (event) => {
                      setEditingSessionId(null);
                      onSelectPlan(event.target.value);
                    },
                  },
                  appState.plans.map((plan) =>
                    h("option", { key: plan.id, value: plan.id }, plan.title),
                  ),
                ),
              ),
              activePlan
                ? h(
                    "button",
                    {
                      className: "danger-button",
                      type: "button",
                      onClick: () => onDeletePlan(activePlan.id),
                    },
                    "Delete custom plan",
                  )
                : null,
            ),
            activePlan
              ? h(
                  "form",
                  {
                    key: activePlan.id,
                    className: "form-row",
                    onSubmit: (event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      onRenamePlan(activePlan.id, data.get("planTitle"));
                    },
                  },
                  h(
                    "label",
                    null,
                    "Plan name",
                    h("input", {
                      name: "planTitle",
                      type: "text",
                      required: true,
                      defaultValue: activePlan.title,
                    }),
                  ),
                  h(
                    "button",
                    { className: "ghost-button", type: "submit" },
                    "Save plan name",
                  ),
                )
              : null,
            activePlan?.kind === "generated"
              ? (() => {
                  const settings = normalizeGeneratorOptions(
                    activePlan.generatorOptions,
                  );
                  return h(
                    "div",
                    {
                      className: "plan-review",
                      "aria-label": "Active plan settings",
                    },
                    h("h4", null, "Active plan settings"),
                    h(
                      "p",
                      null,
                      `Weekly app workouts: ${settings.programDaysPerWeek}`,
                    ),
                    h(
                      "p",
                      null,
                      `Expected box workouts: ${settings.expectedBoxDays}`,
                    ),
                    h(
                      "p",
                      null,
                      `Preferred app days: ${settings.preferredProgramDays
                        .map((day) => day[0].toUpperCase() + day.slice(1))
                        .join(" and ")}`,
                    ),
                    h(
                      "p",
                      null,
                      `Session duration: ${settings.sessionDuration} minutes`,
                    ),
                  );
                })()
              : null,
          )
        : null,
      h(CustomPlanForm, {
        key: `${appState.activePlanId}-${editingSessionId || customFormVersion}`,
        selectedWeek: appState.selectedWeek,
        initialSession: editingSession,
        onNotify,
        onCancel: editingSession ? () => setEditingSessionId(null) : undefined,
        onSave: (session) => {
          onSaveSession(session, editingSessionId);
          setEditingSessionId(null);
          setCustomFormVersion((version) => version + 1);
        },
      }),
      h(
        "section",
        { className: "panel", "aria-labelledby": "customProgramTitle" },
        h(
          "div",
          { className: "panel-title" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Saved"),
            h(
              "h3",
              { id: "customProgramTitle" },
              activePlan?.title || "My training programme",
            ),
          ),
        ),
        h(
          "div",
          { id: "customProgramList", className: "custom-list" },
          activePlan?.sessions.length
            ? activePlan.sessions.map((session) => {
                const logged = isCustomPlanLogged(appState.logs, session);
                return h(SessionCard, {
                  key: session.id,
                  session: customPlanToSession(session),
                  tag: `${session.duration} min`,
                  meta: customPlanMeta(session, logged),
                  onLog: () => onLogSession(session.id, session.week),
                  onTimerFinish,
                  onEdit: () => setEditingSessionId(session.id),
                  onDelete: () => onDeleteSession(session.id),
                });
              })
            : h(
                "div",
                { className: "empty-state" },
                "No saved sessions yet. Build one here, then log it from the Log tab.",
              ),
        ),
      ),
    );
  }

  function GeneratorForm({
    profile,
    onGenerate,
    regenerating,
    initialOptions,
    onNotify,
  }) {
    const normalizedInitial = normalizeGeneratorOptions(initialOptions || {});
    const defaults = {
      goal: initialOptions ? normalizedInitial.primaryGoal : "stronger",
      secondaryGoal: initialOptions ? normalizedInitial.secondaryGoal : null,
      daysPerWeek: initialOptions ? normalizedInitial.programDaysPerWeek : 4,
      weakness: initialOptions?.weakness || "squat",
      barMuscleUpLevel: initialOptions?.barMuscleUpLevel || "highPull",
      athleteLevel: initialOptions?.athleteLevel || "intermediate",
      duration: initialOptions ? normalizedInitial.sessionDuration : 60,
      usesBoxProgramming: initialOptions
        ? normalizedInitial.usesBoxProgramming
        : false,
      expectedBoxDays: initialOptions ? normalizedInitial.expectedBoxDays : 0,
      totalTrainingDays: initialOptions
        ? normalizedInitial.totalTrainingDays
        : 4,
      preferredProgramDays: initialOptions
        ? normalizedInitial.preferredProgramDays
        : ["monday", "tuesday", "thursday", "saturday"],
      availableEquipment: initialOptions
        ? normalizedInitial.availableEquipment
        : Object.keys(EQUIPMENT_OPTIONS),
      barbellDropPolicy: initialOptions
        ? normalizedInitial.barbellDropPolicy
        : "allowed",
    };
    const [selectedGoal, setSelectedGoal] = ReactRuntime.useState(
      defaults.goal,
    );
    const [selectedFrequency, setSelectedFrequency] = ReactRuntime.useState(
      defaults.daysPerWeek,
    );
    const [usesBoxProgramming, setUsesBoxProgramming] = ReactRuntime.useState(
      defaults.usesBoxProgramming,
    );
    const [selectedDuration, setSelectedDuration] = ReactRuntime.useState(
      defaults.duration,
    );
    const [expectedBoxDays, setExpectedBoxDays] = ReactRuntime.useState(
      defaults.expectedBoxDays || 2,
    );
    const [totalTrainingDays, setTotalTrainingDays] = ReactRuntime.useState(
      defaults.totalTrainingDays,
    );
    const [preferredDays, setPreferredDays] = ReactRuntime.useState(
      defaults.preferredProgramDays,
    );
    const [availableEquipment, setAvailableEquipment] = ReactRuntime.useState(
      defaults.availableEquipment,
    );
    return h(
      "form",
      {
        id: "programmeGeneratorForm",
        className: "panel builder-form",
        onSubmit: (event) => {
          event.preventDefault();
          const data = new FormData(
            /** @type {HTMLFormElement} */ (event.currentTarget),
          );
          const options = {
            primaryGoal: String(data.get("generatorGoal") || "stronger"),
            secondaryGoal: String(data.get("secondaryGoal") || "") || null,
            programDaysPerWeek: Number(data.get("generatorDays") || 4),
            weakness:
              selectedGoal === "barMuscleUp"
                ? "muscleup"
                : String(data.get("generatorWeakness") || "squat"),
            sessionDuration: positiveNumber(
              data.get("generatorDuration"),
              selectedFrequency === 2 ? 75 : 60,
            ),
            usesBoxProgramming,
            expectedBoxDays: usesBoxProgramming ? expectedBoxDays : 0,
            totalTrainingDays,
            preferredProgramDays: preferredDays,
            availableEquipment,
            barbellDropPolicy: String(
              data.get("barbellDropPolicy") || "allowed",
            ),
            athleteLevel: String(
              data.get("generatorAthleteLevel") || "intermediate",
            ),
          };
          if (selectedGoal === "barMuscleUp") {
            options.barMuscleUpLevel = String(
              data.get("barMuscleUpLevel") || "highPull",
            );
          }
          if (preferredDays.length !== options.programDaysPerWeek) {
            onNotify(
              `Select exactly ${options.programDaysPerWeek} preferred app days.`,
            );
            return;
          }
          if (
            totalTrainingDays !==
            options.programDaysPerWeek + options.expectedBoxDays
          ) {
            onNotify(
              "Total weekly training must equal app-programmed plus expected box workouts.",
            );
            return;
          }
          if (
            !["barbell", "rack", "pullupBar"].every((item) =>
              availableEquipment.includes(item),
            )
          ) {
            onNotify(
              "Barbell, rack, and pull-up bar are required for this progression programme.",
            );
            return;
          }
          const generationSeed = createGenerationSeed();
          try {
            const generatedPlans = buildGeneratedProgramme(
              options,
              profile,
              createId,
              generationSeed,
            );
            const expectedSessionCount = options.programDaysPerWeek * 8;
            if (generatedPlans.length !== expectedSessionCount) {
              throw new Error(
                `Expected ${expectedSessionCount} generated sessions, received ${generatedPlans.length}.`,
              );
            }
            for (let week = 1; week <= 8; week += 1) {
              validateGeneratedWeek(
                generatedPlans.filter(
                  (session) => Number(session?.week) === week,
                ),
                {
                  requiredTimeDomains:
                    options.programDaysPerWeek === 2
                      ? ["short", "long"]
                      : ["short", "medium", "long"],
                  requireTwoDayStructure: options.programDaysPerWeek === 2,
                },
              );
            }
            onGenerate({
              sessions: generatedPlans,
              options,
              generationSeed,
              replaceActive: Boolean(data.get("replaceGenerated")),
            });
          } catch (error) {
            console.error(
              "Programme generation rejected invalid output.",
              error,
            );
            onNotify(
              "Programme generation could not produce valid workouts. Your current plan was not changed.",
            );
          }
        },
      },
      h(
        "div",
        { className: "panel-title" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Generate"),
          h("h3", null, "Programme from your needs"),
        ),
      ),
      h(
        "div",
        { className: "form-row" },
        h(
          "label",
          null,
          "Main goal",
          h(
            "select",
            {
              id: "generatorGoal",
              name: "generatorGoal",
              required: true,
              value: selectedGoal,
              onChange: (event) => setSelectedGoal(event.target.value),
            },
            h("option", { value: "stronger" }, "Get stronger"),
            h("option", { value: "endurance" }, "More endurance"),
            h("option", { value: "gymnastics" }, "Better gymnastics"),
            h("option", { value: "barMuscleUp" }, "Get my first bar muscle-up"),
            h("option", { value: "balanced" }, "All-round CrossFit"),
            h(
              "option",
              { value: "mastersRxOpen" },
              "Masters 35-39 RX / Open Prep",
            ),
          ),
        ),
        h(
          "label",
          null,
          "App-programmed sessions",
          h(
            "select",
            {
              id: "generatorDays",
              name: "generatorDays",
              required: true,
              value: String(selectedFrequency),
              onChange: (event) => {
                const frequency = Number(event.target.value);
                setSelectedFrequency(frequency);
                if (usesBoxProgramming) {
                  const boxDays = Math.max(
                    1,
                    Math.min(6, totalTrainingDays - frequency),
                  );
                  setExpectedBoxDays(boxDays);
                  setTotalTrainingDays(frequency + boxDays);
                } else {
                  setTotalTrainingDays((current) =>
                    Math.max(frequency, current),
                  );
                }
                const defaultsByFrequency = {
                  2: ["tuesday", "saturday"],
                  3: ["monday", "wednesday", "saturday"],
                  4: ["monday", "tuesday", "thursday", "saturday"],
                  5: ["monday", "tuesday", "wednesday", "friday", "saturday"],
                };
                setPreferredDays(defaultsByFrequency[frequency]);
                setSelectedDuration(frequency === 2 ? 75 : 60);
              },
            },
            h("option", { value: "2" }, "2 days"),
            h("option", { value: "3" }, "3 days"),
            h("option", { value: "4" }, "4 days"),
            defaults.daysPerWeek === 5
              ? h("option", { value: "5" }, "5 days (existing plan)")
              : null,
          ),
        ),
      ),
      h(
        "label",
        null,
        "Total weekly training",
        h(
          "select",
          {
            id: "totalTrainingDays",
            name: "totalTrainingDays",
            value: String(totalTrainingDays),
            onChange: (event) => {
              const total = Number(event.target.value);
              if (usesBoxProgramming) {
                const boxDays = Math.max(
                  1,
                  Math.min(6, total - selectedFrequency),
                );
                setExpectedBoxDays(boxDays);
                setTotalTrainingDays(selectedFrequency + boxDays);
              } else {
                setTotalTrainingDays(total);
              }
            },
          },
          [2, 3, 4, 5, 6, 7, 8, 9, 10].map((days) =>
            h(
              "option",
              {
                key: days,
                value: String(days),
                disabled: days < selectedFrequency,
              },
              `${days} sessions`,
            ),
          ),
        ),
      ),
      h(
        "label",
        null,
        "Secondary goal (optional)",
        h(
          "select",
          {
            id: "secondaryGoal",
            name: "secondaryGoal",
            defaultValue: defaults.secondaryGoal || "",
          },
          h("option", { value: "" }, "No secondary goal"),
          Object.entries(GOAL_LABELS)
            .filter(([value]) => value !== selectedGoal)
            .map(([value, label]) => h("option", { key: value, value }, label)),
        ),
      ),
      h(
        "div",
        { className: "form-row" },
        selectedGoal === "barMuscleUp"
          ? h(
              "label",
              null,
              "Current bar muscle-up level",
              h(
                "select",
                {
                  id: "barMuscleUpLevel",
                  name: "barMuscleUpLevel",
                  required: true,
                  defaultValue: defaults.barMuscleUpLevel,
                },
                Object.entries(BAR_MUSCLE_UP_LEVELS).map(([value, label]) =>
                  h("option", { key: value, value }, label),
                ),
              ),
            )
          : h(
              "label",
              null,
              "Biggest weakness",
              h(
                "select",
                {
                  id: "generatorWeakness",
                  name: "generatorWeakness",
                  required: true,
                  defaultValue: defaults.weakness,
                },
                Object.entries(WEAKNESS_LABELS).map(([value, label]) =>
                  h("option", { key: value, value }, label),
                ),
              ),
            ),
        h(
          "label",
          null,
          "Max session length",
          h(
            "select",
            {
              id: "generatorDuration",
              name: "generatorDuration",
              value: String(selectedDuration),
              onChange: (event) =>
                setSelectedDuration(Number(event.target.value)),
            },
            (selectedFrequency === 2 ? [60, 75, 90] : [45, 50, 55, 60]).map(
              (minutes) =>
                h(
                  "option",
                  { key: minutes, value: String(minutes) },
                  `${minutes} minutes`,
                ),
            ),
          ),
        ),
      ),
      h(
        "label",
        null,
        "Athlete programming level",
        h(
          "select",
          {
            id: "generatorAthleteLevel",
            name: "generatorAthleteLevel",
            required: true,
            defaultValue: defaults.athleteLevel,
          },
          Object.entries(ATHLETE_LEVELS).map(([value, label]) =>
            h("option", { key: value, value }, label),
          ),
        ),
      ),
      h(
        "section",
        { className: "builder-subsection", "aria-label": "Box training" },
        h(
          "label",
          { className: "check-row" },
          h("input", {
            id: "usesBoxProgramming",
            name: "usesBoxProgramming",
            type: "checkbox",
            checked: usesBoxProgramming,
            onChange: (event) => {
              const checked = event.target.checked;
              setUsesBoxProgramming(checked);
              if (checked) {
                const boxDays = Math.max(
                  1,
                  Math.min(6, totalTrainingDays - selectedFrequency),
                );
                setExpectedBoxDays(boxDays);
                setTotalTrainingDays(selectedFrequency + boxDays);
              } else {
                setTotalTrainingDays(selectedFrequency);
              }
            },
          }),
          "I also follow workouts at a CrossFit box",
        ),
        usesBoxProgramming
          ? h(
              "label",
              null,
              "Expected box workouts",
              h("input", {
                id: "expectedBoxDays",
                name: "expectedBoxDays",
                type: "number",
                min: "1",
                max: "6",
                step: "1",
                value: String(expectedBoxDays),
                onChange: (event) => {
                  const boxDays = Number(event.target.value);
                  setExpectedBoxDays(boxDays);
                  setTotalTrainingDays(selectedFrequency + boxDays);
                },
              }),
            )
          : null,
      ),
      h(
        "fieldset",
        { className: "builder-subsection" },
        h("legend", null, "Preferred app days"),
        DAY_OF_WEEK_OPTIONS.map((day) =>
          h(
            "label",
            { key: day, className: "check-row" },
            h("input", {
              type: "checkbox",
              name: "preferredProgramDay",
              value: day,
              checked: preferredDays.includes(day),
              onChange: (event) =>
                setPreferredDays((current) =>
                  event.target.checked
                    ? [...current, day]
                    : current.filter((item) => item !== day),
                ),
            }),
            day[0].toUpperCase() + day.slice(1),
          ),
        ),
        h(
          "p",
          { className: "muted-copy" },
          "Ideally, leave at least one day between app-programmed sessions.",
        ),
      ),
      h(
        "fieldset",
        { className: "builder-subsection" },
        h("legend", null, "Available equipment"),
        Object.entries(EQUIPMENT_OPTIONS).map(([value, label]) => {
          const required = ["barbell", "rack", "pullupBar"].includes(value);
          return h(
            "label",
            { key: value, className: "check-row" },
            h("input", {
              type: "checkbox",
              name: "availableEquipment",
              value,
              checked: availableEquipment.includes(value),
              disabled: required,
              onChange: (event) =>
                setAvailableEquipment((current) =>
                  event.target.checked
                    ? [...current, value]
                    : current.filter((item) => item !== value),
                ),
            }),
            `${label}${required ? " (required)" : ""}`,
          );
        }),
      ),
      h(
        "label",
        null,
        "Barbell dropping",
        h(
          "select",
          {
            id: "barbellDropPolicy",
            name: "barbellDropPolicy",
            defaultValue: defaults.barbellDropPolicy,
          },
          h("option", { value: "allowed" }, "Allowed"),
          h("option", { value: "drop_pads_only" }, "Drop pads required"),
          h("option", { value: "not_allowed" }, "Barbell cannot be dropped"),
        ),
      ),
      h(
        "section",
        { className: "plan-review", "aria-label": "Your weekly structure" },
        h("h4", null, "Your weekly structure"),
        h(
          "p",
          null,
          `${selectedFrequency} app-programmed progression sessions`,
        ),
        h(
          "p",
          null,
          `${usesBoxProgramming ? expectedBoxDays : 0} expected CrossFit box workouts`,
        ),
        h("p", null, `${totalTrainingDays} total training sessions`),
        h("p", null, `${selectedDuration} minutes per app session`),
      ),
      h(
        "label",
        { className: "check-row" },
        h("input", {
          id: "replaceGenerated",
          name: "replaceGenerated",
          type: "checkbox",
          defaultChecked: true,
        }),
        regenerating
          ? "Regenerate the active generated plan"
          : "Replace the active generated plan when possible",
      ),
      h(
        "button",
        { className: "primary-button", type: "submit" },
        regenerating
          ? "Regenerate 8-week programme"
          : "Generate 8-week programme",
      ),
    );
  }

  function CustomPlanForm({
    selectedWeek,
    initialSession,
    onNotify,
    onSave,
    onCancel,
  }) {
    return h(
      "form",
      {
        id: "customPlanForm",
        className: "panel builder-form",
        onSubmit: (event) => {
          event.preventDefault();
          const data = new FormData(
            /** @type {HTMLFormElement} */ (event.currentTarget),
          );
          const title = String(data.get("customPlanTitle") || "").trim();
          if (!title) {
            onNotify("Add a title for the training session.");
            return;
          }

          onSave({
            id: initialSession?.id || createId(),
            week: Number(data.get("customPlanWeek")),
            title,
            focus: String(
              data.get("customPlanFocus") || "Custom training session",
            ).trim(),
            warmup: splitLines(data.get("customPlanWarmup")),
            strength: splitLines(data.get("customPlanStrength")),
            wod: splitLines(data.get("customPlanWod")),
            mobility: splitLines(data.get("customPlanMobility")),
            duration: Math.min(
              90,
              Math.max(15, positiveNumber(data.get("customPlanDuration"), 60)),
            ),
            intensity: String(data.get("customPlanIntensity") || "Moderate"),
            createdAt: initialSession?.createdAt || new Date().toISOString(),
          });
        },
      },
      h(
        "div",
        { className: "panel-title" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, initialSession ? "Edit" : "Manual"),
          h(
            "h3",
            null,
            initialSession
              ? "Edit training session"
              : "Add one training session",
          ),
        ),
      ),
      h(
        "div",
        { className: "form-row" },
        h(
          "label",
          null,
          "Week",
          h(
            "select",
            {
              id: "customPlanWeek",
              name: "customPlanWeek",
              required: true,
              defaultValue: String(initialSession?.week || selectedWeek),
            },
            weekOptions(),
          ),
        ),
        h(
          "label",
          null,
          "Day or title",
          h("input", {
            id: "customPlanTitle",
            name: "customPlanTitle",
            type: "text",
            required: true,
            defaultValue: initialSession?.title || "",
            placeholder: "Friday engine + skill",
          }),
        ),
      ),
      h(
        "label",
        null,
        "Focus",
        h("input", {
          id: "customPlanFocus",
          name: "customPlanFocus",
          type: "text",
          defaultValue: initialSession?.focus || "",
          placeholder: "Engine, pull-up volume, mobility",
        }),
      ),
      h(
        "label",
        null,
        "Warm-up",
        h("textarea", {
          id: "customPlanWarmup",
          name: "customPlanWarmup",
          rows: "3",
          defaultValue: (initialSession?.warmup || []).join("\n"),
          placeholder: "8 min easy bike\nDynamic hips and shoulders",
        }),
      ),
      h(
        "label",
        null,
        "Strength or skill",
        h("textarea", {
          id: "customPlanStrength",
          name: "customPlanStrength",
          rows: "3",
          defaultValue: (initialSession?.strength || []).join("\n"),
          placeholder: "EMOM 10: 2 strict pull-ups + 6 kip swings",
        }),
      ),
      h(
        "label",
        null,
        "WOD",
        h("textarea", {
          id: "customPlanWod",
          name: "customPlanWod",
          rows: "3",
          defaultValue: workoutItemsForSession(initialSession).join("\n"),
          placeholder: "AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees",
        }),
      ),
      h(
        "label",
        null,
        "Cooldown or mobility",
        h("textarea", {
          id: "customPlanMobility",
          name: "customPlanMobility",
          rows: "3",
          defaultValue: (initialSession?.mobility || []).join("\n"),
          placeholder: "5 min nasal breathing\nLats, pecs, hip flexors",
        }),
      ),
      h(
        "div",
        { className: "form-row" },
        h(
          "label",
          null,
          "Duration",
          h("input", {
            id: "customPlanDuration",
            name: "customPlanDuration",
            type: "number",
            min: "15",
            max: "90",
            step: "5",
            inputMode: "numeric",
            defaultValue: String(initialSession?.duration || 60),
          }),
        ),
        h(
          "label",
          null,
          "Intensity",
          h(
            "select",
            {
              id: "customPlanIntensity",
              name: "customPlanIntensity",
              defaultValue: initialSession?.intensity || "Technique",
            },
            h("option", { value: "Technique" }, "Technique"),
            h("option", { value: "Moderate" }, "Moderate"),
            h("option", { value: "Hard" }, "Hard"),
            h("option", { value: "Deload" }, "Deload"),
            h("option", { value: "Test" }, "Test"),
          ),
        ),
      ),
      h(
        "div",
        { className: "quick-actions" },
        h(
          "button",
          { className: "primary-button", type: "submit" },
          initialSession ? "Update training session" : "Save training session",
        ),
        onCancel
          ? h(
              "button",
              { className: "ghost-button", type: "button", onClick: onCancel },
              "Cancel edit",
            )
          : null,
      ),
    );
  }

  function LearnView({ activeView }) {
    const [category, setCategory] = ReactRuntime.useState("all");
    const [query, setQuery] = ReactRuntime.useState("");
    const movements = filterMovementLibrary(category, query);

    return h(
      "section",
      {
        id: "learnView",
        className: viewClass("learnView", activeView),
        "aria-labelledby": "learnTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Movement library"),
          h("h2", { id: "learnTitle" }, "Learn the skills"),
        ),
      ),
      h(
        "section",
        {
          className: "panel movement-controls",
          "aria-labelledby": "movementFilterTitle",
        },
        h(
          "div",
          { className: "panel-title" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Video guides"),
            h("h3", { id: "movementFilterTitle" }, "Gymnastics and lifting"),
          ),
        ),
        h(
          "div",
          { className: "movement-filters" },
          h(
            "label",
            null,
            "Category",
            h(
              "select",
              {
                id: "movementCategory",
                "aria-label": "Movement category",
                value: category,
                onChange: (event) => setCategory(event.target.value),
              },
              h("option", { value: "all" }, "All movements"),
              h("option", { value: "Gymnastics" }, "Gymnastics"),
              h("option", { value: "Weightlifting" }, "Weightlifting"),
            ),
          ),
          h(
            "label",
            null,
            "Search",
            h("input", {
              id: "movementSearch",
              type: "search",
              autoComplete: "off",
              placeholder: "Bar muscle-up, snatch, rope climb",
              value: query,
              onChange: (event) => setQuery(event.target.value),
            }),
          ),
        ),
      ),
      h(
        "div",
        { id: "movementLibrary", className: "movement-grid" },
        movements.length
          ? movements.map((movement) =>
              h(MovementCard, { key: movement.id, movement }),
            )
          : h(
              "div",
              { className: "empty-state" },
              "No movements found. Try a different search or category.",
            ),
      ),
    );
  }

  function MovementCard({ movement }) {
    return h(
      "article",
      { className: "movement-card" },
      h(
        "div",
        { className: "movement-card-header" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, movement.category),
          h("h3", null, movement.name),
        ),
        h("span", { className: "tag" }, movement.level),
      ),
      h("p", { className: "muted-copy" }, movement.focus),
      h(
        "div",
        { className: "movement-detail-grid" },
        h(
          "section",
          null,
          h("h4", null, "Cues"),
          h(
            "ul",
            null,
            movement.cues.map((cue) => h("li", { key: cue }, cue)),
          ),
        ),
        h(
          "section",
          null,
          h("h4", null, "Progression"),
          h(
            "ul",
            null,
            movement.progressions.map((step) => h("li", { key: step }, step)),
          ),
        ),
      ),
      h(
        "p",
        { className: "movement-scale" },
        h("strong", null, "Scale:"),
        ` ${movement.scale}`,
      ),
      h(
        "div",
        { className: "quick-actions" },
        h(
          "a",
          {
            className: "primary-button movement-link",
            href: movement.videoUrl,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Open video",
        ),
        h(
          "a",
          {
            className: "ghost-button movement-link",
            href: movement.sourceUrl,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          "Source",
        ),
      ),
    );
  }

  function LogView({
    appState,
    activeView,
    logSelection,
    pendingTimerResult,
    onLogSelectionChange,
    onWeekChange,
    onNotify,
    onSaveLog,
    onClearLogs,
    onDeleteLog,
  }) {
    const [formVersion, setFormVersion] = ReactRuntime.useState(0);
    const [workoutSource, setWorkoutSource] = ReactRuntime.useState("app");
    const [editingLog, setEditingLog] = ReactRuntime.useState(null);
    const selectedWeek = appState.selectedWeek;
    const activePlan = selectActivePlan(appState);
    const selectedDayId =
      logSelection.dayId || (activePlan ? "" : getProgramDays()[0].id);
    const matchingTimer =
      pendingTimerResult &&
      pendingTimerResult.dayId === selectedDayId &&
      pendingTimerResult.week === selectedWeek
        ? pendingTimerResult
        : null;
    const timerSummary = matchingTimer ? formatTimerResult(matchingTimer) : "";
    const activeSessions = selectActiveWeekSessions(appState, selectedWeek);

    ReactRuntime.useEffect(() => {
      if (!logSelection.workoutSource) return;
      setWorkoutSource(logSelection.workoutSource === "box" ? "box" : "app");
    }, [logSelection.workoutSource, logSelection.trainingEventId]);

    return h(
      "section",
      {
        id: "logView",
        className: viewClass("logView", activeView),
        "aria-labelledby": "logTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "SugarWOD-style"),
          h("h2", { id: "logTitle" }, "Log workout"),
        ),
      ),
      h(
        "form",
        {
          key: `${formVersion}-${editingLog?.id || "new"}-${matchingTimer ? matchingTimer.completedAt : "manual"}`,
          id: "logForm",
          className: "panel log-form",
          onSubmit: async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const isBoxWorkout = workoutSource === "box";
            const storedDay = isBoxWorkout
              ? null
              : findTrainingSessionForState(
                  String(data.get("logDay")),
                  Number(data.get("logWeek")),
                  appState,
                );
            const day = isBoxWorkout
              ? {
                  id: `box-${String(data.get("logDate"))}-${createId()}`,
                  week: Number(data.get("logWeek")),
                  shortTitle:
                    String(data.get("boxWorkoutTitle") || "").trim() ||
                    "CrossFit box workout",
                }
              : matchingTimer?.sessionSnapshot?.id ===
                  String(data.get("logDay"))
                ? matchingTimer.sessionSnapshot
                : storedDay;

            if (!day) {
              onNotify("Choose a valid session to log.");
              return;
            }

            const timerResult = matchingTimer
              ? stripPendingTimerContext(matchingTimer)
              : null;
            const log = {
              id: editingLog?.id || createId(),
              date: String(data.get("logDate")),
              week: day.week || Number(data.get("logWeek")),
              dayId: day.id,
              dayTitle: day.shortTitle,
              workoutSource: isBoxWorkout
                ? "box"
                : activePlan?.kind === "custom"
                  ? "custom"
                  : "app",
              readiness: isBoxWorkout ? null : String(data.get("readiness")),
              difficulty: isBoxWorkout
                ? Number(data.get("boxDifficulty"))
                : null,
              movementPatterns: isBoxWorkout
                ? data.getAll("boxMovementPattern").map(String)
                : [],
              durationMinutes: isBoxWorkout
                ? Number(data.get("boxDuration"))
                : null,
              rpe: String(data.get("rpe") || "").trim(),
              strengthResult: String(data.get("strengthResult") || "").trim(),
              wodScore: String(data.get("wodScore") || "").trim(),
              structuredScore: {
                scoreType: String(data.get("scoreType") || "custom"),
                primaryValue: Number(data.get("primaryValue")) || null,
                secondaryValue: Number(data.get("secondaryValue")) || null,
                unit: String(data.get("scoreUnit") || "").trim() || null,
                splits: String(data.get("intervalSplits") || "")
                  .split(/\r?\n|,/)
                  .map((value) => value.trim())
                  .filter(Boolean),
                substitutions: String(data.get("movementSubstitutions") || "")
                  .split(/\r?\n|,/)
                  .map((value) => value.trim())
                  .filter(Boolean),
                strengthSets: Number(data.get("strengthSets")) || null,
                strengthReps: Number(data.get("strengthReps")) || null,
                strengthLoad: Number(data.get("strengthLoad")) || null,
              },
              rxStatus: String(data.get("rxStatus") || "not_applicable"),
              trainingEventId: logSelection.trainingEventId || null,
              readinessCheckId: logSelection.readinessCheckId || null,
              recommendationSnapshot:
                logSelection.recommendationSnapshot || null,
              timerResult,
              competitionProof: matchingTimer?.competitionProof || null,
              notes: String(data.get("logNotes") || "").trim(),
              mobilityDone: Boolean(data.get("mobilityDone")),
              createdAt: editingLog?.createdAt || new Date().toISOString(),
            };

            try {
              await onSaveLog(log);
              setEditingLog(null);
              setFormVersion((version) => version + 1);
            } catch {
              onNotify(
                "Save failed. Try again after checking your connection.",
              );
            }
          },
        },
        h(
          "label",
          null,
          "Workout type",
          h(
            "select",
            {
              id: "workoutSource",
              name: "workoutSource",
              value: workoutSource,
              onChange: (event) => setWorkoutSource(event.target.value),
            },
            h("option", { value: "app" }, "App-programmed workout"),
            h("option", { value: "box" }, "CrossFit box workout"),
          ),
        ),
        h(
          "div",
          { className: "form-row" },
          h(
            "label",
            null,
            "Date",
            h("input", {
              id: "logDate",
              name: "logDate",
              type: "date",
              required: true,
              defaultValue: logSelection.logDate || todayInputValue(),
              ...(editingLog ? { defaultValue: editingLog.date } : {}),
            }),
          ),
          h(
            "label",
            null,
            "Week",
            h(
              "select",
              {
                id: "logWeek",
                name: "logWeek",
                required: true,
                value: String(selectedWeek),
                onChange: (event) => {
                  const week = Number(event.target.value);
                  onWeekChange(week);
                },
              },
              weekOptions(),
            ),
          ),
        ),
        workoutSource === "box"
          ? h(
              ReactRuntime.Fragment,
              null,
              h(
                "label",
                null,
                "Box workout name",
                h("input", {
                  id: "boxWorkoutTitle",
                  name: "boxWorkoutTitle",
                  type: "text",
                  placeholder: "Community WOD",
                  defaultValue:
                    editingLog?.workoutSource === "box"
                      ? editingLog.dayTitle
                      : logSelection.boxWorkoutTitle || "",
                }),
              ),
              h(
                "div",
                { className: "form-row" },
                h(
                  "label",
                  null,
                  "Estimated difficulty",
                  h(
                    "select",
                    {
                      id: "boxDifficulty",
                      name: "boxDifficulty",
                      defaultValue: "3",
                      ...(editingLog?.difficulty
                        ? { defaultValue: String(editingLog.difficulty) }
                        : {}),
                    },
                    [1, 2, 3, 4, 5].map((value) =>
                      h(
                        "option",
                        { key: value, value: String(value) },
                        String(value),
                      ),
                    ),
                  ),
                ),
                h(
                  "label",
                  null,
                  "Conditioning duration",
                  h("input", {
                    id: "boxDuration",
                    name: "boxDuration",
                    type: "number",
                    min: "1",
                    max: "300",
                    step: "1",
                    defaultValue: "60",
                    ...(editingLog?.durationMinutes
                      ? { defaultValue: String(editingLog.durationMinutes) }
                      : {}),
                  }),
                ),
              ),
              h(
                "fieldset",
                null,
                h("legend", null, "Main movement categories"),
                [
                  ["squat", "Heavy squats"],
                  ["hinge", "Deadlifts or hinging"],
                  ["olympic_lifting", "Olympic lifting"],
                  ["vertical_pull", "Pull-ups or muscle-ups"],
                  ["vertical_push", "Pressing"],
                  ["long_conditioning", "Long conditioning"],
                  ["short_conditioning", "Short conditioning"],
                  ["aerobic", "Rowing, cycling, or running"],
                ].map(([value, label]) =>
                  h(
                    "label",
                    { key: value, className: "check-row" },
                    h("input", {
                      type: "checkbox",
                      name: "boxMovementPattern",
                      value,
                      defaultChecked: Boolean(
                        editingLog?.movementPatterns?.includes(value),
                      ),
                    }),
                    label,
                  ),
                ),
              ),
            )
          : h(
              "label",
              null,
              "Session",
              h(
                "select",
                {
                  id: "logDay",
                  name: "logDay",
                  required: true,
                  disabled: Boolean(
                    activePlan &&
                    !activeSessions.length &&
                    !matchingTimer?.sessionSnapshot,
                  ),
                  value: selectedDayId,
                  onChange: (event) =>
                    onLogSelectionChange({ dayId: event.target.value }),
                },
                h(
                  "optgroup",
                  { label: activePlan?.title || "CrossFit Training Programme" },
                  activePlan
                    ? activeSessions.length
                      ? activeSessions.map((session) =>
                          h(
                            "option",
                            { key: session.id, value: session.id },
                            `Week ${session.week}: ${session.title}`,
                          ),
                        )
                      : h(
                          "option",
                          { value: "", disabled: true },
                          `No sessions scheduled for week ${selectedWeek}`,
                        )
                    : getProgramDays().map((day) =>
                        h(
                          "option",
                          { key: day.id, value: day.id },
                          `${day.weekday} - ${day.shortTitle}`,
                        ),
                      ),
                ),
                matchingTimer?.sessionSnapshot &&
                  !findTrainingSessionForState(
                    matchingTimer.sessionSnapshot.id,
                    selectedWeek,
                    appState,
                  )
                  ? h(
                      "optgroup",
                      { label: "Competition proof" },
                      h(
                        "option",
                        { value: matchingTimer.sessionSnapshot.id },
                        matchingTimer.sessionSnapshot.shortTitle,
                      ),
                    )
                  : null,
              ),
            ),
        h(
          "div",
          { className: "form-row" },
          h(
            "label",
            null,
            "Readiness",
            h(
              "select",
              {
                id: "readiness",
                name: "readiness",
                defaultValue: editingLog?.readiness || "green",
              },
              h("option", { value: "green" }, "Green - push the plan"),
              h("option", { value: "amber" }, "Amber - hold technique"),
              h("option", { value: "red" }, "Red - scale today"),
            ),
          ),
          h(
            "label",
            null,
            "RPE",
            h("input", {
              id: "rpe",
              name: "rpe",
              type: "number",
              min: "1",
              max: "10",
              step: "0.5",
              inputMode: "decimal",
              placeholder: "8",
              defaultValue: editingLog?.rpe || "",
            }),
          ),
        ),
        h(
          "label",
          null,
          "Strength or skill result",
          h("input", {
            id: "strengthResult",
            name: "strengthResult",
            type: "text",
            placeholder: "Back squat 5x4 at 110 kg, all smooth",
            defaultValue: editingLog?.strengthResult || "",
          }),
        ),
        h(
          "label",
          null,
          "WOD score",
          h("input", {
            id: "wodScore",
            name: "wodScore",
            type: "text",
            placeholder: "4 rounds + 8 reps, or 14:36",
            defaultValue: timerSummary,
            ...(editingLog?.wodScore
              ? { defaultValue: editingLog.wodScore }
              : {}),
          }),
        ),
        h(
          "fieldset",
          { className: "structured-score" },
          h("legend", null, "Structured result"),
          h(
            "div",
            { className: "form-row" },
            h(
              "label",
              null,
              "Score type",
              h(
                "select",
                {
                  name: "scoreType",
                  defaultValue:
                    editingLog?.structuredScore?.scoreType || "custom",
                },
                h("option", { value: "time" }, "Time"),
                h("option", { value: "rounds_reps" }, "Rounds + reps"),
                h("option", { value: "load" }, "Load"),
                h("option", { value: "distance" }, "Distance"),
                h("option", { value: "calories" }, "Calories"),
                h("option", { value: "intervals" }, "Intervals"),
                h("option", { value: "custom" }, "Custom / legacy"),
              ),
            ),
            h(
              "label",
              null,
              "Rx status",
              h(
                "select",
                {
                  name: "rxStatus",
                  defaultValue: editingLog?.rxStatus || "not_applicable",
                },
                h("option", { value: "rx" }, "Rx"),
                h("option", { value: "scaled" }, "Scaled"),
                h("option", { value: "not_applicable" }, "Not applicable"),
              ),
            ),
          ),
          h(
            "div",
            { className: "structured-score-grid" },
            h(NumberInput, {
              name: "primaryValue",
              label: "Primary value",
              value: editingLog?.structuredScore?.primaryValue || "",
            }),
            h(NumberInput, {
              name: "secondaryValue",
              label: "Reps / secondary",
              value: editingLog?.structuredScore?.secondaryValue || "",
            }),
            h(
              "label",
              null,
              "Unit",
              h("input", {
                name: "scoreUnit",
                defaultValue: editingLog?.structuredScore?.unit || "",
                placeholder: "sec, reps, kg, m, cal",
              }),
            ),
            h(NumberInput, {
              name: "strengthSets",
              label: "Strength sets",
              value: editingLog?.structuredScore?.strengthSets || "",
            }),
            h(NumberInput, {
              name: "strengthReps",
              label: "Reps per set",
              value: editingLog?.structuredScore?.strengthReps || "",
            }),
            h(NumberInput, {
              name: "strengthLoad",
              label: "Strength load (kg)",
              value: editingLog?.structuredScore?.strengthLoad || "",
            }),
          ),
          h(
            "label",
            null,
            "Interval splits",
            h("textarea", {
              name: "intervalSplits",
              rows: "2",
              defaultValue:
                editingLog?.structuredScore?.splits?.join("\n") || "",
              placeholder: "One split per line",
            }),
          ),
          h(
            "label",
            null,
            "Movement substitutions",
            h("textarea", {
              name: "movementSubstitutions",
              rows: "2",
              defaultValue:
                editingLog?.structuredScore?.substitutions?.join("\n") || "",
              placeholder: "Pull-ups → ring rows",
            }),
          ),
        ),
        matchingTimer
          ? h(
              "section",
              {
                className: "timer-summary",
                "aria-label": "Pending timer result",
              },
              h("h3", null, "Timer result ready"),
              h("p", null, timerSummary),
              matchingTimer.competitionProof
                ? h(
                    "p",
                    { className: "proof-log-status" },
                    matchingTimer.competitionProof.overlayEmbedded
                      ? "Competition proof recorded with embedded timer overlay."
                      : "Competition proof recorded; timer overlay was not embedded by this browser.",
                  )
                : null,
              matchingTimer.splits && matchingTimer.splits.length
                ? h(
                    "ol",
                    null,
                    matchingTimer.splits.map((split) =>
                      h(
                        "li",
                        { key: split.label },
                        `${split.label} - ${formatTimerSeconds(split.elapsedSeconds)}`,
                      ),
                    ),
                  )
                : null,
            )
          : null,
        h(
          "label",
          null,
          "Notes",
          h("textarea", {
            id: "logNotes",
            name: "logNotes",
            rows: "4",
            placeholder: "Pacing, scaling, misses, mobility, next adjustment",
            defaultValue: editingLog?.notes || "",
          }),
        ),
        h(
          "label",
          { className: "check-row" },
          h("input", {
            id: "mobilityDone",
            name: "mobilityDone",
            type: "checkbox",
            defaultChecked: Boolean(editingLog?.mobilityDone),
          }),
          "Mobility completed",
        ),
        h(
          "button",
          { className: "primary-button", type: "submit" },
          editingLog ? "Update workout log" : "Save workout log",
        ),
        editingLog
          ? h(
              "button",
              {
                className: "ghost-button",
                type: "button",
                onClick: () => {
                  setEditingLog(null);
                  setFormVersion((version) => version + 1);
                },
              },
              "Cancel edit",
            )
          : null,
      ),
      h(
        "section",
        { className: "panel", "aria-labelledby": "recentLogsTitle" },
        h(
          "div",
          { className: "panel-title" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "History"),
            h("h3", { id: "recentLogsTitle" }, "Recent logs"),
          ),
          h(
            "button",
            {
              className: "ghost-button",
              id: "clearLogs",
              type: "button",
              onClick: onClearLogs,
            },
            "Clear logs",
          ),
        ),
        h(
          "div",
          { id: "recentLogs", className: "history-list" },
          appState.logs.length
            ? appState.logs.slice(0, 12).map((log) =>
                h(LogHistoryItem, {
                  key: log.id,
                  log,
                  onEdit: () => {
                    setEditingLog(log);
                    setWorkoutSource(
                      log.workoutSource === "box" ? "box" : "app",
                    );
                    onWeekChange(log.week);
                    onLogSelectionChange({ dayId: log.dayId });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  },
                  onDelete: () => {
                    if (window.confirm("Delete this workout log?")) {
                      onDeleteLog(log.id);
                    }
                  },
                }),
              )
            : h(
                "div",
                { className: "empty-state" },
                "No workout logs yet. Save your first session after training.",
              ),
        ),
      ),
    );
  }

  function LogHistoryItem({ log, onEdit, onDelete }) {
    return h(
      "article",
      { className: "history-item" },
      h(
        "h4",
        null,
        `${formatDate(log.date)} - Week ${log.week}, ${log.dayTitle}`,
      ),
      h(
        "p",
        null,
        `${log.wodScore || "No WOD score"} ${log.strengthResult ? "- " + log.strengthResult : ""}`,
      ),
      log.timerResult
        ? h("p", null, `Timer: ${formatTimerResult(log.timerResult)}`)
        : null,
      log.competitionProof
        ? h(
            "p",
            { className: "proof-log-status" },
            `Competition proof recorded (${formatTimerSeconds(log.competitionProof.durationSeconds)})${
              log.competitionProof.interrupted ? " - interruption marked" : ""
            }. Video remains on the athlete's device.`,
          )
        : null,
      log.notes ? h("p", null, log.notes) : null,
      h(
        "div",
        { className: "history-meta" },
        h(
          "span",
          { className: "metric-pill" },
          log.workoutSource === "box"
            ? "Box workout"
            : log.workoutSource === "custom"
              ? "Custom workout"
              : "App workout",
        ),
        log.readiness
          ? h(
              "span",
              { className: `metric-pill readiness-${log.readiness}` },
              READINESS_LABELS[log.readiness] || log.readiness,
            )
          : null,
        log.difficulty
          ? h(
              "span",
              { className: "metric-pill" },
              `Difficulty ${log.difficulty}/5`,
            )
          : null,
        log.durationMinutes
          ? h(
              "span",
              { className: "metric-pill" },
              `${log.durationMinutes} min`,
            )
          : null,
        log.rpe
          ? h("span", { className: "metric-pill" }, `RPE ${log.rpe}`)
          : null,
        log.mobilityDone
          ? h("span", { className: "metric-pill" }, "Mobility done")
          : null,
      ),
      h(
        "div",
        { className: "quick-actions history-actions" },
        h(
          "button",
          { className: "ghost-button", type: "button", onClick: onEdit },
          "Edit",
        ),
        h(
          "button",
          {
            className: "ghost-button danger-button",
            type: "button",
            onClick: onDelete,
          },
          "Delete",
        ),
      ),
    );
  }

  function findTrainingSessionForState(sessionId, weekNumber, state) {
    const activePlan = selectActivePlan(state);
    if (!activePlan) {
      const mainDay = getProgramDays().find((day) => day.id === sessionId);
      return mainDay
        ? buildSession(mainDay.id, weekNumber, state.profile)
        : null;
    }

    const customPlan = activePlan.sessions.find(
      (session) => session.id === sessionId,
    );
    if (!customPlan) return null;

    return {
      id: customPlan.id,
      week: customPlan.week,
      weekday: `Week ${customPlan.week}`,
      shortTitle: customPlan.title,
      focus: customPlan.focus,
      segments: customPlanSegments(customPlan),
    };
  }

  function PrView({ appState, activeView, onNotify, onSaveAttempt }) {
    const [formVersion, setFormVersion] = ReactRuntime.useState(0);
    const activePlan = selectActivePlan(appState);
    const plannedSessions = activePlan?.sessions.length || 32;
    const progression = buildCycleProgressionResult(
      appState.profile,
      appState.logs,
      plannedSessions,
    );
    const rpeValues = appState.logs
      .map((log) => Number(log.rpe))
      .filter((value) => Number.isFinite(value));
    const averageRpe = rpeValues.length
      ? rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length
      : null;
    const readinessValues = appState.readinessChecks
      .map((checkin) => Number(checkin.energy))
      .filter((value) => Number.isFinite(value));
    const averageEnergy = readinessValues.length
      ? readinessValues.reduce((sum, value) => sum + value, 0) /
        readinessValues.length
      : null;
    const mobilityRate = appState.logs.length
      ? Math.round(
          (appState.logs.filter((log) => log.mobilityDone).length /
            appState.logs.length) *
            100,
        )
      : 0;
    const appLogs = appState.logs.filter(
      (log) => log.workoutSource !== "box",
    ).length;
    const boxLogs = appState.logs.filter(
      (log) => log.workoutSource === "box",
    ).length;
    const customMetrics = [
      ...new Map(
        appState.prAttempts
          .filter(
            (attempt) =>
              !PR_METRICS.some((metric) => metric.id === attempt.metricId),
          )
          .map((attempt) => [attempt.metricId, attempt]),
      ).values(),
    ];

    return h(
      "section",
      {
        id: "progressView",
        className: viewClass("progressView", activeView),
        "aria-labelledby": "progressTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Measurable development"),
          h("h2", { id: "progressTitle" }, "Progress"),
        ),
      ),
      h(
        "div",
        { className: "stats-grid progress-stats" },
        h(StatCard, {
          value: `${appLogs}/${plannedSessions}`,
          label: "Planned vs completed",
          detail: `${boxLogs} box sessions also logged`,
        }),
        h(StatCard, {
          value: averageRpe === null ? "-" : trimNumber(averageRpe),
          label: "Average RPE",
        }),
        h(StatCard, {
          value:
            averageEnergy === null ? "-" : `${trimNumber(averageEnergy)}/5`,
          label: "Readiness trend",
        }),
        h(StatCard, {
          value: `${mobilityRate}%`,
          label: "Mobility consistency",
        }),
      ),
      h(
        "section",
        {
          className: `panel cycle-recommendation progression-${progression.action}`,
          "aria-labelledby": "cycleRecommendationTitle",
        },
        h("p", { className: "eyebrow" }, "Next cycle recommendation"),
        h(
          "h3",
          { id: "cycleRecommendationTitle" },
          progression.action === "increase"
            ? "Increase training maxes by about 2.5%"
            : progression.action === "reduce"
              ? "Rebase training maxes by about 2.5%"
              : "Hold training maxes for the next cycle",
        ),
        h(
          "p",
          { className: "muted-copy" },
          `${Math.round(progression.completionRate * 100)}% of app sessions completed${
            progression.averageRpe === null
              ? "; log RPE to improve the decision."
              : ` at average RPE ${trimNumber(progression.averageRpe)}.`
          } This recommendation is never activated automatically.`,
        ),
        h(
          "div",
          { className: "history-meta" },
          Object.entries(progression.suggestedMaxes)
            .slice(0, 4)
            .map(([metricId, value]) =>
              h(
                "span",
                { className: "metric-pill", key: metricId },
                `${PR_METRICS.find((metric) => metric.id === metricId)?.name || metricId}: ${value} kg`,
              ),
            ),
        ),
      ),
      h(RxReadinessPanel, { profile: appState.profile, logs: appState.logs }),
      h(
        "section",
        { className: "panel progress-trends", "aria-labelledby": "trendTitle" },
        h("p", { className: "eyebrow" }, "Training balance"),
        h("h3", { id: "trendTitle" }, "Strength, engine, skill, and scores"),
        h(
          "div",
          { className: "progress-track-list" },
          [
            [
              "Strength trajectories",
              appState.prAttempts.filter((item) =>
                [
                  "backSquat",
                  "frontSquat",
                  "deadlift",
                  "strictPress",
                  "snatch",
                  "cleanJerk",
                ].includes(item.metricId),
              ).length,
            ],
            [
              "Engine and benchmarks",
              appState.prAttempts.filter((item) =>
                [
                  "row1k",
                  "row2k",
                  "run5k",
                  "bike10MinCalories",
                  "murph",
                ].includes(item.metricId),
              ).length,
            ],
            [
              "Gymnastics capacity",
              appState.prAttempts.filter((item) =>
                [
                  "t2b",
                  "pullUps",
                  "chestToBar",
                  "barMuscleUp",
                  "ringMuscleUp",
                  "strictHspu",
                  "handstandWalk",
                  "doubleUnders",
                ].includes(item.metricId),
              ).length,
            ],
            [
              "Structured workout scores",
              appState.logs.filter(
                (log) =>
                  log.structuredScore?.scoreType &&
                  log.structuredScore.scoreType !== "custom",
              ).length,
            ],
          ].map(([label, count]) =>
            h(
              "div",
              { className: "progress-track", key: label },
              h("span", null, label),
              h("strong", null, `${count} result${count === 1 ? "" : "s"}`),
              h("span", {
                className: "progress-track-fill",
                style: { width: `${Math.min(100, Number(count) * 12.5)}%` },
              }),
            ),
          ),
        ),
      ),
      h(
        "div",
        { className: "pr-grid", id: "prGrid" },
        PR_METRICS.map((metric) => {
          const pr = appState.prs[metric.id];
          return h(
            "article",
            { className: "pr-card", key: metric.id },
            h("p", { className: "pr-label" }, metric.name),
            h("p", { className: "pr-value" }, pr ? pr.display : "-"),
            h("p", { className: "stat-label" }, pr ? pr.date : "No PR yet"),
          );
        }),
        customMetrics.map((attempt) =>
          h(
            "article",
            { className: "pr-card", key: attempt.metricId },
            h("p", { className: "pr-label" }, attempt.metricName),
            h("p", { className: "pr-value" }, attempt.display),
            h("p", { className: "stat-label" }, attempt.date),
          ),
        ),
      ),
      h(
        "form",
        {
          key: formVersion,
          id: "prForm",
          className: "panel pr-form",
          onSubmit: async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const selectedMetricId = String(data.get("prMetric"));
            const customName = String(
              data.get("customBenchmarkName") || "",
            ).trim();
            const customType = String(
              data.get("customBenchmarkType") || "time",
            );
            const metric =
              PR_METRICS.find((item) => item.id === selectedMetricId) ||
              (selectedMetricId === "custom" && customName
                ? {
                    id: `benchmark-${customName
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")}`,
                    name: customName,
                    type: customType,
                    unit: customType === "time" ? "time" : "score",
                    direction: customType === "time" ? "lower" : "higher",
                  }
                : null);
            if (!metric) {
              onNotify("Name the custom benchmark before saving it.");
              return;
            }
            const normalized = normalizePrValue(
              String(data.get("prValue") || ""),
              metric,
            );

            if (!Number.isFinite(normalized) || normalized <= 0) {
              onNotify(
                metric.type === "time"
                  ? "Use a time greater than zero, like 3:30 or 14:36."
                  : "Enter a number greater than zero.",
              );
              return;
            }

            const current = appState.prs[metric.id];
            const isPr =
              !current || isBetterPr(normalized, current.value, metric);
            try {
              await onSaveAttempt({
                id: createId(),
                metricId: metric.id,
                metricName: metric.name,
                value: normalized,
                display: formatPrValue(normalized, metric),
                date: String(data.get("prDate")),
                notes: String(data.get("prNotes") || "").trim(),
                isPr,
                createdAt: new Date().toISOString(),
              });
              setFormVersion((version) => version + 1);
            } catch {
              onNotify(
                "Save failed. Try again after checking your connection.",
              );
            }
          },
        },
        h(
          "div",
          { className: "panel-title" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Attempt"),
            h("h3", null, "Log PR attempt"),
          ),
        ),
        h(
          "label",
          null,
          "Metric",
          h(
            "select",
            {
              id: "prMetric",
              name: "prMetric",
              defaultValue: PR_METRICS[0].id,
            },
            PR_METRICS.map((metric) =>
              h("option", { key: metric.id, value: metric.id }, metric.name),
            ),
            h("option", { value: "custom" }, "Custom benchmark"),
          ),
        ),
        h(
          "div",
          { className: "form-row" },
          h(
            "label",
            null,
            "Custom benchmark name",
            h("input", {
              name: "customBenchmarkName",
              list: "benchmarkCatalog",
              placeholder: "Fran, Grace, Helen, Cindy, Diane…",
            }),
            h(
              "datalist",
              { id: "benchmarkCatalog" },
              [
                "Fran",
                "Grace",
                "Helen",
                "Cindy",
                "Diane",
                "Annie",
                "Karen",
              ].map((name) => h("option", { key: name, value: name })),
            ),
          ),
          h(
            "label",
            null,
            "Custom score type",
            h(
              "select",
              { name: "customBenchmarkType", defaultValue: "time" },
              h("option", { value: "time" }, "Time (lower is better)"),
              h("option", { value: "number" }, "Score (higher is better)"),
            ),
          ),
        ),
        h(
          "div",
          { className: "form-row" },
          h(
            "label",
            null,
            "Result",
            h("input", {
              id: "prValue",
              name: "prValue",
              type: "text",
              required: true,
              placeholder: "145, 3:30, 12",
            }),
          ),
          h(
            "label",
            null,
            "Date",
            h("input", {
              id: "prDate",
              name: "prDate",
              type: "date",
              required: true,
              defaultValue: todayInputValue(),
            }),
          ),
        ),
        h(
          "label",
          null,
          "Notes",
          h("textarea", {
            id: "prNotes",
            name: "prNotes",
            rows: "3",
            placeholder: "How it felt, setup, video cue, split, scaling",
          }),
        ),
        h(
          "button",
          { className: "primary-button", type: "submit" },
          "Save PR attempt",
        ),
      ),
      h(
        "section",
        { className: "panel", "aria-labelledby": "attemptHistoryTitle" },
        h(
          "div",
          { className: "panel-title" },
          h(
            "div",
            null,
            h("p", { className: "eyebrow" }, "Timeline"),
            h("h3", { id: "attemptHistoryTitle" }, "Recent PR attempts"),
          ),
        ),
        h(
          "div",
          { id: "prHistory", className: "history-list" },
          appState.prAttempts.length
            ? appState.prAttempts
                .slice(0, 12)
                .map((attempt) =>
                  h(
                    "article",
                    { className: "history-item", key: attempt.id },
                    h(
                      "h4",
                      null,
                      `${attempt.isPr ? "PR" : "Attempt"} - ${attempt.metricName} ${attempt.display}`,
                    ),
                    h(
                      "p",
                      null,
                      `${formatDate(attempt.date)}${attempt.notes ? " - " + attempt.notes : ""}`,
                    ),
                  ),
                )
            : h(
                "div",
                { className: "empty-state" },
                "No PR attempts yet. Baselines are loaded, and attempts you log will appear here.",
              ),
        ),
      ),
    );
  }

  function BottomNav({ activeView, onActivate }) {
    const items = [
      ["dashboardView", "Today"],
      ["calendarView", "Calendar"],
      ["logView", "Log"],
      ["progressView", "Progress"],
      ["moreView", "More"],
    ];
    const moreViews = new Set([
      "moreView",
      "builderView",
      "learnView",
      "proofView",
    ]);

    return h(
      "nav",
      { className: "bottom-nav", "aria-label": "Main navigation" },
      items.map(([viewId, label]) =>
        h(
          "button",
          {
            key: viewId,
            className: `nav-button${
              activeView === viewId ||
              (viewId === "moreView" && moreViews.has(activeView))
                ? " is-active"
                : ""
            }`,
            type: "button",
            "data-view": viewId,
            onClick: () => onActivate(viewId),
          },
          label,
        ),
      ),
    );
  }

  class AppErrorBoundary extends ReactRuntime.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error) {
      console.error("Application render failed.", {
        name: error?.name || "Error",
        message: error?.message || "Unknown render failure",
      });
    }

    render() {
      if (!this.state.hasError) return this.props.children;
      return h(
        "main",
        { className: "app-shell" },
        h(
          "section",
          { className: "panel", role: "alert" },
          h("h1", null, "The app could not finish rendering"),
          h(
            "p",
            { className: "muted-copy" },
            "Your saved data remains on this device. Reload to try again.",
          ),
          h(
            "button",
            {
              className: "primary-button",
              type: "button",
              onClick: () => window.location.reload(),
            },
            "Reload app",
          ),
        ),
      );
    }
  }

  function memoizeInactiveView(Component, viewId) {
    return /** @type {any} */ (
      ReactRuntime.memo(
        Component,
        (previous, next) =>
          previous.activeView !== viewId && next.activeView !== viewId,
      )
    );
  }

  const MemoProgramView = memoizeInactiveView(ProgramView, "calendarView");
  const MemoBuilderView = memoizeInactiveView(BuilderView, "builderView");
  const MemoLearnView = memoizeInactiveView(LearnView, "learnView");
  const MemoProofView = memoizeInactiveView(ProofView, "proofView");
  const MemoLogView = memoizeInactiveView(LogView, "logView");
  const MemoPrView = memoizeInactiveView(PrView, "progressView");

  const root = ReactDOMRuntime.createRoot(rootElement);
  root.render(h(AppErrorBoundary, null, h(App)));
})();
