"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { cloneDefaultProfile, workoutItemsForSession } = require("../app.js");
const { INTERMEDIATE_V2_ATHLETE } = require("./fixtures/v2-athletes.js");

function freshRequire(file) {
  const modulePath = require.resolve(file);
  delete require.cache[modulePath];
  return require(modulePath);
}

function createMatchMedia(matches = false) {
  const listeners = new Set();

  return (query) => ({
    matches,
    media: query,
    addEventListener: (event, listener) => {
      if (event === "change") listeners.add(listener);
    },
    removeEventListener: (event, listener) => {
      if (event === "change") listeners.delete(listener);
    },
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    dispatch: (nextMatches) => {
      listeners.forEach((listener) =>
        listener({ matches: nextMatches, media: query }),
      );
    },
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createMockSupabase({
  session = null,
  remote = {},
  calls = [],
  failUpsert = [],
  failUpsertOnce = {},
  failSelectOnce = {},
  getSessionResult = null,
  missingUpsertColumns = [],
  rpcResults = {},
} = {}) {
  let currentSession = session;
  const authListeners = new Set();
  const data = {
    athlete_states: remote.athlete_states || [],
    athlete_movement_restrictions: remote.athlete_movement_restrictions || [],
    programming_engine_flags: remote.programming_engine_flags || [],
    workout_logs: remote.workout_logs || [],
    pr_attempts: remote.pr_attempts || [],
    training_events: remote.training_events || [],
    readiness_checks: remote.readiness_checks || [],
    personal_records: (remote.personal_records || []).map((record) => ({
      ...record,
      updated_at:
        record.updated_at || record.updatedAt || "1970-01-01T00:00:00.000Z",
    })),
  };

  function ok(value) {
    return Promise.resolve({ data: value, error: null });
  }

  const client = {
    auth: {
      getSession: () => getSessionResult || ok({ session: currentSession }),
      onAuthStateChange: (callback) => {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(callback),
            },
          },
        };
      },
      signInWithOtp: (payload) => {
        calls.push({ type: "signInWithOtp", payload });
        return ok({});
      },
      signOut: () => {
        calls.push({ type: "signOut" });
        return ok({});
      },
    },
    from: (table) => ({
      select: () => {
        calls.push({ type: "select", table });
        const selected = () => {
          const remainingFailures = Number(failSelectOnce[table]) || 0;
          if (remainingFailures > 0) {
            failSelectOnce[table] = remainingFailures - 1;
            return Promise.resolve({
              data: null,
              error: { code: "NETWORK_ERROR", message: "Offline" },
            });
          }
          return ok(data[table]);
        };
        if (table === "personal_records") return selected();
        if (
          table === "athlete_states" ||
          table === "programming_engine_flags"
        ) {
          let ownerId = null;
          const ownerBuilder = {
            eq: (_column, value) => {
              ownerId = String(value);
              return ownerBuilder;
            },
            maybeSingle: async () => {
              const result = await selected();
              if (result.error) return result;
              return {
                ...result,
                data:
                  result.data.find((row) => String(row.user_id) === ownerId) ||
                  null,
              };
            },
          };
          return ownerBuilder;
        }
        if (table === "athlete_movement_restrictions") {
          return {
            eq: async (_column, value) => {
              const result = await selected();
              return result.error
                ? result
                : {
                    ...result,
                    data: result.data.filter(
                      (row) => String(row.user_id) === String(value),
                    ),
                  };
            },
          };
        }
        const builder = {
          order: () => builder,
          range: async (from, to) => {
            const result = await selected();
            return result.error
              ? result
              : { ...result, data: result.data.slice(from, to + 1) };
          },
        };
        return builder;
      },
      upsert: (payload) => {
        calls.push({ type: "upsert", table, payload });
        if (table === "athlete_states") {
          return {
            select: () => ({
              single: async () => {
                const row = {
                  ...payload,
                  updated_at: new Date().toISOString(),
                };
                const index = data.athlete_states.findIndex(
                  (item) => item.user_id === row.user_id,
                );
                if (index >= 0) data.athlete_states[index] = row;
                else data.athlete_states.push(row);
                return ok(row);
              },
            }),
          };
        }
        const rows = Array.isArray(payload) ? payload : [payload];
        const missingColumn = missingUpsertColumns.find((column) =>
          rows.some((row) => Object.hasOwn(row, column)),
        );
        if (missingColumn) {
          return Promise.resolve({
            data: null,
            error: {
              code: "PGRST204",
              message: `Could not find the '${missingColumn}' column in the schema cache`,
            },
          });
        }
        const remainingFailures = Number(failUpsertOnce[table]) || 0;
        if (failUpsert.includes(table) || remainingFailures > 0) {
          if (remainingFailures > 0) {
            failUpsertOnce[table] = remainingFailures - 1;
          }
          return Promise.resolve({
            data: null,
            error: { code: "NETWORK_ERROR", message: "Offline" },
          });
        }
        return ok(payload);
      },
      delete: () => ({
        neq: (column, value) => {
          calls.push({ type: "delete", table, column, value });
          return ok([]);
        },
      }),
    }),
    rpc: (name, payload) => {
      calls.push({ type: "rpc", name, payload });
      const configured = rpcResults[name];
      return Promise.resolve(
        typeof configured === "function"
          ? configured(payload)
          : configured === undefined
            ? null
            : configured,
      ).then((value) => ({ data: value, error: null }));
    },
  };

  return {
    client,
    authListenerCount() {
      return authListeners.size;
    },
    emitAuth(event, nextSession) {
      currentSession = nextSession;
      authListeners.forEach((listener) => listener(event, nextSession));
    },
    supabase: {
      createClient: () => client,
    },
  };
}

function mountApp({
  prefersDark = false,
  supabaseMock = null,
  supabaseConfig = true,
  recordingSupport = false,
  storedState = null,
  confirmResponses = [true],
  apiOverrides = null,
  url = "http://localhost/",
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><head><meta name="theme-color" content="#10120f"></head><body><div id="root"></div></body></html>',
    {
      pretendToBeVisual: true,
      url,
    },
  );

  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.MutationObserver = dom.window.MutationObserver;
  global.FormData = dom.window.FormData;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
    dom.window,
  );
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
    dom.window,
  );

  const confirmCalls = [];
  const queuedConfirmResponses = [...confirmResponses];
  dom.window.confirm = (message) => {
    confirmCalls.push(String(message));
    return queuedConfirmResponses.length
      ? queuedConfirmResponses.shift()
      : true;
  };
  dom.window.scrollTo = () => undefined;
  dom.window.matchMedia = createMatchMedia(prefersDark);
  if (recordingSupport) installRecordingMocks(dom.window);
  if (storedState) {
    dom.window.localStorage.setItem(
      "forge-hour-state-v1",
      typeof storedState === "string"
        ? storedState
        : JSON.stringify(storedState),
    );
  }
  dom.window.React = require("react");
  const reactDomClient = require("react-dom/client");
  const reactDom = require("react-dom");
  let appRoot = null;
  dom.window.ReactDOM = {
    ...reactDomClient,
    createRoot(container) {
      appRoot = reactDomClient.createRoot(container);
      return {
        ...appRoot,
        render(node) {
          reactDom.flushSync(() => appRoot.render(node));
        },
      };
    },
  };
  if (supabaseMock) {
    dom.window.supabase = supabaseMock.supabase;
    if (supabaseConfig)
      dom.window.ForgeHourSupabaseConfig = {
        url: "https://example.supabase.co",
        anonKey: "public-anon-key",
      };
  }

  const localStateApi = freshRequire("../local-state-store.js");
  const achievementApi = freshRequire("../achievements.js");
  dom.window.ForgeHourLocalState = {
    ...localStateApi,
    createLocalStateStore: (storage) =>
      localStateApi.createLocalStateStore(storage, { legacySnapshotDelay: 0 }),
  };
  dom.window.ForgeHourAchievements = achievementApi;
  freshRequire("../app.js");
  freshRequire("../supabase-sync.js");
  dom.window.ForgeHour = global.ForgeHour;
  if (apiOverrides) Object.assign(dom.window.ForgeHour, apiOverrides);
  dom.window.ForgeHourSync = global.ForgeHourSync;
  dom.window.ForgeHourProgrammingV2 = freshRequire(
    "../build/programming-v2.cjs",
  );
  freshRequire("../react-app.js");

  const testingLibrary = require("@testing-library/react");
  testingLibrary.configure({ asyncUtilTimeout: 5000 });
  const ui = testingLibrary.within(dom.window.document.body);

  return {
    dom,
    fireEvent: testingLibrary.fireEvent,
    waitFor: testingLibrary.waitFor,
    ui,
    confirmCalls,
    readState() {
      return JSON.parse(dom.window.localStorage.getItem("forge-hour-state-v1"));
    },
    view(id) {
      return testingLibrary.within(dom.window.document.querySelector(`#${id}`));
    },
    cleanup() {
      if (appRoot) testingLibrary.act(() => appRoot.unmount());
      testingLibrary.cleanup();
      dom.window.close();
      delete global.window;
      delete global.document;
      delete global.navigator;
      delete global.HTMLElement;
      delete global.Node;
      delete global.MutationObserver;
      delete global.FormData;
      delete global.requestAnimationFrame;
      delete global.cancelAnimationFrame;
    },
  };
}

function installRecordingMocks(browserWindow) {
  const cameraTracks = [
    { kind: "video", stop: () => undefined },
    { kind: "audio", stop: () => undefined },
  ];
  const cameraStream = {
    getTracks: () => cameraTracks,
    getAudioTracks: () =>
      cameraTracks.filter((track) => track.kind === "audio"),
  };
  const canvasTrack = { kind: "video", stop: () => undefined };
  const canvasStream = {
    addTrack: () => undefined,
    getVideoTracks: () => [canvasTrack],
  };
  const canvasContext = {
    drawImage: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    measureText: (value) => ({ width: String(value).length * 8 }),
    restore: () => undefined,
    save: () => undefined,
    set fillStyle(value) {},
    set font(value) {},
    set textAlign(value) {},
  };
  const temporaryChunks = [];
  const temporaryWritable = {
    write: async (chunk) => temporaryChunks.push(chunk),
    close: async () => undefined,
    abort: async () => undefined,
  };
  const temporaryFileHandle = {
    createWritable: async () => temporaryWritable,
    getFile: async () =>
      new browserWindow.Blob(temporaryChunks, { type: "video/mp4" }),
  };
  const temporaryRoot = {
    getFileHandle: async () => temporaryFileHandle,
    removeEntry: async () => undefined,
  };

  Object.defineProperty(browserWindow.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => cameraStream },
  });
  Object.defineProperty(browserWindow.navigator, "storage", {
    configurable: true,
    value: { getDirectory: async () => temporaryRoot },
  });
  browserWindow.HTMLMediaElement.prototype.play = () => Promise.resolve();
  browserWindow.HTMLCanvasElement.prototype.getContext = () => canvasContext;
  browserWindow.HTMLCanvasElement.prototype.captureStream = () => canvasStream;
  browserWindow.URL.createObjectURL = () => "blob:competition-proof";
  browserWindow.URL.revokeObjectURL = () => undefined;

  class MockMediaRecorder {
    static isTypeSupported(mimeType) {
      return mimeType.startsWith("video/mp4");
    }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || "video/mp4";
      this.state = "inactive";
      browserWindow.__mockMediaRecorder = this;
    }

    start() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new browserWindow.Blob(["proof-video"], {
            type: this.mimeType,
          }),
        });
      }
      if (this.onstop) this.onstop();
    }
  }

  browserWindow.MediaRecorder = MockMediaRecorder;
}

function activeScores(state) {
  const owner = state.activeScoreOwner || "guest";
  return (
    state.scoreDataByOwner?.[owner] || {
      logs: state.logs || [],
      prs: state.prs || {},
      prAttempts: state.prAttempts || [],
    }
  );
}

function sessionWod(session) {
  return workoutItemsForSession(session)[0];
}

function openMore(mounted) {
  mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "More" }));
}

function openMoreTool(mounted, name) {
  openMore(mounted);
  mounted.fireEvent.click(mounted.ui.getByRole("button", { name }));
}

async function waitForSignedIn(mounted, { openAccount = false } = {}) {
  await mounted.waitFor(() => {
    assert.equal(
      document.querySelector(".app-shell")?.dataset.syncState,
      "signed-in",
    );
  });
  if (openAccount) openMore(mounted);
}

function workoutExercises(definition) {
  const main =
    definition?.format?.type === "emom"
      ? (definition.format.stations || []).flatMap(
          (station) => station.exercises || [],
        )
      : definition?.exercises || [];
  return [
    ...(definition?.buyIn || []),
    ...main,
    ...(definition?.afterEachRound || []),
    ...(definition?.cashOut || []),
  ];
}

function canonicalPlanState({
  kind = "custom",
  customized = true,
  logs = [],
} = {}) {
  const session = {
    id: "saved-session-1",
    week: 1,
    title: "Saved canonical session",
    focus: "One source of truth",
    warmup: ["Easy row"],
    strength: ["Back squat 5x5"],
    wod: ["AMRAP 12: row, burpees, and pull-ups"],
    mobility: ["Easy breathing"],
    duration: 60,
    intensity: "Moderate",
    generated: kind === "generated",
    origin: kind === "generated" ? "generated" : "manual",
    customized,
    sourceGoal: kind === "generated" ? "balanced" : undefined,
    sourceWeakness: kind === "generated" ? "pulling" : undefined,
    wodSchemaVersion: 4,
    generationSeed: kind === "generated" ? "fixture-seed" : undefined,
    createdAt: "2026-07-01T10:00:00.000Z",
  };
  return {
    schemaVersion: 2,
    plans: [
      {
        id: "saved-plan-1",
        title: "Canonical programme",
        kind,
        generatorOptions:
          kind === "generated"
            ? {
                goal: "balanced",
                daysPerWeek: 4,
                weakness: "pulling",
                duration: 60,
              }
            : null,
        generationSeed: kind === "generated" ? "fixture-seed" : null,
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-01T10:00:00.000Z",
        sessions: [session],
      },
    ],
    activePlanId: "saved-plan-1",
    selectedWeek: 1,
    logs,
  };
}

function historicalEightWeekStrengthState() {
  const v2 = freshRequire("../build/programming-v2.cjs");
  const programmeId = "85c58cda-cf7a-45e2-acdd-71f8331dd7a2";
  const sessionId = "0570808e-8649-4c80-a407-14d62191fd28";
  const program = v2.generateV2Program({
    ...INTERMEDIATE_V2_ATHLETE,
    programId: programmeId,
    ownerId: null,
    generatedAt: "2026-08-04T08:37:52.473Z",
    blockType: "back_squat_strength",
    goal: "strength",
    templateId: "mixed_strength_8w_testing",
    sessionCount: 2,
    seed: "historical-strength-programme",
    restrictions: {
      movementIds: [],
      movementFamilyIds: [],
      guidance: null,
    },
    weightIncrementKg: 2.5,
    roundingMode: "nearest",
  });
  const persistedVersion = "mixed-strength-6w-v1";
  program.templateVersion = persistedVersion;
  program.generatorVersion = persistedVersion;
  program.generationRequest.programmeVersion = persistedVersion;
  delete program.programmeProfile;
  delete program.generationSummary;
  const block = program.trainingBlocks[0];
  program.name = "Eight-week strength testing block";
  block.name = "Eight-week strength testing block";
  block.currentWeek = 2;
  const completedSession = block.trainingWeeks[1].sessions[0];
  completedSession.id = sessionId;
  completedSession.warmup.sessionId = sessionId;
  completedSession.conditioning.sessionId = sessionId;
  completedSession.sections.forEach((section) => {
    section.sessionId = sessionId;
  });
  completedSession.exercises.forEach((exercise) => {
    exercise.sessionId = sessionId;
  });
  completedSession.status = "completed";
  completedSession.revision = 2;
  completedSession.feedback = {
    sessionId,
    completed: true,
    sessionRpe: 8,
    fatigue: 6,
    painReported: false,
    durationMinutesActual: completedSession.estimatedDurationMinutes,
    notes: "Historical progress must survive reload.",
    completedAt: "2026-08-10T15:57:51.788Z",
    results: completedSession.trackAssignments.map((assignment) => {
      const exercise = completedSession.exercises.find(
        (item) => item.progressionTrackId === assignment.progressionTrackId,
      );
      return {
        prescriptionId: exercise.id,
        progressionTrackId: assignment.progressionTrackId,
        completedSets: exercise.sets,
        completedReps: exercise.reps ?? exercise.repRangeMin,
        loadKg: exercise.loadKg,
        achievedRpe: 8,
        successful: true,
        painReported: false,
      };
    }),
  };
  program.validation = v2.validateProgram(program);
  return {
    ...canonicalPlanState(),
    activeProgrammingEngine: "v2",
    activeV2ProgramId: programmeId,
    selectedWeek: 2,
    v2Programs: [program],
    v2ProgramRevisions: { [programmeId]: 4 },
  };
}

