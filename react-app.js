"use strict";

(function mountForgeHourReact() {
  const rootElement = document.querySelector("#root");
  const api = window.ForgeHour;
  const syncApi = window.ForgeHourSync;
  const ReactRuntime = window.React;
  const ReactDOMRuntime = window.ReactDOM;

  if (!rootElement) return;

  if (!api || !syncApi || !ReactRuntime || !ReactDOMRuntime) {
    rootElement.innerHTML =
      '<div class="app-shell"><section class="panel"><h1>CrossFit Training Programme</h1><p class="muted-copy">React could not load. Check your connection and reload the app.</p></section></div>';
    return;
  }

  const {
    DIVISION_LABELS,
    GOAL_LABELS,
    PLAN_SCHEMA_VERSION,
    PR_METRICS,
    READINESS_LABELS,
    WEEK_META,
    WEAKNESS_LABELS,
    buildGeneratedProgramme,
    buildRxReadiness,
    buildSession,
    clamp,
    cloneDefaultProfile,
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
    normalizePrValue,
    positiveNumber,
    registerServiceWorker,
    splitLines,
    selectActivePlan,
    selectActiveWeekSessions,
    timerDisplaySeconds,
    valueFromPath,
  } = api;

  const { createSupabaseStore, mergeById, mergePrs } = syncApi;

  const STORAGE_KEY = "forge-hour-state-v1";
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

  /**
   * @typedef {Object} WorkoutSession
   * @property {string} id
   * @property {number} week
   * @property {string} title
   * @property {string=} focus
   * @property {string[]} warmup
   * @property {string[]} strength
   * @property {string[]} wod
   * @property {string[]} mobility
   * @property {number} duration
   * @property {string=} intensity
   * @property {"generated"|"manual"=} origin
   * @property {boolean=} generated
   * @property {boolean=} customized
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
   */

  /**
   * @typedef {Object} AppState
   * @property {number} schemaVersion
   * @property {number} planSchemaVersion
   * @property {any} profile
   * @property {TrainingPlan[]} plans
   * @property {string|null} activePlanId
   * @property {Object<string, ScoreData>} scoreDataByOwner
   * @property {string} activeScoreOwner
   * @property {number} selectedWeek
   * @property {string} themePreference
   */

  /** @returns {AppState} */
  function fallbackState() {
    return {
      schemaVersion: 3,
      planSchemaVersion: PLAN_SCHEMA_VERSION,
      profile: cloneDefaultProfile(),
      plans: [],
      activePlanId: null,
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
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState(fallback);

      const parsed = JSON.parse(raw);
      const merged = {
        ...fallback,
        ...parsed,
        activeScoreOwner: GUEST_SCORE_OWNER,
        selectedWeek: clamp(
          Number(parsed.selectedWeek) || fallback.selectedWeek,
          1,
          8,
        ),
        themePreference: normalizeThemePreference(parsed.themePreference),
        profile: {
          ...fallback.profile,
          ...(parsed.profile || {}),
          maxes: {
            ...fallback.profile.maxes,
            ...((parsed.profile && parsed.profile.maxes) || {}),
          },
          benchmarks: {
            ...fallback.profile.benchmarks,
            ...((parsed.profile && parsed.profile.benchmarks) || {}),
          },
        },
      };

      return seedState(merged);
    } catch (error) {
      console.warn("Could not read saved state.", error);
      return seedState(fallback);
    }
  }

  /** @param {AppState} state @returns {AppState} */
  function seedState(state) {
    let next = migrateScoreState(state);
    const migration = migratePlanState(next);
    next = migration.state;
    const activePlan = selectActivePlan(next);
    if (activePlan) {
      const selection = resolvePlanTransition(activePlan, next.selectedWeek);
      next = { ...next, selectedWeek: selection.selectedWeek };
    }
    next = seedPrs(next);

    saveState(next);
    return next;
  }

  /** @param {AppState} state @returns {boolean} */
  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("Could not save state.", error);
      return false;
    }
  }

  /** @returns {ScoreData} */
  function emptyScoreData() {
    return { logs: [], prs: {}, prAttempts: [] };
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
    const prs =
      source.prs && typeof source.prs === "object" && !Array.isArray(source.prs)
        ? Object.fromEntries(
            Object.entries(source.prs).filter(
              ([metricId, record]) =>
                metricId && record && typeof record === "object",
            ),
          )
        : {};
    return { logs, prs, prAttempts };
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
    });
    const guestScores = normalizeScoreData(scoreDataByOwner[GUEST_SCORE_OWNER]);
    scoreDataByOwner[GUEST_SCORE_OWNER] = {
      logs: mergeById(legacyScores.logs, guestScores.logs),
      prs: mergePrs(legacyScores.prs, guestScores.prs),
      prAttempts: mergeById(legacyScores.prAttempts, guestScores.prAttempts),
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
      schemaVersion: Math.max(Number(state.schemaVersion) || 0, 3),
      scoreDataByOwner,
      activeScoreOwner,
    };
    delete next.logs;
    delete next.prs;
    delete next.prAttempts;
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
      prs: mergeBestPrs(localScores.prs, remoteScores.prs, true),
    };
  }

  function App() {
    const [appState, setAppState] = ReactRuntime.useState(loadState);
    const appStateRef = ReactRuntime.useRef(appState);
    appStateRef.current = appState;
    const [activeView, setActiveView] = ReactRuntime.useState("dashboardView");
    const [toast, setToast] = ReactRuntime.useState("");
    const [systemTheme, setSystemTheme] = ReactRuntime.useState(getSystemTheme);
    const [remoteStore] = ReactRuntime.useState(createRemoteStore);
    const [remoteUser, setRemoteUser] = ReactRuntime.useState(null);
    const [localSaveError, setLocalSaveError] = ReactRuntime.useState("");
    const [syncStatus, setSyncStatus] = ReactRuntime.useState(() => ({
      state: remoteStore ? "signed-out" : "not-configured",
      message: remoteStore
        ? "Sign in to sync logs and PRs."
        : remoteSetupMessage(),
    }));
    const [pendingTimerResult, setPendingTimerResult] =
      ReactRuntime.useState(null);
    const [logSelection, setLogSelection] = ReactRuntime.useState(() =>
      defaultSessionSelection(appState),
    );
    const toastTimer = ReactRuntime.useRef(null);
    const authenticatedOwnerRef = ReactRuntime.useRef(null);
    const loadingOwnerRef = ReactRuntime.useRef(null);
    const loadedOwnerRef = ReactRuntime.useRef(null);
    const authEpochRef = ReactRuntime.useRef(0);
    const themePreference = normalizeThemePreference(appState.themePreference);
    const activeTheme = resolveTheme(themePreference, systemTheme);
    const scoreData = selectScoreData(appState);
    const viewState = { ...appState, ...scoreData };

    const updateAppState = ReactRuntime.useCallback((updater) => {
      const current = appStateRef.current;
      const next = typeof updater === "function" ? updater(current) : updater;
      appStateRef.current = next;
      const saved = saveState(next);
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
        setRemoteUser(session.user);
        updateAppState((current) =>
          seedPrs(
            {
              ...current,
              activeScoreOwner: ownerId,
              scoreDataByOwner: {
                ...current.scoreDataByOwner,
                [ownerId]: selectScoreData(current, ownerId),
              },
            },
            ownerId,
          ),
        );
        setSyncStatus({
          state: "loading",
          message: "Loading scores from Supabase...",
        });
        try {
          const hydrated = await hydrateRemoteScores(ownerId, authEpoch);
          if (!hydrated || !isCurrentAuth(ownerId, authEpoch)) return;
          loadedOwnerRef.current = authToken;
          setSyncStatus({
            state: "signed-in",
            message: "Scores are syncing with Supabase.",
          });
        } catch (error) {
          console.warn("Could not load Supabase scores.", error);
          if (!isCurrentAuth(ownerId, authEpoch)) return;
          setSyncStatus({
            state: "error",
            message: "Could not load Supabase scores.",
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
      (message = "Sign in to sync logs and PRs.") => {
        authEpochRef.current += 1;
        authenticatedOwnerRef.current = null;
        loadingOwnerRef.current = null;
        loadedOwnerRef.current = null;
        setRemoteUser(null);
        updateAppState((current) => ({
          ...current,
          activeScoreOwner: GUEST_SCORE_OWNER,
        }));
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
      (dayId, weekNumber) => {
        const week = clamp(Number(weekNumber) || appState.selectedWeek, 1, 8);
        setLogSelection({ dayId });
        updateAppState((current) => ({ ...current, selectedWeek: week }));
        activateView("logView");
      },
      [activateView, appState.selectedWeek, updateAppState],
    );

    const finishTimerToLog = ReactRuntime.useCallback(
      (session, timerResult, competitionProof = null) => {
        const week = clamp(Number(session.week) || appState.selectedWeek, 1, 8);
        setPendingTimerResult({
          ...timerResult,
          competitionProof,
          sessionSnapshot: session,
          dayId: session.id,
          week,
        });
        setLogSelection({ dayId: session.id });
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
      const planId =
        replaceActive && currentActivePlan?.kind === "generated"
          ? currentActivePlan.id
          : createId();
      const nextPlan = {
        id: planId,
        title: `${GOAL_LABELS[options.goal] || "Generated"} programme`,
        kind: "generated",
        generatorOptions: options,
        generationSeed,
        createdAt:
          planId === currentActivePlan?.id ? currentActivePlan.createdAt : now,
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
        selectedWeek: 1,
      }));
      setLogSelection({
        dayId: normalizedSessions[0]?.id || getNextDayForToday().id,
      });
      setPendingTimerResult(null);
      notify(
        planId === currentActivePlan?.id
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
          sessions: storedPlan.sessions.map((existing) =>
            existing.id !== editingSessionId
              ? existing
              : {
                  ...existing,
                  ...session,
                  id: existing.id,
                  createdAt: existing.createdAt,
                  customized:
                    existing.origin === "generated" || existing.generated
                      ? true
                      : existing.customized,
                },
          ),
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
      activateView("programView");
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

    return h(
      ReactRuntime.Fragment,
      null,
      h(
        "div",
        { className: "app-shell" },
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
            h(ThemeControl, {
              value: themePreference,
              onChange: (nextPreference) => {
                updateAppState((current) => ({
                  ...current,
                  themePreference: normalizeThemePreference(nextPreference),
                }));
              },
            }),
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
            onViewPlan: () => activateView("programView"),
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
              window.localStorage.removeItem(STORAGE_KEY);
              let next = loadState();
              const ownerId = String(remoteUser?.id || "");
              if (ownerId) {
                next = seedPrs({ ...next, activeScoreOwner: ownerId }, ownerId);
                loadedOwnerRef.current = null;
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
                  message: "Refreshing account scores before sync...",
                });
                try {
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
                  const optionalMetadataPending = proofPending + timerPending;
                  setSyncStatus({
                    state: "signed-in",
                    message: optionalMetadataPending
                      ? "Scores synced. Timer or competition-proof metadata stays local until the Supabase schema is updated."
                      : "Local scores synced to Supabase.",
                  });
                  notify(
                    optionalMetadataPending
                      ? `Synced local records; ${optionalMetadataPending} optional metadata item${optionalMetadataPending === 1 ? "" : "s"} still need the Supabase schema update.`
                      : `Synced ${uploaded.logs + uploaded.prAttempts + uploaded.prs} local records.`,
                  );
                } catch (error) {
                  console.warn("Could not sync local scores.", error);
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  setSyncStatus({
                    state: "error",
                    message: "Could not sync local scores.",
                  });
                  notify("Could not sync local scores.");
                }
              },
              onImportGuest: async () => {
                if (!remoteStore || !remoteUser) return;
                const ownerId = String(remoteUser.id || "");
                const authEpoch = authEpochRef.current;
                if (!ownerId || !isCurrentAuth(ownerId, authEpoch)) return;
                setSyncStatus({
                  state: "loading",
                  message: "Refreshing account scores before import...",
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
                  const refreshed = await hydrateRemoteScores(
                    ownerId,
                    authEpoch,
                  );
                  if (!refreshed || !isCurrentAuth(ownerId, authEpoch)) return;
                  const optionalMetadataPending =
                    (uploaded.competitionProofPending || 0) +
                    (uploaded.timerResultPending || 0);
                  setSyncStatus({
                    state: "signed-in",
                    message: optionalMetadataPending
                      ? "Guest scores imported. Timer or competition-proof metadata stays local until the Supabase schema is updated."
                      : "Guest scores imported and synced.",
                  });
                  notify(
                    optionalMetadataPending
                      ? `Imported guest scores; ${optionalMetadataPending} optional metadata item${optionalMetadataPending === 1 ? "" : "s"} still need the Supabase schema update.`
                      : `Imported ${uploaded.logs + uploaded.prAttempts + uploaded.prs} guest records.`,
                  );
                } catch (error) {
                  console.warn("Could not import guest scores.", error);
                  if (!isCurrentAuth(ownerId, authEpoch)) return;
                  setSyncStatus({
                    state: "error",
                    message: "Could not safely import guest scores.",
                  });
                  notify("Guest scores were not imported. Retry when online.");
                }
              },
            }),
          }),
          h(ProgramView, {
            appState: viewState,
            activeView,
            onWeekChange: setSelectedWeek,
            onLogSession: jumpToLog,
            onTimerFinish: finishTimerToLog,
          }),
          h(BuilderView, {
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
          }),
          h(LearnView, { activeView }),
          h(ProofView, {
            appState: viewState,
            activeView,
            onFinish: finishTimerToLog,
          }),
          h(LogView, {
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
              updateAppState((current) =>
                updateScoreData(
                  current,
                  (scores) => ({
                    ...scores,
                    logs: mergeById(scores.logs, [log]),
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
                remoteStore
                  .saveLog(log, ownerId)
                  .then((syncResult) => {
                    if (!isCurrentAuth(ownerId, authEpoch)) return;
                    const optionalMetadataPending =
                      syncResult?.competitionProofSynced === false ||
                      syncResult?.timerResultSynced === false;
                    setSyncStatus({
                      state: "signed-in",
                      message: optionalMetadataPending
                        ? "Workout saved. Timer or competition-proof metadata remains local until the Supabase schema is updated."
                        : "Scores are syncing with Supabase.",
                    });
                    notify(
                      optionalMetadataPending
                        ? "Workout saved. Timer or proof metadata stays local until the Supabase schema is updated."
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
                    notify("Workout saved locally. Remote sync is pending.");
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
          }),
          h(PrView, {
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
                    notify(attempt.isPr ? "New PR synced." : "Attempt synced.");
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
                    notify("PR attempt saved locally. Remote sync is pending.");
                  });
              }
              return Promise.resolve();
            },
          }),
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
    const localRecordCount =
      appState.logs.length +
      appState.prAttempts.length +
      Object.keys(appState.prs || {}).length;
    const guestScores = normalizeScoreData(
      appState.scoreDataByOwner?.[GUEST_SCORE_OWNER],
    );
    const guestRecordCount =
      guestScores.logs.length +
      guestScores.prAttempts.length +
      Object.keys(guestScores.prs).length;

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
                  disabled:
                    syncStatus.state === "loading" || localRecordCount === 0,
                },
                "Retry account sync",
              ),
              guestRecordCount
                ? h(
                    "button",
                    {
                      className: "ghost-button",
                      type: "button",
                      onClick: onImportGuest,
                      disabled: syncStatus.state === "loading",
                    },
                    `Import guest scores (${guestRecordCount})`,
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

  function DashboardView({
    appState,
    activeView,
    onWeekChange,
    onJumpLog,
    onTimerFinish,
    onViewPlan,
    onSaveProfile,
    onReset,
    accountSyncPanel,
  }) {
    const logsThisWeek = appState.logs.filter(
      (log) => log.week === appState.selectedWeek,
    );
    const activePlan = selectActivePlan(appState);
    const weekSessions = activePlan
      ? selectActiveWeekSessions(appState, appState.selectedWeek).map(
          customPlanToSession,
        )
      : getProgramDays().map((day) =>
          buildSession(day.id, appState.selectedWeek, appState.profile),
        );
    const mainDayIds = weekSessions.map((session) => session.id);
    const completedDayIds = new Set(
      logsThisWeek
        .filter((log) => mainDayIds.includes(log.dayId))
        .map((log) => log.dayId),
    );
    const completedDays = completedDayIds.size;
    const latestRpe = appState.logs.find((log) => log.rpe);
    const latestPr = appState.prAttempts.find((attempt) => attempt.isPr);
    const weekSessionCount = weekSessions.length;
    const weekPercent = weekSessionCount
      ? Math.round((completedDays / weekSessionCount) * 100)
      : 0;
    const nextDay = getNextDayForToday();
    const session = activePlan
      ? weekSessions.find((item) => !completedDayIds.has(item.id)) ||
        weekSessions[0]
      : weekSessions.find((item) => item.id === nextDay.id) || weekSessions[0];

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
          h("p", { className: "eyebrow" }, "Today"),
          h("h2", { id: "dashboardTitle" }, "Training dashboard"),
        ),
        h(WeekSelect, {
          id: "dashboardWeek",
          label: "Dashboard week",
          value: appState.selectedWeek,
          onChange: onWeekChange,
        }),
      ),
      h(
        "div",
        { className: "stats-grid", id: "statsGrid" },
        h(StatCard, {
          value: `${completedDays}/${weekSessionCount}`,
          label: "Sessions logged",
        }),
        h(StatCard, { value: `${weekPercent}%`, label: "Week complete" }),
        h(StatCard, {
          value: latestRpe ? latestRpe.rpe : "-",
          label: "Latest RPE",
        }),
        h(StatCard, {
          value: latestPr ? latestPr.metricName : "-",
          label: "Latest PR",
        }),
      ),
      h(
        "div",
        { id: "nextSession" },
        session
          ? h(
              "section",
              { className: "panel" },
              h(
                "div",
                { className: "session-topline" },
                h(
                  "div",
                  null,
                  h("p", { className: "eyebrow" }, "Next up"),
                  h("h3", null, `${session.weekday} - ${session.shortTitle}`),
                ),
                h(
                  "span",
                  { className: "metric-pill" },
                  `${session.duration || 60} min`,
                ),
              ),
              h("p", { className: "muted-copy" }, session.focus),
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
                h(
                  "button",
                  {
                    className: "primary-button",
                    type: "button",
                    onClick: () => onJumpLog(session.id, appState.selectedWeek),
                  },
                  "Log this",
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
              h(WorkoutTimer, {
                session,
                onFinish: onTimerFinish,
              }),
            )
          : h(
              "div",
              { className: "empty-state" },
              `No sessions are scheduled for week ${appState.selectedWeek}.`,
            ),
      ),
      h(ProfilePanel, {
        profile: appState.profile,
        onSave: onSaveProfile,
        onReset,
      }),
      h(RxReadinessPanel, { profile: appState.profile, logs: appState.logs }),
      accountSyncPanel,
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

  function NumberInput({ id, name, label, value, min = "1", onChange }) {
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
        value,
        onChange: (event) => onChange(event.target.value),
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
    return h(
      "section",
      { className: "panel", "aria-labelledby": "rxReadinessTitle" },
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
        { className: "stats-grid" },
        h(StatCard, {
          value: `${readiness.rxLevel}`,
          label: "RX Level",
        }),
        readiness.categories.map((category) =>
          h(StatCard, {
            key: category.id,
            value: `${category.score}%`,
            label: category.missing
              ? `${category.label} (${category.missing} tests)`
              : category.label,
            detail: category.summary,
          }),
        ),
      ),
      h("p", { className: "muted-copy" }, readiness.recommendation),
      readiness.missingTests.length
        ? h(
            "div",
            { className: "history-meta", "aria-label": "Missing RX tests" },
            readiness.missingTests.slice(0, 6).map((item) =>
              h(
                "span",
                {
                  className: "metric-pill",
                  key: `${item.categoryId}-${item.id}`,
                },
                `Test needed: ${item.label}`,
              ),
            ),
          )
        : null,
      h(
        "div",
        { className: "history-meta" },
        readiness.weakest.map((category) =>
          h(
            "span",
            { className: "metric-pill", key: category.id },
            `Focus: ${category.label}`,
          ),
        ),
      ),
    );
  }

  function ProgramView({
    appState,
    activeView,
    onWeekChange,
    onLogSession,
    onTimerFinish,
  }) {
    const week = WEEK_META.find((item) => item.week === appState.selectedWeek);
    const activePlan = selectActivePlan(appState);
    const activeWeekSessions = selectActiveWeekSessions(
      appState,
      appState.selectedWeek,
    );
    const programmeSessions = activePlan
      ? activeWeekSessions.map(customPlanToSession)
      : getProgramDays().map((day) =>
          buildSession(day.id, appState.selectedWeek, appState.profile),
        );

    return h(
      "section",
      {
        id: "programView",
        className: viewClass("programView", activeView),
        "aria-labelledby": "programTitle",
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
            activePlan ? "Active saved programme" : "Built-in eight-week cycle",
          ),
          h(
            "h2",
            { id: "programTitle" },
            activePlan ? activePlan.title : "Programme",
          ),
        ),
        h(WeekSelect, {
          id: "programWeek",
          label: "Programme week",
          value: appState.selectedWeek,
          onChange: onWeekChange,
        }),
      ),
      h(
        "div",
        { className: "week-note", id: "weekNote" },
        activePlan
          ? h(
              "p",
              null,
              h("strong", null, `Week ${appState.selectedWeek}.`),
              ` ${activeWeekSessions.length} session${activeWeekSessions.length === 1 ? "" : "s"} from ${activePlan.title}.`,
            )
          : h("p", null, h("strong", null, `${week.title}.`), ` ${week.note}`),
      ),
      h(
        "div",
        { className: "day-list", id: "programList" },
        programmeSessions.length
          ? programmeSessions.map((session) => {
              const storedSession = activeWeekSessions.find(
                (item) => item.id === session.id,
              );
              const logged = appState.logs.some(
                (log) =>
                  log.week === appState.selectedWeek &&
                  log.dayId === session.id,
              );
              return h(SessionCard, {
                key: session.id,
                session,
                tag: logged ? "Logged" : `${session.duration || 60} min`,
                meta: storedSession
                  ? customPlanMeta(storedSession, logged)
                  : null,
                onLog: () => onLogSession(session.id, appState.selectedWeek),
                onTimerFinish,
              });
            })
          : h(
              "div",
              { className: "empty-state" },
              `No sessions are scheduled for week ${appState.selectedWeek}.`,
            ),
      ),
    );
  }

  function customPlanToSession(plan) {
    return {
      id: plan.id,
      week: plan.week,
      weekday: `Week ${plan.week}`,
      shortTitle: plan.title,
      title: plan.title,
      focus: plan.focus,
      segments: customPlanSegments(plan),
      addOns: plan.addOns || [],
      duration: plan.duration,
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
        h(SegmentList, { segments: session.segments }),
        session.addOns && session.addOns.length
          ? h(AddOnList, { addOns: session.addOns })
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
        { className: "segment", key: segment.title },
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
  }) {
    const defaults = {
      goal: initialOptions?.goal || "stronger",
      daysPerWeek: Number(initialOptions?.daysPerWeek) || 4,
      weakness: initialOptions?.weakness || "squat",
      duration: positiveNumber(initialOptions?.duration, 60),
    };
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
            goal: String(data.get("generatorGoal") || "stronger"),
            daysPerWeek: Number(data.get("generatorDays") || 4),
            weakness: String(data.get("generatorWeakness") || "squat"),
            duration: positiveNumber(data.get("generatorDuration"), 60),
          };
          const generationSeed = createGenerationSeed();
          const generatedPlans = buildGeneratedProgramme(
            options,
            profile,
            createId,
            generationSeed,
          );
          onGenerate({
            sessions: generatedPlans,
            options,
            generationSeed,
            replaceActive: Boolean(data.get("replaceGenerated")),
          });
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
              defaultValue: defaults.goal,
            },
            h("option", { value: "stronger" }, "Get stronger"),
            h("option", { value: "endurance" }, "More endurance"),
            h("option", { value: "gymnastics" }, "Better gymnastics"),
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
          "Sessions per week",
          h(
            "select",
            {
              id: "generatorDays",
              name: "generatorDays",
              required: true,
              defaultValue: String(defaults.daysPerWeek),
            },
            h("option", { value: "4" }, "4 days"),
            h("option", { value: "3" }, "3 days"),
            h("option", { value: "5" }, "5 days"),
          ),
        ),
      ),
      h(
        "div",
        { className: "form-row" },
        h(
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
          h("input", {
            id: "generatorDuration",
            name: "generatorDuration",
            type: "number",
            min: "45",
            max: "60",
            step: "5",
            inputMode: "numeric",
            defaultValue: String(defaults.duration),
          }),
        ),
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
          defaultValue: (initialSession?.wod || []).join("\n"),
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
  }) {
    const [formVersion, setFormVersion] = ReactRuntime.useState(0);
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
          key: `${formVersion}-${matchingTimer ? matchingTimer.completedAt : "manual"}`,
          id: "logForm",
          className: "panel log-form",
          onSubmit: async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const storedDay = findTrainingSessionForState(
              String(data.get("logDay")),
              Number(data.get("logWeek")),
              appState,
            );
            const day =
              matchingTimer?.sessionSnapshot?.id === String(data.get("logDay"))
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
              id: createId(),
              date: String(data.get("logDate")),
              week: day.week || Number(data.get("logWeek")),
              dayId: day.id,
              dayTitle: day.shortTitle,
              readiness: String(data.get("readiness")),
              rpe: String(data.get("rpe") || "").trim(),
              strengthResult: String(data.get("strengthResult") || "").trim(),
              wodScore: String(data.get("wodScore") || "").trim(),
              timerResult,
              competitionProof: matchingTimer?.competitionProof || null,
              notes: String(data.get("logNotes") || "").trim(),
              mobilityDone: Boolean(data.get("mobilityDone")),
              createdAt: new Date().toISOString(),
            };

            try {
              await onSaveLog(log);
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
              defaultValue: todayInputValue(),
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
        h(
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
                onLogSelectionChange({
                  dayId: event.target.value,
                }),
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
              { id: "readiness", name: "readiness", defaultValue: "green" },
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
          }),
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
          }),
        ),
        h(
          "label",
          { className: "check-row" },
          h("input", {
            id: "mobilityDone",
            name: "mobilityDone",
            type: "checkbox",
          }),
          "Mobility completed",
        ),
        h(
          "button",
          { className: "primary-button", type: "submit" },
          "Save workout log",
        ),
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
            ? appState.logs
                .slice(0, 12)
                .map((log) => h(LogHistoryItem, { key: log.id, log }))
            : h(
                "div",
                { className: "empty-state" },
                "No workout logs yet. Save your first session after training.",
              ),
        ),
      ),
    );
  }

  function LogHistoryItem({ log }) {
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
          { className: `metric-pill readiness-${log.readiness}` },
          READINESS_LABELS[log.readiness] || log.readiness,
        ),
        log.rpe
          ? h("span", { className: "metric-pill" }, `RPE ${log.rpe}`)
          : null,
        log.mobilityDone
          ? h("span", { className: "metric-pill" }, "Mobility done")
          : null,
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

    return h(
      "section",
      {
        id: "prView",
        className: viewClass("prView", activeView),
        "aria-labelledby": "prTitle",
      },
      h(
        "div",
        { className: "section-heading" },
        h(
          "div",
          null,
          h("p", { className: "eyebrow" }, "Personal records"),
          h("h2", { id: "prTitle" }, "PR tracker"),
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
            const metric = PR_METRICS.find(
              (item) => item.id === data.get("prMetric"),
            );
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
      ["dashboardView", "Home"],
      ["programView", "Plan"],
      ["builderView", "Build"],
      ["learnView", "Learn"],
      ["proofView", "Proof"],
      ["logView", "Log"],
      ["prView", "PRs"],
    ];

    return h(
      "nav",
      { className: "bottom-nav", "aria-label": "Main navigation" },
      items.map(([viewId, label]) =>
        h(
          "button",
          {
            key: viewId,
            className: `nav-button${activeView === viewId ? " is-active" : ""}`,
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

  const root = ReactDOMRuntime.createRoot(rootElement);
  root.render(h(AppErrorBoundary, null, h(App)));
})();