function privateAthleteState(name, planState = canonicalPlanState()) {
  return {
    profile: { ...cloneDefaultProfile(), athleteName: name },
    plans: planState.plans,
    activePlanId: planState.activePlanId,
    selectedWeek: planState.selectedWeek,
    planSchemaVersion: 3,
  };
}

function sparsePlanFixture({ id, title, week }) {
  const session = {
    ...canonicalPlanState().plans[0].sessions[0],
    id: `${id}-session`,
    week,
    title: `${title} week ${week} session`,
    focus: `${title} fallback week`,
    wod: [`AMRAP ${week + 10}: ${title} workout`],
  };
  return {
    id,
    title,
    kind: "custom",
    generatorOptions: null,
    generationSeed: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    sessions: [session],
  };
}

async function assertPlanSessionAcrossViews(mounted, plan) {
  const { fireEvent, readState, ui, view, waitFor } = mounted;
  const session = plan.sessions[0];

  await waitFor(() => {
    const state = readState();
    assert.equal(state.activePlanId, plan.id);
    assert.equal(state.selectedWeek, session.week);
  });

  fireEvent.click(ui.getByRole("button", { name: "Calendar" }));
  const programView = view("calendarView");
  assert.ok(
    programView.getByText(new RegExp(plan.title), {
      selector: ".calendar-programme-summary-copy",
    }),
  );
  assert.equal(
    programView.getByLabelText("Programme week").value,
    String(session.week),
  );
  assert.ok(programView.getByText(sessionWod(session)));

  openMoreTool(mounted, "Build programme");
  const builderView = view("builderView");
  assert.equal(builderView.getByLabelText("Active plan").value, plan.id);
  assert.ok(builderView.getByText(sessionWod(session)));

  openMoreTool(mounted, "Competition proof");
  const proofView = view("proofView");
  await waitFor(() => {
    const option = proofView.getByRole("option", {
      name: new RegExp(session.title),
    });
    assert.equal(option.value, session.id);
    assert.equal(proofView.getByLabelText("Workout source").value, session.id);
  });

  fireEvent.click(ui.getByRole("button", { name: "Log" }));
  const logView = view("logView");
  await waitFor(() => {
    assert.equal(logView.getByLabelText("Week").value, String(session.week));
    assert.equal(logView.getByLabelText("Session").value, session.id);
  });
}

test("React Testing Library renders the dashboard and bottom navigation", async () => {
  const mounted = mountApp();
  const { cleanup, fireEvent, ui, view } = mounted;

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    assert.ok(ui.getByText("Today's decision"));
    assert.ok(ui.getByRole("button", { name: "Start and log workout" }));
    assert.ok(ui.getByText(/Movement coaching \(/));
    assert.ok(ui.getByRole("heading", { name: "Achievements" }));
    assert.ok(ui.getByRole("button", { name: "Today" }));
    assert.ok(ui.getByRole("button", { name: "Calendar" }));
    assert.ok(ui.getByRole("button", { name: "Log" }));
    assert.ok(ui.getByRole("button", { name: "Progress" }));
    assert.ok(ui.getByRole("button", { name: "More" }));
    assert.equal(
      document.querySelectorAll(".bottom-nav .nav-button").length,
      5,
    );
    fireEvent.click(ui.getByRole("button", { name: "Progress" }));
    const progressView = view("progressView");
    assert.ok(
      await progressView.findByRole("heading", { name: "Your achievements" }),
    );
    assert.ok(progressView.getByRole("heading", { name: "Consistency" }));
    assert.ok(progressView.getByRole("heading", { name: "Skills" }));
    assert.ok(
      await progressView.findByRole("heading", {
        name: "RX readiness",
        level: 3,
      }),
    );
    assert.ok(ui.getByText("RX Level"));
    assert.equal(
      ui
        .getByRole("progressbar", { name: "Overall RX Level" })
        .getAttribute("aria-valuemax"),
      "100",
    );
    assert.ok(ui.getByRole("heading", { name: "Suggested focus" }));
    assert.ok(ui.getAllByText("Why this score?").length >= 7);
    fireEvent.click(ui.getByRole("button", { name: "More" }));
    assert.ok(ui.getByRole("heading", { name: "Masters RX assessment" }));
    assert.ok(ui.getByText("Strict press: 60 kg vs 75 kg."));
    assert.ok(ui.getAllByText("Men Masters 35-39").length >= 1);
    assert.ok(ui.getByLabelText("Deadlift 1RM"));
    assert.ok(ui.getByLabelText("Unbroken ring muscle-ups"));
    assert.ok(ui.getByRole("button", { name: "Build programme" }));
    assert.ok(ui.getByRole("button", { name: "Movement library" }));
    assert.ok(ui.getByRole("button", { name: "Competition proof" }));
    assert.equal(document.querySelector("#builderView"), null);
    assert.equal(document.querySelector("#learnView"), null);
    assert.equal(document.querySelector("#logView"), null);
    assert.equal(
      Array.from(
        document.querySelectorAll("#nextSession .timer-panel button"),
      ).some((button) => button.textContent === "Competition proof"),
      false,
    );
  } finally {
    cleanup();
  }
});

test("React unlocks a first bar muscle-up once and persists it across reload", async () => {
  const first = mountApp();
  let savedState;

  try {
    await first.waitFor(() => {
      const state = first.readState();
      assert.ok(
        activeScores(state).achievementState.acknowledgedIds.includes(
          "rx-contender",
        ),
      );
    });
    openMore(first);
    first.fireEvent.change(first.ui.getByLabelText("Unbroken bar muscle-ups"), {
      target: { value: "1" },
    });
    first.fireEvent.click(
      first.ui.getByRole("button", { name: "Save assessment" }),
    );

    await first.waitFor(() => {
      assert.ok(
        first.ui.getByText("Achievement unlocked: First Bar Muscle-Up"),
      );
      const achievementState = activeScores(first.readState()).achievementState;
      assert.ok(achievementState.earned["first-bar-muscle-up"]);
      assert.ok(
        achievementState.acknowledgedIds.includes("first-bar-muscle-up"),
      );
    });
    savedState = first.readState();
  } finally {
    first.cleanup();
  }

  const reloaded = mountApp({ storedState: savedState });
  try {
    reloaded.fireEvent.click(
      reloaded.ui.getByRole("button", { name: "Progress" }),
    );
    assert.ok(
      await reloaded.view("progressView").findByRole("heading", {
        name: "First Bar Muscle-Up",
      }),
    );
    assert.equal(
      reloaded.ui.queryByText("Achievement unlocked: First Bar Muscle-Up"),
      null,
    );
  } finally {
    reloaded.cleanup();
  }
});

test("React retroactively unlocks consistency badges from existing logs", async () => {
  const planState = canonicalPlanState({
    logs: [
      {
        id: "retro-1",
        date: "2026-07-30",
        createdAt: "2026-07-30T10:00:00.000Z",
      },
      {
        id: "retro-2",
        date: "2026-07-31",
        createdAt: "2026-07-31T10:00:00.000Z",
      },
      {
        id: "retro-3",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
    ],
  });
  const mounted = mountApp({
    storedState: {
      schemaVersion: 5,
      ...planState,
      profile: cloneDefaultProfile(),
      prs: {},
      prAttempts: [],
    },
  });

  try {
    await mounted.waitFor(() => {
      const achievementState = activeScores(
        mounted.readState(),
      ).achievementState;
      assert.ok(achievementState.earned["first-session"]);
      assert.ok(achievementState.earned["training-habit"]);
    });
    assert.ok(mounted.ui.getByRole("heading", { name: "Training Habit" }));
    assert.equal(mounted.readState().schemaVersion, 7);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library turns a readiness check and pasted box WOD into a recommendation", async () => {
  const mounted = mountApp();
  const { cleanup, fireEvent, readState, ui, waitFor } = mounted;

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    fireEvent.change(ui.getByLabelText("Energy"), {
      target: { value: "4" },
    });
    fireEvent.change(ui.getByLabelText("Paste today's box WOD (optional)"), {
      target: {
        value:
          "AMRAP 15 min\n10 thrusters\n10 chest-to-bar pull-ups\n12 mystery crab crawls",
      },
    });

    assert.ok(ui.getByText(/Detected:/));
    assert.ok(ui.getByText(/Review unmatched text: 12 mystery crab crawls/));
    fireEvent.click(
      ui.getByRole("button", {
        name: "Save check-in and recommendation",
      }),
    );

    await waitFor(() => {
      const scores = activeScores(readState());
      assert.equal(scores.readinessChecks.length, 1);
      assert.equal(scores.readinessChecks[0].energy, 4);
      const boxEvent = scores.trainingEvents.find(
        (trainingEvent) => trainingEvent.kind === "box",
      );
      assert.ok(boxEvent);
      assert.ok(boxEvent.movementIds.includes("thrusters"));
      assert.ok(
        ["swap", "scale", "train"].includes(boxEvent.recommendation.action),
      );
      const movedSession = scores.trainingEvents.find(
        (trainingEvent) => trainingEvent.kind === "app",
      );
      if (movedSession) {
        assert.equal(movedSession.status, "planned");
        assert.equal(
          movedSession.recommendation.modifications.rescheduledTo,
          movedSession.date,
        );
      }
    });
    fireEvent.click(ui.getByRole("button", { name: "Log box workout" }));
    assert.ok(await ui.findByRole("heading", { name: "Log workout" }));
    await waitFor(() => {
      assert.equal(ui.getByLabelText("Workout type").value, "box");
    });
    assert.equal(
      ui.getByLabelText("Box workout name").value,
      "CrossFit box WOD",
    );
    fireEvent.change(ui.getByLabelText("WOD score"), {
      target: { value: "5 rounds" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));
    await waitFor(() => {
      const scores = activeScores(readState());
      assert.equal(scores.logs[0].workoutSource, "box");
      assert.equal(
        scores.trainingEvents.find((event) => event.kind === "box").status,
        "completed",
      );
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library moves, skips, and resumes a dated progression session", async () => {
  const mounted = mountApp();
  const { cleanup, fireEvent, readState, ui, waitFor } = mounted;

  function squatEvent() {
    return ui
      .getAllByRole("heading", { name: "Back squat + T2B" })
      .map((heading) => heading.closest(".calendar-event"))
      .find(Boolean);
  }

  try {
    await ui.findByRole("heading", { name: "Today coach" });
    fireEvent.click(ui.getByRole("button", { name: "Calendar" }));
    const event = squatEvent();
    fireEvent.change(event.querySelector('input[type="date"]'), {
      target: { value: "2026-08-04" },
    });

    await waitFor(() => {
      const stored = activeScores(readState()).trainingEvents;
      assert.equal(stored.length, 1);
      assert.equal(stored[0].date, "2026-08-04");
    });

    const skip = Array.from(squatEvent().querySelectorAll("button")).find(
      (button) => button.textContent === "Mark skipped",
    );
    fireEvent.click(skip);
    await waitFor(() => {
      assert.equal(
        activeScores(readState()).trainingEvents[0].status,
        "skipped",
      );
    });

    const resume = Array.from(squatEvent().querySelectorAll("button")).find(
      (button) => button.textContent === "Resume session",
    );
    fireEvent.click(resume);
    await waitFor(() => {
      const stored = activeScores(readState()).trainingEvents;
      assert.equal(stored.length, 1);
      assert.equal(stored[0].status, "planned");
      assert.notEqual(stored[0].date, "2026-08-04");
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library saves, edits, and deletes a structured workout score", async () => {
  const mounted = mountApp();
  const { cleanup, fireEvent, readState, ui, waitFor } = mounted;

  try {
    await ui.findByRole("heading", { name: "Today coach" });
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    fireEvent.change(ui.getByLabelText("Score type"), {
      target: { value: "rounds_reps" },
    });
    fireEvent.change(ui.getByLabelText("Rx status"), {
      target: { value: "scaled" },
    });
    fireEvent.change(ui.getByLabelText("Primary value"), {
      target: { value: "5" },
    });
    fireEvent.change(ui.getByLabelText("Reps / secondary"), {
      target: { value: "12" },
    });
    fireEvent.change(ui.getByLabelText("Strength sets"), {
      target: { value: "5" },
    });
    fireEvent.change(ui.getByLabelText("Reps per set"), {
      target: { value: "3" },
    });
    fireEvent.change(ui.getByLabelText("Strength load (kg)"), {
      target: { value: "120" },
    });
    fireEvent.change(ui.getByLabelText("Interval splits"), {
      target: { value: "2:01\n2:05" },
    });
    fireEvent.change(ui.getByLabelText("Movement substitutions"), {
      target: { value: "Chest-to-bar → pull-ups" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const log = activeScores(readState()).logs[0];
      assert.equal(log.rxStatus, "scaled");
      assert.equal(log.structuredScore.scoreType, "rounds_reps");
      assert.equal(log.structuredScore.primaryValue, 5);
      assert.deepEqual(log.structuredScore.splits, ["2:01", "2:05"]);
      assert.equal(log.structuredScore.strengthLoad, 120);
    });

    fireEvent.click(ui.getByRole("button", { name: "Edit" }));
    fireEvent.change(ui.getByLabelText("Notes"), {
      target: { value: "Corrected technique note" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Update workout log" }));
    await waitFor(() => {
      const logs = activeScores(readState()).logs;
      assert.equal(logs.length, 1);
      assert.equal(logs[0].notes, "Corrected technique note");
    });

    fireEvent.click(ui.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      assert.equal(activeScores(readState()).logs.length, 0);
    });
    assert.match(mounted.confirmCalls.at(-1), /Delete this workout log/);
  } finally {
    cleanup();
  }
});

test("React Testing Library lazy-mounts views and preserves unfinished drafts", async () => {
  const mounted = mountApp();

  try {
    assert.ok(await mounted.ui.findByRole("heading", { name: "Today coach" }));
    assert.equal(document.querySelector("#builderView"), null);

    openMoreTool(mounted, "Build programme");
    const builder = mounted.view("builderView");
    const title = builder.getByLabelText("Day or title");
    mounted.fireEvent.change(title, { target: { value: "Unfinished Friday" } });

    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Today" }));
    assert.ok(document.querySelector("#builderView"));
    openMoreTool(mounted, "Build programme");

    assert.equal(
      mounted.view("builderView").getByLabelText("Day or title").value,
      "Unfinished Friday",
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library keeps cleared time benchmarks as test-needed values", async () => {
  const mounted = mountApp();
  const { cleanup, fireEvent, ui, waitFor } = mounted;

  try {
    openMore(mounted);
    assert.ok(
      await ui.findByRole("heading", { name: "Masters RX assessment" }),
    );

    fireEvent.change(ui.getByLabelText("1 km row"), { target: { value: " " } });
    fireEvent.change(ui.getByLabelText("2 km row"), { target: { value: " " } });
    fireEvent.change(ui.getByLabelText("5 km run"), { target: { value: " " } });
    fireEvent.click(ui.getByRole("button", { name: "Save assessment" }));
    fireEvent.click(ui.getByRole("button", { name: "Progress" }));

    await waitFor(
      () => {
        const saved = JSON.parse(
          window.localStorage.getItem("forge-hour-state-v1"),
        );
        assert.equal(saved.profile.benchmarks.row1k, "");
        assert.equal(saved.profile.benchmarks.row2k, "");
        assert.equal(saved.profile.benchmarks.run5k, "");
        assert.ok(ui.getByText("Test needed: 1 km row"));
      },
      { timeout: 5000 },
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library updates RX guidance after assessment changes", async () => {
  const mounted = mountApp();
  const { cleanup, fireEvent, ui, view, waitFor } = mounted;

  try {
    fireEvent.click(ui.getByRole("button", { name: "Progress" }));
    assert.ok(
      await view("progressView").findByRole("heading", {
        name: "RX readiness",
        level: 3,
      }),
    );
    const overall = ui.getByRole("progressbar", { name: "Overall RX Level" });
    const initialLevel = overall.getAttribute("aria-valuenow");
    assert.ok(ui.getByText(/Use frequent submaximal sets/));

    openMore(mounted);
    const improvements = {
      "Unbroken pull-ups": "25",
      "Unbroken chest-to-bar": "18",
      "Unbroken toes-to-bar": "25",
      "Unbroken bar muscle-ups": "8",
      "Unbroken ring muscle-ups": "4",
      "Strict HSPU": "8",
      "Handstand walk meters": "15",
      "Unbroken double-unders": "100",
    };
    Object.entries(improvements).forEach(([label, value]) => {
      fireEvent.change(ui.getByLabelText(label), { target: { value } });
    });
    fireEvent.click(ui.getByRole("button", { name: "Save assessment" }));
    fireEvent.click(ui.getByRole("button", { name: "Progress" }));

    await waitFor(() => {
      assert.notEqual(
        ui
          .getByRole("progressbar", { name: "Overall RX Level" })
          .getAttribute("aria-valuenow"),
        initialLevel,
      );
      assert.equal(ui.queryByText(/Use frequent submaximal sets/), null);
      assert.ok(ui.getByText(/^Prioritize .* next training cycle/));
    });
  } finally {
    cleanup();
  }
});

test("React renders complete V2 strength and skill prescriptions from the validated final graph", async () => {
  const mounted = mountApp();

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );

    const programme = await mounted.ui.findByTestId("v2-programme");
    await mounted.waitFor(() => {
      assert.equal(
        programme.querySelectorAll('[data-testid="v2-session-card"]').length,
        2,
      );
      assert.match(programme.textContent, /72–75% of front squat 1RM/);
      assert.match(programme.textContent, /Rest 120 sec/);
      assert.match(programme.textContent, /Working weight90–95 kg/);
      assert.doesNotMatch(programme.textContent, /Working weight90–937\.5 kg/);
      assert.match(programme.textContent, /Strict pull-up/);
      assert.match(programme.textContent, /Scaling:.*Ring row/s);
      assert.match(programme.textContent, /20 sec/);
    });

    assert.equal(
      programme.textContent.includes(
        "Gymnastics skill: hollow and arch control, strict pulling, and midline strength",
      ),
      false,
    );
    assert.equal(
      programme.textContent.includes(
        "3 sets: 3 tall snatch pulls + 20-second overhead hold",
      ),
      false,
    );

    const saved = mounted.readState();
    const finalProgramme = saved.v2Programs.find(
      (item) => item.id === saved.activeV2ProgramId,
    );
    assert.equal(
      window.ForgeHourProgrammingV2.validateProgram(finalProgramme).valid,
      true,
    );
  } finally {
    mounted.cleanup();
  }
});

test("mixed test week displays three separate test forms and saves a front squat attempt", async () => {
  const mounted = mountApp();
  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.change(mounted.ui.getByLabelText("Training template"), {
      target: { value: "mixed_strength_8w_testing" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Generate six-week V2 block" }),
    );
    await mounted.waitFor(() =>
      assert.ok(mounted.readState().activeV2ProgramId),
    );
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Week 8", exact: true }),
    );
    const programme = mounted.ui.getByTestId("v2-programme");
    await mounted.waitFor(() =>
      assert.equal(programme.querySelectorAll(".v2-max-test").length, 3),
    );
    assert.match(programme.textContent, /Max test: Snatch/);
    assert.match(programme.textContent, /Max test: Front squat/);
    assert.match(programme.textContent, /Max test: Clean and jerk/);
    assert.match(programme.textContent, /30-minute EMOM/);
    assert.doesNotMatch(programme.textContent, /Primary progression/);
    const form = [...programme.querySelectorAll(".v2-max-test")].find((item) =>
      item.querySelector("summary").textContent.includes("Front squat"),
    );
    mounted.fireEvent.change(form.querySelector('[name="maxAttemptLoad"]'), {
      target: { value: "130" },
    });
    mounted.fireEvent.submit(form.querySelector("form"));
    await mounted.waitFor(() => {
      const state = mounted.readState();
      const program = state.v2Programs.find(
        (item) => item.id === state.activeV2ProgramId,
      );
      const session = program.trainingBlocks[0].trainingWeeks[7].sessions[0];
      assert.equal(
        session.additionalMaxTestPrescriptions[0].attemptResults[0].loadKg,
        130,
      );
      assert.equal(session.maxTestPrescription.attemptResults.length, 0);
    });
  } finally {
    mounted.cleanup();
  }
});

test("REG-012 React passes the selected goal, block, template, level, maxes, and skills into V2", async () => {
  const mounted = mountApp();

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.change(mounted.ui.getByLabelText("Programming goal"), {
      target: { value: "general_crossfit" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Training block"), {
      target: { value: "gymnastics_capacity" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Training template"), {
      target: { value: "mixed_strength_8w_testing" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      const program = state.v2Programs.find(
        (item) => item.id === state.activeV2ProgramId,
      );
      assert.equal(program.trainingBlocks[0].durationWeeks, 8);
      assert.equal(program.programmeProfile.primaryGoal, "general_crossfit");
      assert.equal(
        program.programmeProfile.trainingBlock,
        "gymnastics_capacity",
      );
      assert.equal(program.generationRequest.athleteLevel, "intermediate");
      assert.equal(program.generationRequest.known1RMs.deadlift, 180);
      assert.equal(program.generationRequest.athleteSkills.chestToBar, 5);
      assert.equal(program.generationSummary.identityValidation.valid, true);
      assert.doesNotMatch(
        program.trainingBlocks[0].trainingWeeks[0].sessions
          .map((session) => session.objective)
          .join(" "),
        /front.squat|snatch/i,
      );
    });

    const generationSummary = window.__FORGE_HOUR_V2_GENERATION_SUMMARY__;
    assert.ok(generationSummary);
    assert.equal(generationSummary.programmingGoal, "general_crossfit");
    assert.equal(generationSummary.blockType, "gymnastics_capacity");
  } finally {
    mounted.cleanup();
  }
});

test("React selects, switches, and reloads Strict Strength without overwriting General Strength", async () => {
  const mounted = mountApp();
  let persisted;
  let strictProgramId;
  let generalProgramId;

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.change(mounted.ui.getByLabelText("Programming goal"), {
      target: { value: "strength" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Training template"), {
      target: { value: "mixed_strength_8w_testing" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().v2Programs.length, 1);
    });
    generalProgramId = mounted.readState().activeV2ProgramId;

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Create new V2 programme" }),
    );
    mounted.fireEvent.change(mounted.ui.getByLabelText("Training template"), {
      target: { value: "strict_strength_8w" },
    });
    assert.ok(
      mounted.ui.getByText(
        /Build raw pulling and pressing strength for stronger gymnastics/,
      ),
    );
    assert.equal(mounted.ui.getByLabelText("Weekly app sessions").value, "2");
    assert.equal(
      mounted.ui.getByLabelText("Weekly app sessions").disabled,
      true,
    );
    assert.ok(
      mounted.ui.getByText("8 weeks · 2 sessions/week · ~60 min/session"),
    );
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate a new future block",
      }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2Programs.length, 2);
      const program = state.v2Programs.find(
        (item) => item.id === state.activeV2ProgramId,
      );
      assert.equal(program.trainingBlocks[0].templateId, "strict_strength_8w");
      assert.equal(program.trainingBlocks[0].trainingWeeks.length, 8);
      assert.equal(
        program.trainingBlocks[0].trainingWeeks[0].sessions.length,
        2,
      );
      assert.equal(program.generationRequest.athleteSkills.ringDips, 0);
      assert.match(
        mounted.view("builderView").getByTestId("v2-programme").textContent,
        /Strict pull-up/i,
      );
    });
    strictProgramId = mounted.readState().activeV2ProgramId;

    mounted.fireEvent.click(
      mounted.view("builderView").getByRole("button", { name: "Week 5" }),
    );
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().selectedWeek, 5);
      assert.match(
        mounted.view("builderView").getByTestId("v2-programme").textContent,
        /Tempo strict pull-up/i,
      );
    });

    const selector = mounted.ui.getByLabelText("Active programme");
    mounted.fireEvent.change(selector, {
      target: { value: `v2:${generalProgramId}` },
    });
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().activeV2ProgramId, generalProgramId);
    });
    mounted.fireEvent.change(selector, {
      target: { value: `v2:${strictProgramId}` },
    });
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.activeV2ProgramId, strictProgramId);
      assert.equal(state.selectedWeek, 5);
      assert.deepEqual(
        state.v2Programs.map((program) => program.trainingBlocks[0].templateId),
        ["strict_strength_8w", "mixed_strength_8w_testing"],
      );
    });
    persisted = mounted.readState();
  } finally {
    mounted.cleanup();
  }

  const reloaded = mountApp({ storedState: persisted });
  try {
    openMoreTool(reloaded, "Build programme");
    await reloaded.waitFor(() => {
      assert.equal(
        reloaded.ui.getByLabelText("Active programme").value,
        `v2:${strictProgramId}`,
      );
      assert.equal(reloaded.readState().selectedWeek, 5);
      assert.equal(
        reloaded.view("builderView").getByRole("button", { name: "Week 5" })
          .className,
        "is-active",
      );
      assert.match(
        reloaded.view("builderView").getByTestId("v2-programme").textContent,
        /Tempo strict pull-up/i,
      );
    });
  } finally {
    reloaded.cleanup();
  }
});

test("REG-001 React creates and switches between multiple V2 programmes", async () => {
  const mounted = mountApp();

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );

    const selector = await mounted.ui.findByLabelText("Active programme");
    const firstProgramId = mounted.readState().activeV2ProgramId;
    assert.ok(firstProgramId);
    assert.equal(
      mounted.ui.queryByRole("button", {
        name: "Create new V2 programme",
      }) !== null,
      true,
    );

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Create new V2 programme" }),
    );
    assert.equal(document.querySelector(".v2-programme-setup").open, true);
    mounted.fireEvent.change(mounted.ui.getByLabelText("Programming goal"), {
      target: { value: "strength" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate a new future block",
      }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2Programs.length, 2);
      assert.notEqual(state.activeV2ProgramId, firstProgramId);
      assert.equal(state.activeProgrammingEngine, "v2");
    });

    const secondProgramId = mounted.readState().activeV2ProgramId;
    assert.notEqual(secondProgramId, firstProgramId);
    mounted.fireEvent.change(mounted.ui.getByLabelText("V2 programme name"), {
      target: { value: "Strength foundation block" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save V2 programme name" }),
    );
    await mounted.waitFor(() => {
      const renamed = mounted
        .readState()
        .v2Programs.find((program) => program.id === secondProgramId);
      assert.equal(renamed.name, "Strength foundation block");
      assert.match(
        selector.options[0].textContent,
        /Strength foundation block/,
      );
    });
    assert.equal(selector.options.length, 3);
    assert.ok(
      Array.from(selector.options).some(
        (option) => option.value === `v2:${firstProgramId}`,
      ),
    );
    assert.ok(
      Array.from(selector.options).some(
        (option) => option.value === `v2:${secondProgramId}`,
      ),
    );

    mounted.fireEvent.change(selector, {
      target: { value: `v2:${firstProgramId}` },
    });
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().activeV2ProgramId, firstProgramId);
    });

    mounted.fireEvent.change(selector, {
      target: { value: `v2:${secondProgramId}` },
    });
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().activeV2ProgramId, secondProgramId);
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Remove V2 programme" }),
    );
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2Programs.length, 1);
      assert.equal(state.activeV2ProgramId, firstProgramId);
      assert.equal(state.activeProgrammingEngine, "v2");
    });

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Remove V2 programme" }),
    );
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2Programs.length, 0);
      assert.equal(state.activeV2ProgramId, null);
      assert.equal(state.activeProgrammingEngine, "v1");
    });
  } finally {
    mounted.cleanup();
  }
});

test("REG-001 stale V2 sync completion cannot reactivate an older programme", async () => {
  const delayedSave = deferred();
  let saveCount = 0;
  const saveResult = (payload) => {
    saveCount += 1;
    if (saveCount === 3) return delayedSave.promise;
    return {
      programId: payload.p_program.id,
      revision: 1,
      updatedAt: payload.p_program.updatedAt,
    };
  };
  const account = privateAthleteState("V2 Sync Athlete", {
    ...canonicalPlanState(),
    plans: [],
    activePlanId: null,
  });
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      athlete_states: [
        {
          user_id: "user-1",
          schema_version: 1,
          state: account,
          updated_at: "2026-08-10T07:00:00.000Z",
        },
      ],
      programming_engine_flags: [
        {
          user_id: "user-1",
          v2_enabled: true,
          rollout_group: "selected_users",
        },
      ],
    },
    rpcResults: {
      save_programming_engine_v2: saveResult,
      save_programming_engine_v2_profile: saveResult,
    },
  });
  const mounted = mountApp({
    supabaseMock,
    url: "https://app.example.test/",
  });

  try {
    await waitForSignedIn(mounted);
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Generate six-week V2 block" }),
    );
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2Programs.length, 1);
      assert.equal(state.v2ProgramRevisions[state.activeV2ProgramId], 1);
    });
    const firstProgramId = mounted.readState().activeV2ProgramId;

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Create new V2 programme" }),
    );
    mounted.fireEvent.change(mounted.ui.getByLabelText("Programming goal"), {
      target: { value: "strength" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Generate a new future block" }),
    );
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2Programs.length, 2);
      assert.equal(state.v2ProgramRevisions[state.activeV2ProgramId], 1);
    });
    const secondProgramId = mounted.readState().activeV2ProgramId;
    const selector = mounted.ui.getByLabelText("Active programme");
    mounted.fireEvent.change(selector, {
      target: { value: `v2:${firstProgramId}` },
    });
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().activeV2ProgramId, firstProgramId),
    );

    const regenerateButton = mounted.ui.getAllByRole("button", {
      name: "Regenerate conditioning",
    })[0];
    mounted.fireEvent.click(regenerateButton);
    await mounted.waitFor(() => assert.equal(saveCount, 3));
    assert.equal(regenerateButton.disabled, true);
    mounted.fireEvent.click(regenerateButton);
    assert.equal(saveCount, 3);
    mounted.fireEvent.change(selector, {
      target: { value: `v2:${secondProgramId}` },
    });
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().activeV2ProgramId, secondProgramId),
    );

    delayedSave.resolve({
      programId: firstProgramId,
      revision: 2,
      updatedAt: "2026-08-10T08:30:00.000Z",
    });
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.v2ProgramRevisions[firstProgramId], 2);
      assert.equal(state.activeV2ProgramId, secondProgramId);
    });
  } finally {
    mounted.cleanup();
  }
});

test("React schedules V2 on the athlete's two days and renders structured sessions in Calendar and Today", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-08-05T12:00:00.000Z"),
  });
  const mounted = mountApp();

  try {
    openMoreTool(mounted, "Build programme");
    const setup = document.querySelector(".v2-programme-setup");
    for (const day of ["tuesday", "saturday", "wednesday", "sunday"]) {
      mounted.fireEvent.click(
        setup.querySelector(`input[name="v2PreferredDay"][value="${day}"]`),
      );
    }
    mounted.fireEvent.change(mounted.ui.getByLabelText("V2 athlete level"), {
      target: { value: "advanced" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Weight increment"), {
      target: { value: "1" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.activeProgrammingEngine, "v2");
      assert.deepEqual(state.v2GenerationPreferences.preferredDays, [
        "wednesday",
        "sunday",
      ]);
      assert.equal(state.v2GenerationPreferences.athleteLevel, "advanced");
      assert.equal(state.v2GenerationPreferences.weightIncrementKg, 1);
    });

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Calendar" }),
    );
    const calendar = document.getElementById("calendarView");
    await mounted.waitFor(() => {
      assert.equal(
        calendar.querySelectorAll('[data-testid="v2-session-card"]').length,
        2,
      );
      assert.match(calendar.textContent, /Aug 5, 2026/);
      assert.match(calendar.textContent, /Aug 9, 2026/);
      assert.match(calendar.textContent, /72–75% of front squat 1RM/);
      assert.match(calendar.textContent, /Rest 120 sec/);
    });
    assert.equal(
      mounted.ui.getByLabelText("Programme week").querySelectorAll("option")
        .length,
      6,
    );

    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Today" }));
    const dashboard = document.getElementById("dashboardView");
    assert.match(dashboard.textContent, /V2 progression/);
    assert.ok(
      Array.from(dashboard.querySelectorAll("button")).some(
        (button) => button.textContent === "Open structured workout",
      ),
    );
    assert.match(dashboard.textContent, /72–75% of front squat 1RM/);
  } finally {
    mounted.cleanup();
  }
});

test("Calendar prioritizes today's completed workout above collapsed programme details", (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date(2026, 7, 19, 12),
  });
  const storedState = canonicalPlanState({
    logs: [
      {
        id: "today-completion",
        date: "2026-08-19",
        week: 1,
        dayId: "wednesday-session",
        dayTitle: "Wednesday priority session",
        readiness: "green",
        wodScore: "Complete",
        createdAt: "2026-08-19T12:00:00.000Z",
      },
    ],
  });
  storedState.cycleStartDate = "2026-08-17";
  storedState.plans[0].sessions = [
    {
      ...storedState.plans[0].sessions[0],
      id: "monday-session",
      title: "Monday earlier session",
      preferredDay: "monday",
    },
    {
      ...storedState.plans[0].sessions[0],
      id: "wednesday-session",
      title: "Wednesday priority session",
      preferredDay: "wednesday",
    },
  ];
  const mounted = mountApp({ storedState });

  try {
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Calendar" }),
    );
    const calendar = document.getElementById("calendarView");
    const priority = calendar.querySelector('[data-calendar-priority="true"]');
    const details = calendar.querySelector(".calendar-programme-details");
    const persistedBeforeDisclosure = mounted.readState();

    assert.equal(
      priority.querySelector("h3").textContent,
      "Wednesday priority session",
    );
    assert.match(priority.textContent, /Today/);
    assert.match(priority.textContent, /✓ Completed/);
    assert.ok(
      priority.compareDocumentPosition(details) &
        mounted.dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
    );
    assert.equal(details.open, false);
    assert.equal(
      mounted.ui.queryByRole("heading", {
        name: "CrossFit Training Programme",
      }),
      null,
    );

    mounted.fireEvent.click(details.querySelector("summary"));
    assert.equal(details.open, true);
    assert.equal(
      mounted.view("calendarView").getByLabelText("Cycle start date").value,
      "2026-08-17",
    );
    assert.deepEqual(mounted.readState(), persistedBeforeDisclosure);
  } finally {
    mounted.cleanup();
  }
});

test("Calendar highlights the next workout and navigates programme week boundaries", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date(2026, 7, 19, 12),
  });
  const storedState = canonicalPlanState();
  const baseSession = storedState.plans[0].sessions[0];
  storedState.cycleStartDate = "2026-08-17";
  storedState.plans[0].sessions = [
    {
      ...baseSession,
      id: "week-1-monday",
      title: "Week one earlier workout",
      preferredDay: "monday",
    },
    {
      ...baseSession,
      id: "week-1-friday",
      title: "Week one next workout",
      preferredDay: "friday",
    },
    {
      ...baseSession,
      id: "week-2-session",
      week: 2,
      title: "Week two workout",
      preferredDay: "tuesday",
    },
    {
      ...baseSession,
      id: "week-3-session",
      week: 3,
      title: "Week three workout",
      preferredDay: "thursday",
    },
  ];
  const mounted = mountApp({ storedState });

  try {
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Calendar" }),
    );
    const calendar = mounted.view("calendarView");
    const previous = calendar.getByRole("button", {
      name: "Previous week",
    });
    const next = calendar.getByRole("button", {
      name: "Next week",
    });
    const programmeBeforeNavigation = structuredClone(
      mounted.readState().plans,
    );

    assert.equal(previous.disabled, true);
    assert.match(
      document.querySelector('[data-calendar-priority="true"]').textContent,
      /Next session/,
    );
    assert.equal(
      document.querySelector('[data-calendar-priority="true"] h3').textContent,
      "Week one next workout",
    );

    mounted.fireEvent.click(next);
    await mounted.waitFor(() =>
      assert.equal(
        document.querySelector('[data-calendar-priority="true"] h3')
          .textContent,
        "Week two workout",
      ),
    );
    assert.equal(mounted.ui.getByLabelText("Programme week").value, "2");

    mounted.fireEvent.change(mounted.ui.getByLabelText("Programme week"), {
      target: { value: "3" },
    });
    await mounted.waitFor(() => {
      assert.equal(
        document.querySelector('[data-calendar-priority="true"] h3')
          .textContent,
        "Week three workout",
      );
      assert.equal(next.disabled, true);
      assert.equal(mounted.readState().selectedWeek, 3);
    });
    assert.deepEqual(mounted.readState().plans, programmeBeforeNavigation);
  } finally {
    mounted.cleanup();
  }
});

test("React can switch between the built-in V1 cycle and V2 without losing the generated block", async () => {
  const mounted = mountApp();

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );
    const selector = await mounted.ui.findByLabelText("Active programme");
    const v2Value = selector.value;
    const v1Option = Array.from(selector.options).find((option) =>
      option.value.startsWith("v1:"),
    );
    assert.ok(v1Option);

    mounted.fireEvent.change(selector, { target: { value: v1Option.value } });
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().activeProgrammingEngine, "v1");
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Active programme"), {
      target: { value: v2Value },
    });
    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.activeProgrammingEngine, "v2");
      assert.ok(
        state.v2Programs.some((program) => `v2:${program.id}` === v2Value),
      );
      assert.equal(v1Option.value, "v1:built-in");
    });
  } finally {
    mounted.cleanup();
  }
});

test("React keeps V2 disabled on production without an allowlist flag", () => {
  const mounted = mountApp({
    url: "https://renebrandenburg.github.io/?engine=v2",
  });

  try {
    openMoreTool(mounted, "Build programme");
    const disabled = mounted.ui.getByTestId("v2-disabled");
    assert.match(
      disabled.textContent,
      /Production access requires sign-in and an administrator-managed allowlist flag/,
    );
    assert.equal(
      mounted.ui.queryByRole("button", {
        name: "Generate six-week V2 block",
      }),
      null,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library generates a level-aware bar muscle-up programme", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp({
    storedState: canonicalPlanState({ kind: "generated" }),
  });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    fireEvent.click(ui.getByText("V1 compatibility (read-only)"));
    fireEvent.change(ui.getByLabelText("Main goal"), {
      target: { value: "barMuscleUp" },
    });

    assert.equal(ui.queryByLabelText("Biggest weakness"), null);
    const level = ui.getByLabelText("Current bar muscle-up level");
    assert.equal(level.value, "highPull");
    fireEvent.change(level, { target: { value: "assisted" } });
    const athleteLevel = ui.getByLabelText("Athlete programming level");
    assert.equal(athleteLevel.value, "intermediate");
    fireEvent.change(athleteLevel, { target: { value: "rxPlus" } });
    fireEvent.click(
      ui.getByRole("button", {
        name: /(?:Generate|Regenerate) 8-week programme/,
      }),
    );

    await waitFor(() =>
      assert.ok(
        ui.getAllByRole("heading", { name: /High pull \+ kip timing/ })
          .length >= 8,
      ),
    );
    assert.ok(ui.getAllByText(/Bar muscle-up focus/).length > 0);
    assert.ok(ui.getAllByText(/Bar muscle-up support day/).length > 0);

    const saved = JSON.parse(
      window.localStorage.getItem("forge-hour-state-v1"),
    );
    const activePlan = saved.plans.find(
      (plan) => plan.id === saved.activePlanId,
    );
    assert.equal(activePlan.title, "Get my first bar muscle-up programme");
    assert.deepEqual(
      {
        goal: activePlan.generatorOptions.goal,
        daysPerWeek: activePlan.generatorOptions.daysPerWeek,
        weakness: activePlan.generatorOptions.weakness,
        duration: activePlan.generatorOptions.duration,
        athleteLevel: activePlan.generatorOptions.athleteLevel,
        barMuscleUpLevel: activePlan.generatorOptions.barMuscleUpLevel,
      },
      {
        goal: "barMuscleUp",
        daysPerWeek: 4,
        weakness: "muscleup",
        duration: 60,
        athleteLevel: "rxPlus",
        barMuscleUpLevel: "assisted",
      },
    );
    assert.equal(activePlan.sessions.length, 32);
    assert.ok(
      activePlan.sessions.every(
        (session) =>
          session.sourceBarMuscleUpLevel === "assisted" &&
          session.sourceAthleteLevel === "rxPlus",
      ),
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library creates a two-day plan and counts a box workout separately", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp({
    storedState: canonicalPlanState({ kind: "generated" }),
  });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    fireEvent.click(ui.getByText("V1 compatibility (read-only)"));
    fireEvent.change(ui.getByLabelText("App-programmed sessions"), {
      target: { value: "2" },
    });
    fireEvent.click(
      ui.getByLabelText("I also follow workouts at a CrossFit box"),
    );
    fireEvent.click(
      ui.getByRole("button", {
        name: /(?:Generate|Regenerate) 8-week programme/,
      }),
    );

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("forge-hour-state-v1"),
      );
      const activePlan = saved.plans.find(
        (plan) => plan.id === saved.activePlanId,
      );
      assert.equal(activePlan.generatorOptions.programDaysPerWeek, 2);
      assert.equal(activePlan.generatorOptions.expectedBoxDays, 2);
      assert.equal(activePlan.generatorOptions.totalTrainingDays, 4);
      assert.equal(activePlan.generatorOptions.sessionDuration, 75);
      assert.equal(activePlan.sessions.length, 16);
      assert.ok(activePlan.sessions.every((session) => session.twoDayStrategy));
    });

    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    fireEvent.change(ui.getByLabelText("Workout type"), {
      target: { value: "box" },
    });
    fireEvent.change(ui.getByLabelText("Box workout name"), {
      target: { value: "Community chipper" },
    });
    fireEvent.click(ui.getByLabelText("Heavy squats"));
    fireEvent.click(ui.getByLabelText("Long conditioning"));
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("forge-hour-state-v1"),
      );
      const boxLog = activeScores(saved).logs.find(
        (log) => log.workoutSource === "box",
      );
      assert.equal(boxLog.dayTitle, "Community chipper");
      assert.deepEqual(boxLog.movementPatterns, ["squat", "long_conditioning"]);
    });

    fireEvent.click(ui.getByRole("button", { name: "Today" }));
    await waitFor(() => {
      assert.ok(ui.getByText("0/2"));
      assert.ok(ui.getByText("1/4"));
      assert.ok(ui.getByText("Box workout"));
    });
  } finally {
    cleanup();
  }
});

test("React renders complete strength and skill prescriptions", async () => {
  const { cleanup, dom, fireEvent, readState, ui, waitFor } = mountApp({
    storedState: canonicalPlanState({ kind: "generated" }),
  });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    fireEvent.click(ui.getByText("V1 compatibility (read-only)"));
    fireEvent.change(ui.getByLabelText("Main goal"), {
      target: { value: "balanced" },
    });
    fireEvent.change(ui.getByLabelText("Secondary goal (optional)"), {
      target: { value: "endurance" },
    });
    fireEvent.change(ui.getByLabelText("App-programmed sessions"), {
      target: { value: "2" },
    });
    fireEvent.change(ui.getByLabelText("Max session length"), {
      target: { value: "60" },
    });
    fireEvent.click(
      ui.getByLabelText("I also follow workouts at a CrossFit box"),
    );
    fireEvent.change(ui.getByLabelText("Biggest weakness"), {
      target: { value: "olympic" },
    });
    fireEvent.click(
      ui.getByRole("button", {
        name: /(?:Generate|Regenerate) 8-week programme/,
      }),
    );

    await waitFor(() => {
      const state = readState();
      const plan = state.plans.find((item) => item.id === state.activePlanId);
      assert.equal(plan.sessions.length, 16);
      assert.equal(plan.generatorOptions.primaryGoal, "balanced");
      assert.equal(plan.generatorOptions.secondaryGoal, "endurance");
      assert.equal(plan.generatorOptions.programDaysPerWeek, 2);
      assert.equal(plan.generatorOptions.totalTrainingDays, 4);
      assert.equal(plan.generatorOptions.sessionDuration, 60);
      const serialized = JSON.stringify(plan.sessions);
      assert.doesNotMatch(
        serialized,
        /tall clean\/snatch pulls|overhead or front rack holds|hang power clean drills/i,
      );
      assert.ok(
        plan.sessions.some((session) =>
          session.strength.some((item) => /tall clean pulls/.test(item)),
        ),
      );
      assert.ok(
        plan.sessions.some((session) =>
          session.strength.some((item) => /tall snatch pulls/.test(item)),
        ),
      );
      assert.ok(
        plan.sessions.every(
          (session) =>
            session.trainingBlockSchemaVersion === 3 &&
            session.trainingBlocks.every(
              (trainingBlock) =>
                trainingBlock.durationMinutes > 0 &&
                trainingBlock.prescription.exercises.length > 0,
            ),
        ),
      );
      const olympicTechnique = plan.sessions
        .flatMap((session) => session.trainingBlocks)
        .filter((trainingBlock) => trainingBlock.category === "weightlifting")
        .flatMap((trainingBlock) => trainingBlock.prescription.exercises)
        .filter((exercise) =>
          /tall-(?:clean|snatch)-pulls/.test(exercise.movementId),
        );
      assert.ok(olympicTechnique.length > 0);
      assert.ok(
        olympicTechnique.every(
          (exercise) => exercise.load?.percentage && exercise.load?.rpe,
        ),
      );
      assert.ok(ui.getAllByText(/35–45% of snatch 1RM or RPE 5–6/).length > 0);
      const bulletText = Array.from(
        dom.window.document.querySelectorAll(".segment li"),
        (item) => item.textContent.trim(),
      );
      assert.equal(
        bulletText.includes(
          "Gymnastics skill: hollow and arch control, strict pulling, and midline strength",
        ),
        false,
      );
      assert.equal(
        bulletText.includes(
          "3 sets: 3 tall snatch pulls + 20-second overhead hold",
        ),
        false,
      );
      const renderedText = bulletText.join(" ");
      assert.match(renderedText, /3 rounds/);
      assert.match(renderedText, /20-second hollow hold/);
      assert.match(renderedText, /5-8 strict pull-ups/);
      assert.match(renderedText, /Scaling:.*ring rows/);
      assert.match(renderedText, /35–45% of snatch 1RM or RPE 5–6/);
      assert.match(renderedText, /Rest: 60–90 seconds after each set/);
      assert.deepEqual(
        new Set(plan.sessions.map((session) => session.olympicFamily)),
        new Set(["clean", "snatch"]),
      );
      assert.ok(
        plan.sessions.every((session) =>
          workoutExercises(session.workoutDefinition).every(
            (exercise) => exercise.movementId,
          ),
        ),
      );
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library marks a logged custom session complete without double counting", async () => {
  const storedState = canonicalPlanState({
    logs: [
      {
        id: "custom-completion-log",
        date: "2026-07-29",
        week: 1,
        dayId: "saved-session-1",
        dayTitle: "Saved canonical session",
        workoutSource: "custom",
        readiness: "green",
        createdAt: "2026-07-29T10:00:00.000Z",
      },
      {
        id: "custom-completion-retry",
        date: "2026-07-29",
        week: 1,
        dayId: "saved-session-1",
        dayTitle: "Saved canonical session",
        workoutSource: "custom",
        readiness: "green",
        createdAt: "2026-07-29T10:01:00.000Z",
      },
    ],
  });
  const { cleanup, ui } = mountApp({ storedState });

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    assert.match(
      ui.getByText("Sessions logged").closest(".stat-card").textContent,
      /1\/1/,
    );
    assert.match(
      ui.getByText("Total training").closest(".stat-card").textContent,
      /1\/1/,
    );
    assert.match(
      ui.getByText("Progression week").closest(".stat-card").textContent,
      /Complete/,
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library generates a Masters 35-39 RX Open prep programme", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp({
    storedState: canonicalPlanState({ kind: "generated" }),
  });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    assert.ok(await ui.findByRole("heading", { name: "Programme builder" }));
    fireEvent.click(ui.getByText("V1 compatibility (read-only)"));

    fireEvent.change(ui.getByLabelText("Main goal"), {
      target: { value: "mastersRxOpen" },
    });
    fireEvent.change(ui.getByLabelText("Biggest weakness"), {
      target: { value: "runningBodyweight" },
    });
    fireEvent.click(
      ui.getByRole("button", {
        name: /(?:Generate|Regenerate) 8-week programme/,
      }),
    );

    await waitFor(() =>
      assert.ok(
        ui.getAllByRole("heading", { name: /Squat \+ TTB capacity/ }).length >=
          8,
      ),
    );
    assert.ok(ui.getAllByText("Optional add-ons").length > 0);
    assert.ok(ui.getAllByText(/Men Masters 35-39 RX prep/).length > 0);

    const saved = JSON.parse(
      window.localStorage.getItem("forge-hour-state-v1"),
    );
    const activePlan = saved.plans.find(
      (plan) => plan.id === saved.activePlanId,
    );
    assert.equal(activePlan.kind, "generated");
    assert.equal(activePlan.generatorOptions.goal, "mastersRxOpen");
    assert.equal(activePlan.generatorOptions.weakness, "runningBodyweight");
    assert.equal(activePlan.sessions.length, 32);
    assert.equal(Object.hasOwn(saved, "customPlans"), false);
    assert.ok(
      activePlan.sessions.every(
        (session) =>
          session.workoutDefinition && !Object.hasOwn(session, "wod"),
      ),
    );
    assert.ok(
      activePlan.sessions.every(
        (session) => !session.addOns || Array.isArray(session.addOns),
      ),
    );
    assert.ok(
      activePlan.sessions
        .filter((session) => /\bD4:/.test(session.title))
        .every((session) =>
          session.strength.some((item) =>
            /200 m relaxed run \+ 8 push-ups \+ 12 air squats/.test(item),
          ),
        ),
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library records workout timer splits into a saved log", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    const nextSession = document.querySelector("#nextSession");
    const openTimer = nextSession.querySelector(".timer-panel button");
    fireEvent.click(openTimer);

    const start = Array.from(nextSession.querySelectorAll("button")).find(
      (button) => button.textContent === "Start",
    );
    fireEvent.click(start);

    await waitFor(
      () => {
        const split = Array.from(nextSession.querySelectorAll("button")).find(
          (button) => button.textContent === "Split",
        );
        assert.equal(split.disabled, false);
      },
      { timeout: 2500 },
    );

    const split = Array.from(nextSession.querySelectorAll("button")).find(
      (button) => button.textContent === "Split",
    );
    fireEvent.click(split);
    const finish = Array.from(nextSession.querySelectorAll("button")).find(
      (button) => button.textContent === "Finish and log",
    );
    fireEvent.click(finish);

    assert.ok(await ui.findByRole("heading", { name: "Log workout" }));
    assert.ok(ui.getByText("Timer result ready"));
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("forge-hour-state-v1"),
      );
      const scores = activeScores(saved);
      assert.ok(
        ["amrap", "emom", "forTime", "interval", "tabata", "rest"].includes(
          scores.logs[0].timerResult.mode,
        ),
      );
      assert.equal(scores.logs[0].timerResult.splits.length, 1);
      assert.match(scores.logs[0].wodScore, /splits/);
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library explains when competition recording is unsupported", async () => {
  const { cleanup, fireEvent, ui } = mountApp();

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    openMoreTool({ fireEvent, ui }, "Competition proof");
    assert.ok(await ui.findByRole("heading", { name: "Competition proof" }));
    fireEvent.click(ui.getByRole("button", { name: "Open camera" }));

    assert.ok(await ui.findByRole("dialog"));
    assert.match(
      ui.getByRole("alert").textContent,
      /not supported in this browser/i,
    );
    assert.ok(ui.getByRole("button", { name: "Retry camera" }));
  } finally {
    cleanup();
  }
});

test("React Testing Library records competition proof metadata into a workout log", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp({
    recordingSupport: true,
  });

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    openMoreTool({ fireEvent, ui }, "Competition proof");
    assert.ok(await ui.findByRole("heading", { name: "Competition proof" }));
    fireEvent.change(ui.getByLabelText("Workout source"), {
      target: { value: "custom" },
    });
    fireEvent.change(ui.getByLabelText("Workout name"), {
      target: { value: "Open Test 1" },
    });
    fireEvent.change(ui.getByLabelText("Workout details"), {
      target: { value: "AMRAP 12: 10 burpees, 20 air squats" },
    });
    fireEvent.change(ui.getByLabelText("Timer mode"), {
      target: { value: "amrap" },
    });
    fireEvent.change(ui.getByLabelText("Duration or time cap (minutes)"), {
      target: { value: "12" },
    });
    fireEvent.change(ui.getByLabelText("Countdown (seconds)"), {
      target: { value: "0" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Open camera" }));
    const start = await ui.findByRole("button", { name: "Start recording" });
    fireEvent.click(start);

    const finish = await ui.findByRole(
      "button",
      { name: "Finish recording" },
      { timeout: 8000 },
    );
    fireEvent.click(finish);

    const saveVideo = await ui.findByRole("link", { name: "Save video" });
    assert.equal(
      ui.getByRole("button", { name: "Save or share before continuing" })
        .disabled,
      true,
    );
    saveVideo.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(saveVideo);
    fireEvent.click(
      await ui.findByRole("button", { name: "Continue to workout log" }),
    );

    assert.ok(await ui.findByRole("heading", { name: "Log workout" }));
    assert.ok(
      ui.getByText(/Competition proof recorded with embedded timer overlay/),
    );
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("forge-hour-state-v1"),
      );
      const scores = activeScores(saved);
      assert.equal(scores.logs[0].competitionProof.recorded, true);
      assert.equal(scores.logs[0].competitionProof.overlayEmbedded, true);
      assert.equal(scores.logs[0].competitionProof.interrupted, false);
      assert.equal(scores.logs[0].competitionProof.temporaryStorage, "opfs");
      assert.ok(scores.logs[0].competitionProof.fileName.endsWith(".mp4"));
      assert.ok(scores.logs[0].competitionProof.exportedAt);
      assert.equal(scores.logs[0].dayTitle, "Open Test 1");
      assert.equal(scores.logs[0].timerResult.mode, "amrap");
      assert.equal(scores.logs[0].timerResult.plannedSeconds, 720);
      assert.equal(scores.logs[0].timerResult.status, "completed");
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library recovers an unexpectedly stopped proof recording", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp({
    recordingSupport: true,
  });

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    openMoreTool({ fireEvent, ui }, "Competition proof");
    assert.ok(await ui.findByRole("heading", { name: "Competition proof" }));
    fireEvent.click(ui.getByRole("button", { name: "Open camera" }));
    fireEvent.click(
      await ui.findByRole("button", { name: "Start 3-second countdown" }),
    );
    await ui.findByRole(
      "button",
      { name: "Finish recording" },
      { timeout: 4500 },
    );

    window.__mockMediaRecorder.stop();

    const saveVideo = await ui.findByRole("link", { name: "Save video" });
    assert.ok(ui.getByText(/1 recording interruption marked/));
    saveVideo.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(saveVideo);
    fireEvent.click(
      await ui.findByRole("button", { name: "Continue to workout log" }),
    );
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("forge-hour-state-v1"),
      );
      const scores = activeScores(saved);
      assert.equal(scores.logs[0].competitionProof.interrupted, true);
      assert.match(
        scores.logs[0].competitionProof.interruptions[0].reason,
        /stopped unexpectedly/i,
      );
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library saves a manual training session", async () => {
  const { cleanup, fireEvent, readState, ui, view, waitFor } = mountApp();

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    assert.ok(await ui.findByRole("heading", { name: "Programme builder" }));

    fireEvent.change(ui.getByLabelText("Day or title"), {
      target: { value: "Friday engine + skill" },
    });
    fireEvent.change(ui.getByLabelText("Focus"), {
      target: { value: "Engine and pull-up volume" },
    });
    fireEvent.change(ui.getByLabelText("Warm-up"), {
      target: { value: "8 min easy bike\nDynamic shoulders" },
    });
    fireEvent.change(ui.getByLabelText("Strength or skill"), {
      target: { value: "EMOM 10: 2 strict pull-ups + 6 kip swings" },
    });
    fireEvent.change(ui.getByLabelText("WOD"), {
      target: { value: "AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees" },
    });

    fireEvent.click(ui.getByRole("button", { name: "Save training session" }));

    const builder = view("builderView");
    await waitFor(() =>
      assert.ok(
        builder.getByRole("heading", { name: "Friday engine + skill" }),
      ),
    );
    assert.ok(builder.getByText("Engine and pull-up volume"));
    assert.ok(
      builder.getByText("AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees"),
    );
    const saved = readState();
    assert.equal(saved.plans.length, 1);
    assert.equal(saved.plans[0].sessions.length, 1);
    assert.equal(saved.activePlanId, saved.plans[0].id);
    assert.equal(Object.hasOwn(saved, "customPlans"), false);

    fireEvent.click(ui.getByRole("button", { name: "Calendar" }));
    const planView = view("calendarView");
    assert.match(
      document.querySelector("#calendarView").className,
      /is-active/,
    );
    assert.ok(
      planView.getAllByRole("heading", { name: "Friday engine + skill" })
        .length >= 1,
    );
    assert.ok(
      planView.getAllByText("AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees")
        .length >= 1,
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library reloads the canonical active plan without regenerating it", async () => {
  const first = mountApp({ storedState: canonicalPlanState() });
  let serialized;

  try {
    assert.ok(await first.ui.findByRole("heading", { name: "Today coach" }));
    serialized = JSON.stringify(first.readState());
    assert.equal(first.readState().plans[0].sessions[0].id, "saved-session-1");
  } finally {
    first.cleanup();
  }

  const second = mountApp({ storedState: serialized });
  try {
    assert.ok(await second.ui.findByRole("heading", { name: "Today coach" }));
    const reloaded = second.readState();
    assert.equal(reloaded.activePlanId, "saved-plan-1");
    assert.equal(reloaded.plans[0].sessions[0].id, "saved-session-1");
    assert.equal(
      sessionWod(reloaded.plans[0].sessions[0]),
      "AMRAP 12: row, burpees, and pull-ups",
    );

    second.fireEvent.click(second.ui.getByRole("button", { name: "Calendar" }));
    assert.ok(
      second
        .view("calendarView")
        .getByText("AMRAP 12: row, burpees, and pull-ups"),
    );
    openMoreTool(second, "Build programme");
    assert.ok(
      second
        .view("builderView")
        .getByText("AMRAP 12: row, burpees, and pull-ups"),
    );
  } finally {
    second.cleanup();
  }
});

test("React Testing Library edits one canonical session across every consumer", async () => {
  const { cleanup, fireEvent, readState, ui, view, waitFor } = mountApp({
    storedState: canonicalPlanState({ kind: "generated" }),
  });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    const builder = view("builderView");
    fireEvent.change(ui.getByLabelText("Plan name"), {
      target: { value: "Renamed canonical programme" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Save plan name" }));
    await waitFor(() =>
      assert.equal(readState().plans[0].title, "Renamed canonical programme"),
    );
    fireEvent.click(builder.getByRole("button", { name: "Edit" }));
    fireEvent.change(ui.getByLabelText("Day or title"), {
      target: { value: "Edited canonical session" },
    });
    fireEvent.change(ui.getByLabelText("WOD"), {
      target: { value: "For time: run, thrusters, and chest-to-bar" },
    });
    fireEvent.click(
      ui.getByRole("button", { name: "Update training session" }),
    );

    await waitFor(() => {
      const session = readState().plans[0].sessions[0];
      assert.equal(session.id, "saved-session-1");
      assert.equal(session.customized, true);
      assert.equal(session.title, "Edited canonical session");
    });

    fireEvent.click(ui.getByRole("button", { name: "Calendar" }));
    assert.ok(view("calendarView").getByText(/Renamed canonical programme/));
    assert.ok(
      view("calendarView").getByText(
        "For time: run, thrusters, and chest-to-bar",
      ),
    );

    openMoreTool({ fireEvent, ui }, "Competition proof");
    assert.ok(
      view("proofView").getByRole("option", {
        name: /Edited canonical session/,
      }),
    );
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(
      view("logView").getByRole("option", {
        name: /Edited canonical session/,
      }),
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library regenerates once and renders the same saved WOD in Plan and Build", async () => {
  const { cleanup, fireEvent, readState, ui, view, waitFor } = mountApp({
    storedState: canonicalPlanState({ kind: "generated", customized: false }),
  });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    const before = structuredClone(readState());
    fireEvent.click(
      ui.getByRole("button", { name: "Regenerate 8-week programme" }),
    );

    await waitFor(() => {
      assert.notEqual(
        readState().plans[0].generationSeed,
        before.plans[0].generationSeed,
      );
    });
    const after = readState();
    assert.equal(after.plans.length, 1);
    assert.equal(after.plans[0].id, before.plans[0].id);
    assert.deepEqual(
      after.plans[0].generatorOptions,
      before.plans[0].generatorOptions,
    );
    assert.equal(after.plans[0].sessions.length, 32);
    assert.equal(
      after.plans[0].sessions.some(
        (session) => session.id === "saved-session-1",
      ),
      false,
    );
    assert.notEqual(
      sessionWod(after.plans[0].sessions[0]),
      sessionWod(before.plans[0].sessions[0]),
    );

    fireEvent.click(ui.getByRole("button", { name: "Calendar" }));
    const firstSession = after.plans[0].sessions.find(
      (session) => session.week === 1,
    );
    assert.ok(view("calendarView").getByText(sessionWod(firstSession)));
    openMoreTool({ fireEvent, ui }, "Build programme");
    assert.ok(view("builderView").getByText(sessionWod(firstSession)));
    openMoreTool({ fireEvent, ui }, "Competition proof");
    const proofOption = view("proofView").getByRole("option", {
      name: new RegExp(
        firstSession.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    });
    assert.equal(proofOption.value, firstSession.id);
    assert.equal(
      view("proofView").queryByRole("option", {
        name: /Saved canonical session/,
      }),
      null,
    );
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    const logOption = view("logView").getByRole("option", {
      name: new RegExp(
        firstSession.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      ),
    });
    assert.equal(logOption.value, firstSession.id);
  } finally {
    cleanup();
  }
});

test("REG-001 REG-002 React keeps programme and week selection canonical across consumers and reload", async () => {
  const mounted = mountApp();

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );
    const firstState = mounted.readState();
    const firstProgramId = firstState.activeV2ProgramId;
    const firstProgram = firstState.v2Programs.find(
      (program) => program.id === firstProgramId,
    );
    mounted.fireEvent.change(mounted.ui.getByLabelText("V2 programme name"), {
      target: { value: "First V2 block" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save V2 programme name" }),
    );

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Create new V2 programme" }),
    );
    mounted.fireEvent.change(mounted.ui.getByLabelText("Programming goal"), {
      target: { value: "strength" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", {
        name: "Generate a new future block",
      }),
    );

    await mounted.waitFor(() => {
      assert.equal(mounted.readState().v2Programs.length, 2);
    });
    const secondState = mounted.readState();
    const secondProgramId = secondState.activeV2ProgramId;
    const secondProgram = secondState.v2Programs.find(
      (program) => program.id === secondProgramId,
    );
    assert.notEqual(firstProgramId, secondProgramId);
    assert.notEqual(
      firstProgram.trainingBlocks[0].trainingWeeks[0].sessions[0].id,
      secondProgram.trainingBlocks[0].trainingWeeks[0].sessions[0].id,
    );

    mounted.fireEvent.change(mounted.ui.getByLabelText("V2 programme name"), {
      target: { value: "Second V2 block" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save V2 programme name" }),
    );

    const selector = mounted.ui.getByLabelText("Active programme");
    mounted.fireEvent.change(selector, {
      target: { value: `v2:${firstProgramId}` },
    });
    await mounted.waitFor(() => {
      assert.equal(
        mounted.ui.getByLabelText("V2 programme name").value,
        "First V2 block",
      );
    });

    mounted.fireEvent.change(selector, {
      target: { value: `v2:${secondProgramId}` },
    });
    await mounted.waitFor(() => {
      assert.equal(
        mounted.ui.getByLabelText("V2 programme name").value,
        "Second V2 block",
      );
    });

    mounted.fireEvent.click(
      mounted.view("builderView").getByRole("button", { name: "Week 2" }),
    );
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().selectedWeek, 2),
    );

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Calendar" }),
    );
    await mounted.waitFor(() => {
      assert.equal(mounted.ui.getByLabelText("Programme week").value, "2");
      assert.equal(
        mounted
          .view("calendarView")
          .queryByText("Active periodized V2 programme"),
        null,
      );
      assert.equal(
        mounted
          .view("calendarView")
          .getByText("Programme details")
          .closest("details").open,
        false,
      );
    });

    mounted.fireEvent.change(mounted.ui.getByLabelText("Programme week"), {
      target: { value: "3" },
    });
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().selectedWeek, 3),
    );

    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Log" }));
    await mounted.waitFor(() => {
      const logView = mounted.view("logView");
      assert.equal(logView.getByLabelText("Week").value, "3");
      assert.ok(logView.getByLabelText("Session").options.length > 0);
    });

    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "More" }));
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Competition proof" }),
    );
    await mounted.waitFor(() => {
      assert.ok(mounted.ui.getByLabelText("Workout source").options.length > 0);
    });

    const persisted = mounted.readState();
    assert.equal(persisted.activeV2ProgramId, secondProgramId);
    assert.equal(persisted.selectedWeek, 3);
    mounted.cleanup();

    const reloaded = mountApp({ storedState: persisted });
    try {
      openMoreTool(reloaded, "Build programme");
      await reloaded.waitFor(() => {
        const builderView = reloaded.view("builderView");
        assert.equal(
          builderView.getByLabelText("Active programme").value,
          `v2:${secondProgramId}`,
        );
        assert.equal(
          builderView.getByRole("button", { name: "Week 3" }).className,
          "is-active",
        );
      });
    } finally {
      reloaded.cleanup();
    }
  } finally {
    if (global.window) mounted.cleanup();
  }
});

test("REG-014 React reloads a historical eight-week Strength programme without changing it", async () => {
  const storedState = historicalEightWeekStrengthState();
  const originalProgram = structuredClone(storedState.v2Programs[0]);
  const mounted = mountApp({ storedState });

  try {
    openMoreTool(mounted, "Build programme");
    const builder = mounted.view("builderView");
    await mounted.waitFor(() => {
      assert.ok(builder.getByTestId("v2-programme"));
      assert.equal(
        builder.getByLabelText("Active programme").value,
        `v2:${originalProgram.id}`,
      );
      assert.equal(
        builder.getByLabelText("V2 programme name").value,
        "Eight-week strength testing block",
      );
      assert.equal(
        builder.getByRole("button", { name: "Week 2" }).className,
        "is-active",
      );
    });
    for (let week = 1; week <= 8; week += 1) {
      assert.ok(builder.getByRole("button", { name: `Week ${week}` }));
    }
    assert.equal(builder.queryByText(/PROGRAMME_VERSION_MISMATCH/), null);

    const reloadedState = mounted.readState();
    const reloadedProgram = reloadedState.v2Programs.find(
      (program) => program.id === originalProgram.id,
    );
    const completedSession =
      reloadedProgram.trainingBlocks[0].trainingWeeks[1].sessions[0];
    assert.deepEqual(reloadedProgram, originalProgram);
    assert.equal(reloadedProgram.trainingBlocks[0].trainingWeeks.length, 8);
    assert.equal(reloadedProgram.trainingBlocks[0].currentWeek, 2);
    assert.equal(completedSession.id, "0570808e-8649-4c80-a407-14d62191fd28");
    assert.equal(completedSession.status, "completed");
    assert.equal(
      completedSession.feedback.notes,
      "Historical progress must survive reload.",
    );
    assert.equal(reloadedState.v2ProgramRevisions[originalProgram.id], 4);
  } finally {
    mounted.cleanup();
  }
});

test("React persists unrelated week changes when an inactive V2 programme is invalid", async () => {
  const source = mountApp();
  let storedState;

  try {
    openMoreTool(source, "Build programme");
    source.fireEvent.click(
      source.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );
    storedState = source.readState();
  } finally {
    source.cleanup();
  }

  storedState.v2Programs.push({
    id: "invalid-inactive-v2-programme",
    engineVersion: "v2",
    schemaVersion: 2,
    trainingBlocks: [],
  });

  const mounted = mountApp({ storedState });
  try {
    mounted.fireEvent.change(mounted.ui.getByLabelText("Dashboard week"), {
      target: { value: "2" },
    });
    await mounted.waitFor(() => {
      const persisted = mounted.readState();
      assert.equal(persisted.selectedWeek, 2);
      assert.equal(persisted.activeV2ProgramId, storedState.activeV2ProgramId);
      assert.equal(
        persisted.v2Programs.some(
          (program) => program.id === "invalid-inactive-v2-programme",
        ),
        true,
      );
      assert.equal(mounted.ui.queryByText("Local save failed"), null);
    });
  } finally {
    mounted.cleanup();
  }
});

test("REG-013 React identifies a loaded programme with a missing template and offers explicit replacement", async () => {
  const source = mountApp();
  let storedState;

  try {
    openMoreTool(source, "Build programme");
    source.fireEvent.click(
      source.ui.getByRole("button", {
        name: "Generate six-week V2 block",
      }),
    );
    await source.waitFor(() => {
      assert.ok(source.readState().activeV2ProgramId);
    });
    storedState = source.readState();
  } finally {
    source.cleanup();
  }

  const invalidProgram = storedState.v2Programs.find(
    (program) => program.id === storedState.activeV2ProgramId,
  );
  delete invalidProgram.trainingBlocks[0].templateId;

  const mounted = mountApp({ storedState });
  try {
    openMoreTool(mounted, "Build programme");

    assert.ok(
      mounted.ui.getByRole("heading", { name: "V2 programme rejected" }),
    );
    assert.ok(
      mounted.ui.getByText(
        new RegExp(
          `UNSUPPORTED_TEMPLATE.*template <missing>.*programme ${invalidProgram.id}.*type mixed_strength_6w`,
        ),
      ),
    );
    assert.equal(mounted.ui.getByLabelText("Training template").value, "");
    assert.ok(
      mounted.ui.getByRole("option", {
        name: "Select a supported V2 template",
      }),
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library preserves the active plan when generation is rejected", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  const mounted = mountApp({
    storedState: canonicalPlanState({ kind: "generated", customized: false }),
    apiOverrides: {
      buildGeneratedProgramme: () => {
        throw new Error("invalid structured workout");
      },
    },
  });
  const { cleanup, fireEvent, readState, ui, waitFor } = mounted;

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    const before = structuredClone(readState());
    fireEvent.click(
      ui.getByRole("button", { name: "Regenerate 8-week programme" }),
    );

    await waitFor(() =>
      assert.ok(
        ui.getByText(
          "Programme generation could not produce valid workouts. Your current plan was not changed.",
        ),
      ),
    );
    assert.deepEqual(readState().plans, before.plans);
    assert.equal(readState().activePlanId, before.activePlanId);
  } finally {
    cleanup();
    console.error = originalConsoleError;
  }
});

test("React Testing Library persists a sparse plan fallback week when switching plans", async () => {
  const weekOnePlan = sparsePlanFixture({
    id: "week-one-plan",
    title: "Week one plan",
    week: 1,
  });
  const weekFourPlan = sparsePlanFixture({
    id: "week-four-plan",
    title: "Week four plan",
    week: 4,
  });
  const storedState = {
    ...canonicalPlanState(),
    plans: [weekOnePlan, weekFourPlan],
    activePlanId: weekOnePlan.id,
    selectedWeek: 1,
  };
  const mounted = mountApp({ storedState });
  let persistedState;

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.change(mounted.ui.getByLabelText("Active plan"), {
      target: { value: weekFourPlan.id },
    });

    await assertPlanSessionAcrossViews(mounted, weekFourPlan);
    persistedState = mounted.readState();
  } finally {
    mounted.cleanup();
  }

  const reloaded = mountApp({ storedState: persistedState });
  try {
    await reloaded.ui.findByRole("heading", { name: "Today coach" });
    await assertPlanSessionAcrossViews(reloaded, weekFourPlan);
  } finally {
    reloaded.cleanup();
  }
});

test("React Testing Library repairs a stale selected week when a sparse plan loads", async () => {
  const plan = sparsePlanFixture({
    id: "startup-week-five-plan",
    title: "Startup week five plan",
    week: 5,
  });
  const mounted = mountApp({
    storedState: {
      ...canonicalPlanState(),
      plans: [plan],
      activePlanId: plan.id,
      selectedWeek: 1,
    },
  });

  try {
    await mounted.ui.findByRole("heading", { name: "Today coach" });
    await assertPlanSessionAcrossViews(mounted, plan);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library selects and reloads a session added to a different sparse week", async () => {
  const originalPlan = sparsePlanFixture({
    id: "add-different-week-plan",
    title: "Add different week plan",
    week: 1,
  });
  const mounted = mountApp({
    storedState: {
      ...canonicalPlanState(),
      plans: [originalPlan],
      activePlanId: originalPlan.id,
      selectedWeek: 1,
    },
  });
  let persistedState;
  let updatedPlan;

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.change(document.querySelector("#customPlanWeek"), {
      target: { value: "5" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Day or title"), {
      target: { value: "New week five session" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("WOD"), {
      target: { value: "5 rounds: run, pull-ups, and front squats" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save training session" }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.selectedWeek, 5);
      assert.equal(state.plans[0].sessions[0].title, "New week five session");
    });
    updatedPlan = mounted.readState().plans[0];
    await assertPlanSessionAcrossViews(mounted, {
      ...updatedPlan,
      sessions: [updatedPlan.sessions[0]],
    });
    persistedState = mounted.readState();
  } finally {
    mounted.cleanup();
  }

  const reloaded = mountApp({ storedState: persistedState });
  try {
    await reloaded.ui.findByRole("heading", { name: "Today coach" });
    await assertPlanSessionAcrossViews(reloaded, {
      ...updatedPlan,
      sessions: [updatedPlan.sessions[0]],
    });
  } finally {
    reloaded.cleanup();
  }
});

test("React Testing Library selects the first session added without an active plan", async () => {
  const mounted = mountApp({
    storedState: {
      ...canonicalPlanState(),
      plans: [],
      activePlanId: null,
      selectedWeek: 2,
    },
  });

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.change(document.querySelector("#customPlanWeek"), {
      target: { value: "7" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Day or title"), {
      target: { value: "First week seven session" },
    });
    mounted.fireEvent.change(mounted.ui.getByLabelText("WOD"), {
      target: { value: "For time: row, burpees, and cleans" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save training session" }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.ok(state.activePlanId);
      assert.equal(state.selectedWeek, 7);
      assert.equal(
        state.plans[0].sessions[0].title,
        "First week seven session",
      );
    });
    const plan = mounted.readState().plans[0];
    await assertPlanSessionAcrossViews(mounted, plan);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library persists the sparse fallback week after deleting the active plan", async () => {
  const weekSixPlan = sparsePlanFixture({
    id: "week-six-plan",
    title: "Week six plan",
    week: 6,
  });
  const deletedWeekFourPlan = sparsePlanFixture({
    id: "deleted-week-four-plan",
    title: "Deleted week four plan",
    week: 4,
  });
  const storedState = {
    ...canonicalPlanState(),
    plans: [weekSixPlan, deletedWeekFourPlan],
    activePlanId: deletedWeekFourPlan.id,
    selectedWeek: 4,
  };
  const mounted = mountApp({ storedState });
  let persistedState;

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Delete custom plan" }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.deepEqual(
        state.plans.map((plan) => plan.id),
        [weekSixPlan.id],
      );
      assert.equal(state.activePlanId, weekSixPlan.id);
      assert.equal(state.selectedWeek, 6);
    });
    await assertPlanSessionAcrossViews(mounted, weekSixPlan);
    persistedState = mounted.readState();
  } finally {
    mounted.cleanup();
  }

  const reloaded = mountApp({ storedState: persistedState });
  try {
    await reloaded.ui.findByRole("heading", { name: "Today coach" });
    await assertPlanSessionAcrossViews(reloaded, weekSixPlan);
  } finally {
    reloaded.cleanup();
  }
});

test("React Testing Library follows a session moved out of the active sparse week", async () => {
  const plan = sparsePlanFixture({
    id: "move-session-plan",
    title: "Move session plan",
    week: 1,
  });
  const mounted = mountApp({
    storedState: {
      ...canonicalPlanState(),
      plans: [plan],
      activePlanId: plan.id,
      selectedWeek: 1,
    },
  });

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.view("builderView").getByRole("button", { name: "Edit" }),
    );
    mounted.fireEvent.change(document.querySelector("#customPlanWeek"), {
      target: { value: "4" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Update training session" }),
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.plans[0].sessions[0].week, 4);
      assert.equal(state.selectedWeek, 4);
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Calendar" }),
    );
    assert.equal(document.querySelector("#programWeek").value, "4");
    assert.ok(
      mounted
        .view("calendarView")
        .getByText("AMRAP 11: Move session plan workout"),
    );
    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Log" }));
    assert.equal(
      mounted.ui.getByLabelText("Session").value,
      plan.sessions[0].id,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library falls back after deleting the last session in the selected week", async () => {
  const weekOne = sparsePlanFixture({
    id: "delete-week-one",
    title: "Delete week one",
    week: 1,
  });
  const weekSix = sparsePlanFixture({
    id: "keep-week-six",
    title: "Keep week six",
    week: 6,
  });
  const plan = {
    ...weekOne,
    id: "multi-week-delete-plan",
    title: "Multi-week delete plan",
    sessions: [...weekOne.sessions, ...weekSix.sessions],
  };
  const mounted = mountApp({
    storedState: {
      ...canonicalPlanState(),
      plans: [plan],
      activePlanId: plan.id,
      selectedWeek: 1,
    },
  });

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.view("builderView").getAllByRole("button", { name: "Delete" })[0],
    );

    await mounted.waitFor(() => {
      const state = mounted.readState();
      assert.equal(state.plans[0].sessions.length, 1);
      assert.equal(state.plans[0].sessions[0].id, weekSix.sessions[0].id);
      assert.equal(state.selectedWeek, 6);
    });
    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Log" }));
    assert.equal(
      mounted.ui.getByLabelText("Session").value,
      weekSix.sessions[0].id,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library renders a valid empty Log state for an empty active plan", async () => {
  const plan = sparsePlanFixture({
    id: "empty-plan",
    title: "Empty plan",
    week: 1,
  });
  const mounted = mountApp({
    storedState: {
      ...canonicalPlanState(),
      plans: [plan],
      activePlanId: plan.id,
      selectedWeek: 1,
    },
  });

  try {
    openMoreTool(mounted, "Build programme");
    mounted.fireEvent.click(
      mounted.view("builderView").getByRole("button", { name: "Delete" }),
    );
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().plans[0].sessions.length, 0),
    );

    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Log" }));
    const sessionSelect = mounted.ui.getByLabelText("Session");
    assert.equal(sessionSelect.value, "");
    assert.equal(sessionSelect.disabled, true);
    assert.ok(
      mounted.ui.getByRole("option", {
        name: "No sessions scheduled for week 1",
      }).disabled,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library confirms and fully deletes a custom plan", async () => {
  const historicalLog = {
    id: "historical-log",
    date: "2026-07-02",
    week: 1,
    dayId: "saved-session-1",
    dayTitle: "Saved canonical session",
    readiness: "green",
    wodScore: "5 rounds",
    createdAt: "2026-07-02T12:00:00.000Z",
  };
  const { cleanup, confirmCalls, fireEvent, readState, ui, view, waitFor } =
    mountApp({
      storedState: canonicalPlanState({ logs: [historicalLog] }),
      confirmResponses: [false, true],
    });

  try {
    openMoreTool({ fireEvent, ui }, "Build programme");
    const deleteButton = ui.getByRole("button", {
      name: "Delete custom plan",
    });
    fireEvent.click(deleteButton);
    assert.equal(readState().plans.length, 1);
    assert.match(confirmCalls[0], /Canonical programme/);

    fireEvent.click(deleteButton);
    await waitFor(() => assert.equal(readState().plans.length, 0));
    const saved = readState();
    assert.equal(saved.activePlanId, null);
    assert.equal(activeScores(saved).logs[0].id, "historical-log");
    assert.match(
      document.querySelector("#calendarView").className,
      /is-active/,
    );
    assert.ok(view("calendarView").getByRole("heading", { name: "Calendar" }));

    openMoreTool({ fireEvent, ui }, "Competition proof");
    assert.equal(
      ui.queryByRole("option", { name: /Saved canonical session/ }),
      null,
    );
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.notEqual(ui.getByLabelText("Session").value, "saved-session-1");
  } finally {
    cleanup();
  }
});

test("React Testing Library migrates legacy custom plans during startup", async () => {
  const legacyState = {
    customPlans: [
      {
        id: "legacy-session",
        week: 1,
        title: "Legacy custom session",
        focus: "Preserve me",
        warmup: ["Legacy warm-up"],
        strength: [],
        wod: ["AMRAP 10: legacy workout"],
        mobility: [],
        duration: 45,
        intensity: "Moderate",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    selectedWeek: 1,
  };
  const { cleanup, fireEvent, readState, ui, view } = mountApp({
    storedState: legacyState,
  });

  try {
    assert.ok(await ui.findByRole("heading", { name: "Today coach" }));
    const saved = readState();
    assert.equal(Object.hasOwn(saved, "customPlans"), false);
    assert.equal(saved.plans[0].sessions[0].id, "legacy-session");
    fireEvent.click(ui.getByRole("button", { name: "Calendar" }));
    assert.ok(view("calendarView").getByText("AMRAP 10: legacy workout"));
    openMoreTool({ fireEvent, ui }, "Build programme");
    assert.ok(view("builderView").getByText("AMRAP 10: legacy workout"));
  } finally {
    cleanup();
  }
});

test("React Testing Library filters the movement library", async () => {
  const { cleanup, fireEvent, ui, view, waitFor } = mountApp();

  try {
    openMoreTool({ fireEvent, ui }, "Movement library");
    const learnView = view("learnView");
    assert.ok(
      await learnView.findByRole("heading", { name: "Learn the skills" }),
    );

    fireEvent.change(learnView.getByLabelText("Movement category"), {
      target: { value: "Weightlifting" },
    });
    fireEvent.change(
      learnView.getByPlaceholderText("Bar muscle-up, snatch, rope climb"),
      {
        target: { value: "snatch" },
      },
    );

    await waitFor(() =>
      assert.ok(learnView.getByRole("heading", { name: "Snatch" })),
    );
    assert.equal(
      learnView.queryByRole("heading", { name: "Bar muscle-up" }),
      null,
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library rejects zero and negative PR attempts before saving", async () => {
  const mounted = mountApp();

  try {
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Progress" }),
    );
    const result = mounted.ui.getByLabelText("Result");
    const save = mounted.ui.getByRole("button", { name: "Save PR attempt" });

    mounted.fireEvent.change(result, { target: { value: "0" } });
    mounted.fireEvent.click(save);
    assert.ok(mounted.ui.getByText("Enter a number greater than zero."));
    assert.equal(activeScores(mounted.readState()).prAttempts.length, 0);

    mounted.fireEvent.change(result, { target: { value: "-5" } });
    mounted.fireEvent.click(save);
    assert.ok(mounted.ui.getByText("Enter a number greater than zero."));
    assert.equal(activeScores(mounted.readState()).prAttempts.length, 0);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library persists and applies the theme preference", async () => {
  const mounted = mountApp({ prefersDark: false });
  const { cleanup, fireEvent, ui, waitFor } = mounted;

  try {
    openMore(mounted);
    const themeSelect = await ui.findByLabelText("Theme preference");
    assert.equal(themeSelect.value, "system");

    fireEvent.change(themeSelect, { target: { value: "dark" } });

    await waitFor(() =>
      assert.equal(document.documentElement.dataset.theme, "dark"),
    );
    assert.equal(
      document
        .querySelector('meta[name="theme-color"]')
        .getAttribute("content"),
      "#070907",
    );

    const savedDarkState = JSON.parse(
      window.localStorage.getItem("forge-hour-state-v1"),
    );
    assert.equal(savedDarkState.themePreference, "dark");

    fireEvent.change(themeSelect, { target: { value: "light" } });

    await waitFor(() =>
      assert.equal(document.documentElement.dataset.theme, "light"),
    );
    assert.equal(
      document
        .querySelector('meta[name="theme-color"]')
        .getAttribute("content"),
      "#10120f",
    );

    const savedLightState = JSON.parse(
      window.localStorage.getItem("forge-hour-state-v1"),
    );
    assert.equal(savedLightState.themePreference, "light");
  } finally {
    cleanup();
  }
});

test("React Testing Library uses system preference by default", async () => {
  const mounted = mountApp({ prefersDark: true });
  const { cleanup, ui, waitFor } = mounted;

  try {
    openMore(mounted);
    const themeSelect = await ui.findByLabelText("Theme preference");
    assert.equal(themeSelect.value, "system");
    await waitFor(() =>
      assert.equal(document.documentElement.dataset.theme, "dark"),
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library shows Supabase setup guidance when sync is not configured", async () => {
  const mounted = mountApp();
  const { cleanup, ui } = mounted;

  try {
    openMore(mounted);
    assert.ok(await ui.findByRole("heading", { name: "Database sync" }));
    assert.ok(ui.getAllByText(/Supabase SDK could not load/).length >= 1);
  } finally {
    cleanup();
  }
});

test("React Testing Library uses bundled Supabase config if the config file is cached or missing", async () => {
  const supabaseMock = createMockSupabase();
  const mounted = mountApp({ supabaseMock, supabaseConfig: false });
  const { cleanup, ui } = mounted;

  try {
    openMore(mounted);
    assert.ok(await ui.findByRole("heading", { name: "Database sync" }));
    assert.ok(ui.getByText("Sign in to sync your private athlete account."));
    assert.ok(ui.getByRole("button", { name: "Email sign-in link" }));
  } finally {
    cleanup();
  }
});

test("React Testing Library migrates legacy profile and programmes into the guest account", async () => {
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    profile: {
      ...cloneDefaultProfile(),
      athleteName: "Legacy Guest",
    },
  };
  const mounted = mountApp({ storedState });

  try {
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().schemaVersion, 7);
    });
    const saved = mounted.readState();
    assert.equal(saved.schemaVersion, 7);
    assert.equal(saved.activeScoreOwner, "guest");
    assert.equal(
      saved.athleteStateByOwner.guest.profile.athleteName,
      "Legacy Guest",
    );
    assert.equal(saved.athleteStateByOwner.guest.plans[0].id, "saved-plan-1");
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library lets remote account data win and restores guest data on sign-out", async () => {
  const guest = privateAthleteState("Guest Athlete");
  const account = privateAthleteState("Remote Athlete");
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    profile: guest.profile,
  };
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      athlete_states: [
        {
          user_id: "user-1",
          schema_version: 1,
          state: account,
          updated_at: "2026-07-21T08:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted, { openAccount: true });
    assert.equal(mounted.ui.getByLabelText("Athlete").value, "Remote Athlete");
    let saved = mounted.readState();
    assert.equal(saved.activeScoreOwner, "user-1");
    assert.equal(
      saved.athleteStateByOwner.guest.profile.athleteName,
      "Guest Athlete",
    );
    assert.equal(
      saved.athleteStateByOwner["user-1"].profile.athleteName,
      "Remote Athlete",
    );

    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Sign out" }),
    );
    await mounted.waitFor(() => {
      assert.equal(mounted.ui.getByLabelText("Athlete").value, "Guest Athlete");
    });
    await mounted.waitFor(() => {
      assert.equal(mounted.readState().activeScoreOwner, "guest");
    });
    saved = mounted.readState();
    assert.equal(saved.activeScoreOwner, "guest");
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library imports guest profile and programmes only after confirmation", async () => {
  const calls = [];
  const guest = privateAthleteState("Guest Athlete");
  const account = privateAthleteState("Account Athlete", {
    ...canonicalPlanState(),
    plans: [],
    activePlanId: null,
  });
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    profile: guest.profile,
  };
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    remote: {
      athlete_states: [
        {
          user_id: "user-1",
          schema_version: 1,
          state: account,
          updated_at: "2026-07-21T08:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted, { openAccount: true });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: /Import guest data \(/ }),
    );
    await mounted.waitFor(() => {
      const imported = calls.find(
        (call) =>
          call.type === "upsert" &&
          call.table === "athlete_states" &&
          call.payload.state.profile.athleteName === "Guest Athlete",
      );
      assert.ok(imported);
    });
    assert.match(
      mounted.confirmCalls[0],
      /replace this account's profile and programmes/i,
    );
    assert.equal(mounted.ui.getByLabelText("Athlete").value, "Guest Athlete");
    const saved = mounted.readState();
    assert.equal(
      saved.athleteStateByOwner.guest.profile.athleteName,
      "Guest Athlete",
    );
    assert.equal(
      saved.athleteStateByOwner["user-1"].profile.athleteName,
      "Guest Athlete",
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library autosaves signed-in profile changes", async () => {
  const calls = [];
  const account = privateAthleteState("Before Save");
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    remote: {
      athlete_states: [
        {
          user_id: "user-1",
          schema_version: 1,
          state: account,
          updated_at: "2026-07-21T08:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ supabaseMock });

  try {
    await waitForSignedIn(mounted, { openAccount: true });
    mounted.fireEvent.change(mounted.ui.getByLabelText("Athlete"), {
      target: { value: "After Save" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save assessment" }),
    );
    await mounted.waitFor(
      () => {
        assert.ok(
          calls.find(
            (call) =>
              call.type === "upsert" &&
              call.table === "athlete_states" &&
              call.payload.state.profile.athleteName === "After Save",
          ),
        );
      },
      { timeout: 2000 },
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library loads remote Supabase scores for a signed-in user", async () => {
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      workout_logs: [
        {
          id: "remote-log",
          date: "2026-07-08",
          week: 1,
          day_id: "day1",
          day_title: "Back squat + T2B",
          readiness: "green",
          rpe: "8",
          strength_result: "Remote squat",
          wod_score: "5 rounds",
          notes: "Remote note",
          mobility_done: true,
          created_at: "2026-07-08T10:00:00.000Z",
        },
      ],
      pr_attempts: [],
      personal_records: [
        {
          metric_id: "backSquat",
          value: 150,
          display: "150 kg",
          date: "2026-07-08",
          notes: "Remote PR",
        },
      ],
    },
  });
  const mounted = mountApp({ supabaseMock });
  const { cleanup, fireEvent, ui } = mounted;

  try {
    await waitForSignedIn(mounted);
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/Remote squat/));
    fireEvent.click(ui.getByRole("button", { name: "Progress" }));
    assert.ok(await ui.findByText("150 kg"));
  } finally {
    cleanup();
  }
});

test("React Testing Library preserves local achievements during remote score hydration", async () => {
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 6,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": {
        logs: [],
        prs: {},
        prAttempts: [],
        achievementState: {
          version: 1,
          earned: { "rx-ready": "2026-07-01T10:00:00.000Z" },
          acknowledgedIds: ["rx-ready"],
          lastEvaluatedAt: "2026-07-01T10:00:00.000Z",
        },
      },
    },
  };
  delete storedState.logs;
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      workout_logs: [
        {
          id: "hydrated-log",
          date: "2026-07-08",
          week: 1,
          day_id: "day1",
          day_title: "Hydrated workout",
          readiness: "green",
          created_at: "2026-07-08T10:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted);
    await mounted.waitFor(() => {
      const scores = mounted.readState().scoreDataByOwner["user-1"];
      assert.equal(scores.logs[0].id, "hydrated-log");
      assert.ok(scores.achievementState.earned["rx-ready"]);
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Progress" }),
    );
    const rxReady = mounted
      .view("progressView")
      .getAllByRole("article")
      .find((article) => article.textContent.includes("RX Ready"));
    assert.ok(rxReady);
    assert.match(rxReady.textContent, /Earned/);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library saves workout logs through Supabase when signed in", async () => {
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
  });
  const mounted = mountApp({ supabaseMock });
  const { cleanup, fireEvent, ui, waitFor } = mounted;

  try {
    await waitForSignedIn(mounted);
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    fireEvent.change(ui.getByLabelText("WOD score"), {
      target: { value: "4 rounds + 8 reps" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const insert = calls.find(
        (call) => call.type === "upsert" && call.table === "workout_logs",
      );
      assert.ok(insert);
      assert.equal(insert.payload.user_id, "user-1");
      assert.equal(insert.payload.wod_score, "4 rounds + 8 reps");
    });
  } finally {
    cleanup();
  }
});

test("React Testing Library does not re-upload a timer already present remotely", async () => {
  const timerResult = {
    mode: "amrap",
    elapsedSeconds: 600,
    plannedSeconds: 600,
  };
  const localLog = {
    id: "synced-timer-log",
    date: "2026-07-14",
    week: 1,
    dayId: "day1",
    dayTitle: "Timer sync workout",
    readiness: "green",
    timerResult,
    createdAt: "2026-07-14T10:00:00.000Z",
  };
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": { logs: [localLog], prs: {}, prAttempts: [] },
    },
  };
  delete storedState.logs;
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    remote: {
      workout_logs: [
        {
          id: localLog.id,
          date: localLog.date,
          week: localLog.week,
          day_id: localLog.dayId,
          day_title: localLog.dayTitle,
          readiness: localLog.readiness,
          timer_result: timerResult,
          created_at: localLog.createdAt,
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted, { openAccount: true });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Retry account sync" }),
    );
    assert.ok(
      await mounted.ui.findByText(
        "Private athlete account synced to Supabase.",
      ),
    );
    assert.equal(
      calls.filter(
        (call) => call.type === "upsert" && call.table === "workout_logs",
      ).length,
      0,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library reports timer metadata pending on a legacy schema", async () => {
  const timerResult = {
    mode: "amrap",
    elapsedSeconds: 540,
    plannedSeconds: 600,
  };
  const localLog = {
    id: "pending-timer-log",
    date: "2026-07-14",
    week: 1,
    dayId: "day1",
    dayTitle: "Pending timer workout",
    readiness: "green",
    timerResult,
    createdAt: "2026-07-14T11:00:00.000Z",
  };
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": { logs: [localLog], prs: {}, prAttempts: [] },
    },
  };
  delete storedState.logs;
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    missingUpsertColumns: ["timer_result"],
    remote: {
      workout_logs: [
        {
          id: localLog.id,
          date: localLog.date,
          week: localLog.week,
          day_id: localLog.dayId,
          day_title: localLog.dayTitle,
          readiness: localLog.readiness,
          created_at: localLog.createdAt,
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted, { openAccount: true });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Retry account sync" }),
    );
    assert.ok(
      await mounted.ui.findByText(
        "Account synced. Some workout metadata stays local until the Supabase schema is updated.",
      ),
    );
    const workoutWrites = calls.filter(
      (call) => call.type === "upsert" && call.table === "workout_logs",
    );
    assert.equal(workoutWrites.length, 2);
    assert.ok(Object.hasOwn(workoutWrites[0].payload[0], "timer_result"));
    assert.equal(
      Object.hasOwn(workoutWrites[1].payload[0], "timer_result"),
      false,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library isolates signed-in scores from legacy guest scores", async () => {
  const guestLog = {
    id: "guest-log",
    date: "2026-07-10",
    week: 1,
    dayId: "day1",
    dayTitle: "Guest workout",
    readiness: "green",
    strengthResult: "Guest-only squat",
    createdAt: "2026-07-10T10:00:00.000Z",
  };
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    remote: {
      workout_logs: [
        {
          id: "remote-log",
          date: "2026-07-11",
          week: 1,
          day_id: "day1",
          day_title: "Account workout",
          readiness: "green",
          rpe: null,
          strength_result: "Account-only squat",
          wod_score: null,
          notes: null,
          mobility_done: false,
          created_at: "2026-07-11T10:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({
    supabaseMock,
    storedState: canonicalPlanState({ logs: [guestLog] }),
  });
  const { cleanup, fireEvent, readState, ui, waitFor } = mounted;

  try {
    await waitForSignedIn(mounted, { openAccount: true });
    const selectedTables = calls
      .filter((call) => call.type === "select")
      .map((call) => call.table);
    assert.equal(
      selectedTables.filter((table) => table !== "programming_engine_flags")
        .length,
      6,
    );
    assert.ok(selectedTables.includes("programming_engine_flags"));
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/Account-only squat/));
    assert.equal(ui.queryByText(/Guest-only squat/), null);

    fireEvent.click(ui.getByRole("button", { name: "More" }));
    assert.ok(ui.getByRole("button", { name: /Import guest data \(/ }));
    fireEvent.click(ui.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      assert.ok(ui.getByText(/Signed out\. Local cache remains/));
    });
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/Guest-only squat/));
    assert.equal(ui.queryByText(/Account-only squat/), null);

    const saved = readState();
    assert.equal(saved.schemaVersion, 7);
    assert.equal(saved.planSchemaVersion, 5);
    assert.equal(Object.hasOwn(saved, "logs"), false);
    assert.equal(saved.scoreDataByOwner.guest.logs[0].id, "guest-log");
    assert.equal(saved.scoreDataByOwner["user-1"].logs[0].id, "remote-log");
  } finally {
    cleanup();
  }
});

test("React Testing Library reloads only the authenticated owner's score bucket", async () => {
  const scoreLog = (id, strengthResult) => ({
    id,
    date: "2026-07-12",
    week: 1,
    dayId: "day1",
    dayTitle: "Partitioned workout",
    readiness: "green",
    strengthResult,
    createdAt: "2026-07-12T10:00:00.000Z",
  });
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": {
        logs: [scoreLog("user-1-log", "User one private score")],
        prs: {},
        prAttempts: [],
      },
      "user-2": {
        logs: [scoreLog("user-2-log", "User two private score")],
        prs: {},
        prAttempts: [],
      },
    },
  };
  delete storedState.logs;
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-2", email: "two@example.com" } },
  });
  const mounted = mountApp({
    storedState,
    supabaseMock,
  });
  const { cleanup, fireEvent, ui } = mounted;

  try {
    await waitForSignedIn(mounted);
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/User two private score/));
    assert.equal(ui.queryByText(/User one private score/), null);
  } finally {
    cleanup();
  }
});

test("React Testing Library does not overwrite an offline PR with stale remote data", async () => {
  const pendingAttempt = {
    id: "pending-pr-attempt",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 160,
    display: "160 kg",
    date: "2026-07-13",
    notes: "Offline PR",
    isPr: true,
    createdAt: "2026-07-13T10:00:00.000Z",
  };
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    planSchemaVersion: 2,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": {
        logs: [],
        prs: {
          backSquat: {
            metricId: "backSquat",
            value: 160,
            display: "160 kg",
            date: "2026-07-13",
            notes: "Offline PR",
          },
        },
        prAttempts: [pendingAttempt],
      },
    },
  };
  delete storedState.logs;
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      personal_records: [
        {
          metric_id: "backSquat",
          value: 150,
          display: "150 kg",
          date: "2026-07-01",
          notes: "Older remote PR",
        },
      ],
    },
  });
  const mounted = mountApp({
    storedState,
    supabaseMock,
  });
  const { cleanup, fireEvent, ui } = mounted;

  try {
    await waitForSignedIn(mounted);
    fireEvent.click(ui.getByRole("button", { name: "Progress" }));
    assert.ok(await ui.findByText("160 kg"));
    assert.equal(ui.queryByText("150 kg"), null);
  } finally {
    cleanup();
  }
});

test("React Testing Library keeps a better remote PR over a stale offline PR", async () => {
  const pendingAttempt = {
    id: "stale-pending-pr-attempt",
    metricId: "backSquat",
    metricName: "Back squat",
    value: 150,
    display: "150 kg",
    date: "2026-07-10",
    notes: "Stale offline PR",
    isPr: true,
    createdAt: "2026-07-10T10:00:00.000Z",
  };
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    planSchemaVersion: 2,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": {
        logs: [],
        prs: {
          backSquat: {
            metricId: "backSquat",
            value: 150,
            display: "150 kg",
            date: "2026-07-10",
            notes: "Stale offline PR",
            updatedAt: pendingAttempt.createdAt,
          },
        },
        prAttempts: [pendingAttempt],
      },
    },
  };
  delete storedState.logs;
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      personal_records: [
        {
          metric_id: "backSquat",
          value: 160,
          display: "160 kg",
          date: "2026-07-13",
          notes: "Better remote PR",
          updated_at: "2026-07-13T10:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted);
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Progress" }),
    );
    assert.ok(await mounted.ui.findByText("160 kg"));
    const saved = mounted.readState().scoreDataByOwner["user-1"];
    assert.equal(saved.prs.backSquat.value, 160);
    assert.equal(saved.prAttempts[0].isPr, true);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library reconciles an immediate PR save with the canonical remote record", async () => {
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    remote: {
      personal_records: [
        {
          metric_id: "backSquat",
          value: 150,
          display: "150 kg",
          date: "2026-07-10",
          notes: "Hydrated before another device improved it",
          updated_at: "2026-07-10T10:00:00.000Z",
        },
      ],
    },
    rpcResults: {
      save_pr_attempt: {
        metric_id: "backSquat",
        value: 170,
        display: "170 kg",
        date: "2026-07-14",
        notes: "Canonical result from another device",
        updated_at: "2026-07-14T10:00:00.000Z",
      },
    },
  });
  const mounted = mountApp({ supabaseMock });

  try {
    await waitForSignedIn(mounted);
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Progress" }),
    );
    assert.ok(await mounted.ui.findByText("150 kg"));

    mounted.fireEvent.change(mounted.ui.getByLabelText("Result"), {
      target: { value: "160" },
    });
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Save PR attempt" }),
    );

    await mounted.waitFor(() => {
      const scores = mounted.readState().scoreDataByOwner["user-1"];
      assert.equal(scores.prs.backSquat.value, 170);
      assert.equal(scores.prs.backSquat.display, "170 kg");
      assert.equal(scores.prAttempts[0].value, 160);
      assert.equal(scores.prAttempts[0].isPr, true);
    });
    const rpcCall = calls.find(
      (call) => call.type === "rpc" && call.name === "save_pr_attempt",
    );
    assert.equal(rpcCall.payload.p_personal_record.value, 160);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library preserves a better standalone local PR during hydration", async () => {
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    planSchemaVersion: 2,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": {
        logs: [],
        prs: {
          backSquat: {
            metricId: "backSquat",
            value: 170,
            display: "170 kg",
            date: "2026-07-01",
            notes: "Better local record",
            updatedAt: "2026-07-01T10:00:00.000Z",
          },
        },
        prAttempts: [],
      },
    },
  };
  delete storedState.logs;
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      personal_records: [
        {
          metric_id: "backSquat",
          value: 160,
          display: "160 kg",
          date: "2026-07-13",
          notes: "Newer but worse remote record",
          updated_at: "2026-07-13T10:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted);
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Progress" }),
    );
    assert.ok(await mounted.ui.findByText("170 kg"));
    assert.equal(
      mounted.readState().scoreDataByOwner["user-1"].prs.backSquat.value,
      170,
    );
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library preserves newer local PR metadata when the value ties remote", async () => {
  const storedState = {
    ...canonicalPlanState(),
    schemaVersion: 3,
    planSchemaVersion: 2,
    activeScoreOwner: "user-1",
    scoreDataByOwner: {
      guest: { logs: [], prs: {}, prAttempts: [] },
      "user-1": {
        logs: [],
        prs: {
          backSquat: {
            metricId: "backSquat",
            value: 160,
            display: "160 kg",
            date: "2026-07-14",
            notes: "Newer local technique note",
            updatedAt: "2026-07-14T10:00:00.000Z",
          },
          row1k: {
            metricId: "row1k",
            value: 0,
            display: "Not tested",
            date: "Baseline",
            notes: "Newer local baseline note",
            updatedAt: "2026-07-14T10:00:00.000Z",
          },
        },
        prAttempts: [],
      },
    },
  };
  delete storedState.logs;
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    remote: {
      personal_records: [
        {
          metric_id: "backSquat",
          value: 160,
          display: "160 kg",
          date: "2026-07-13",
          notes: "Older remote technique note",
          updated_at: "2026-07-13T10:00:00.000Z",
        },
        {
          metric_id: "row1k",
          value: 0,
          display: "Not tested",
          date: "Baseline",
          notes: "Older remote baseline note",
          updated_at: "2026-07-13T10:00:00.000Z",
        },
      ],
    },
  });
  const mounted = mountApp({ storedState, supabaseMock });

  try {
    await waitForSignedIn(mounted);
    const record = mounted.readState().scoreDataByOwner["user-1"].prs.backSquat;
    assert.equal(record.value, 160);
    assert.equal(record.notes, "Newer local technique note");
    assert.equal(record.updatedAt, "2026-07-14T10:00:00.000Z");
    const baseline = mounted.readState().scoreDataByOwner["user-1"].prs.row1k;
    assert.equal(baseline.value, 0);
    assert.equal(baseline.notes, "Newer local baseline note");
    assert.equal(baseline.updatedAt, "2026-07-14T10:00:00.000Z");
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library never uploads local scores before failed hydration succeeds", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    failSelectOnce: { workout_logs: 1 },
  });
  const mounted = mountApp({ supabaseMock });

  try {
    await mounted.waitFor(() => {
      assert.equal(
        document.querySelector(".app-shell")?.dataset.syncState,
        "error",
      );
    });
    assert.equal(
      calls.some(
        (call) =>
          call.type === "rpc" ||
          (call.type === "upsert" && call.table !== "athlete_states"),
      ),
      false,
    );

    openMore(mounted);
    assert.ok(
      mounted.ui.getByText("Could not load your private athlete account."),
    );
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Retry account sync" }),
    );
    assert.ok(
      await mounted.ui.findByText(
        "Private athlete account synced to Supabase.",
      ),
    );
    assert.ok(
      calls.some(
        (call) => call.type === "upsert" && call.table === "athlete_states",
      ),
    );
  } finally {
    console.warn = originalWarn;
    mounted.cleanup();
  }
});

test("React Testing Library ignores a stale initial session after an auth event", async () => {
  const initialSession = deferred();
  const supabaseMock = createMockSupabase({
    getSessionResult: initialSession.promise,
  });
  const mounted = mountApp({ supabaseMock });

  try {
    await mounted.waitFor(() =>
      assert.equal(supabaseMock.authListenerCount(), 1),
    );
    supabaseMock.emitAuth("SIGNED_IN", {
      user: { id: "user-2", email: "two@example.com" },
    });
    await waitForSignedIn(mounted);

    initialSession.resolve({
      data: {
        session: { user: { id: "user-1", email: "one@example.com" } },
      },
      error: null,
    });
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().activeScoreOwner, "user-2"),
    );
    openMore(mounted);
    assert.ok(mounted.ui.getByText("two@example.com"));
    assert.equal(mounted.ui.queryByText("one@example.com"), null);
  } finally {
    mounted.cleanup();
  }
});

test("React Testing Library keeps failed remote workout saves locally for retry", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
    failUpsertOnce: { workout_logs: 1 },
  });
  const mounted = mountApp({
    supabaseMock,
  });
  const { cleanup, fireEvent, readState, ui, waitFor } = mounted;

  try {
    await waitForSignedIn(mounted);
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    fireEvent.change(ui.getByLabelText("Strength or skill result"), {
      target: { value: "Offline squat survives" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    assert.ok(await ui.findByText(/Offline squat survives/));
    await waitFor(() => {
      assert.ok(ui.getByText("Workout saved locally. Remote sync is pending."));
    });
    const saved = readState();
    assert.equal(saved.activeScoreOwner, "user-1");
    assert.equal(
      saved.scoreDataByOwner["user-1"].logs[0].strengthResult,
      "Offline squat survives",
    );
    assert.equal(
      calls.some(
        (call) => call.type === "upsert" && call.table === "workout_logs",
      ),
      true,
    );

    fireEvent.click(ui.getByRole("button", { name: "More" }));
    assert.ok(ui.getByText(/Remote sync is pending; retry from Account/));
    fireEvent.click(ui.getByRole("button", { name: "Retry account sync" }));
    assert.ok(
      await ui.findByText("Private athlete account synced to Supabase."),
    );
    assert.equal(
      calls.filter(
        (call) => call.type === "upsert" && call.table === "workout_logs",
      ).length,
      2,
    );
  } finally {
    console.warn = originalWarn;
    cleanup();
  }
});
