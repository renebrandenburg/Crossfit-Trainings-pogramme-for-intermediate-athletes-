"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { cloneDefaultProfile, workoutItemsForSession } = require("../app.js");

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
    workout_logs: remote.workout_logs || [],
    pr_attempts: remote.pr_attempts || [],
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
        if (table === "athlete_states") {
          let ownerId = null;
          const athleteBuilder = {
            eq: (_column, value) => {
              ownerId = String(value);
              return athleteBuilder;
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
          return athleteBuilder;
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
      return ok(
        typeof configured === "function"
          ? configured(payload)
          : configured === undefined
            ? null
            : configured,
      );
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
} = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><head><meta name="theme-color" content="#10120f"></head><body><div id="root"></div></body></html>',
    {
      pretendToBeVisual: true,
      url: "http://localhost/",
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
  dom.window.ReactDOM = require("react-dom/client");
  if (supabaseMock) {
    dom.window.supabase = supabaseMock.supabase;
    if (supabaseConfig)
      dom.window.ForgeHourSupabaseConfig = {
        url: "https://example.supabase.co",
        anonKey: "public-anon-key",
      };
  }

  freshRequire("../app.js");
  freshRequire("../supabase-sync.js");
  dom.window.ForgeHour = global.ForgeHour;
  if (apiOverrides) Object.assign(dom.window.ForgeHour, apiOverrides);
  dom.window.ForgeHourSync = global.ForgeHourSync;
  freshRequire("../react-app.js");

  const testingLibrary = require("@testing-library/react");
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

  fireEvent.click(ui.getByRole("button", { name: "Plan" }));
  const programView = view("programView");
  assert.ok(programView.getByRole("heading", { name: plan.title }));
  assert.equal(
    programView.getByLabelText("Programme week").value,
    String(session.week),
  );
  assert.ok(programView.getByText(sessionWod(session)));

  fireEvent.click(ui.getByRole("button", { name: "Build" }));
  const builderView = view("builderView");
  assert.equal(builderView.getByLabelText("Active plan").value, plan.id);
  assert.ok(builderView.getByText(sessionWod(session)));

  fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
  const { cleanup, ui } = mountApp();

  try {
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
    assert.ok(ui.getByRole("heading", { name: "Masters RX assessment" }));
    assert.ok(ui.getByRole("heading", { name: "RX readiness" }));
    assert.ok(ui.getByText("RX Level"));
    assert.ok(ui.getByText("Strict press: 60 kg vs 75 kg."));
    assert.ok(ui.getAllByText("Men Masters 35-39").length >= 1);
    assert.ok(ui.getByLabelText("Deadlift 1RM"));
    assert.ok(ui.getByLabelText("Unbroken ring muscle-ups"));
    assert.ok(ui.getByText("Sessions logged"));
    assert.ok(ui.getByRole("button", { name: "Home" }));
    assert.ok(ui.getByRole("button", { name: "Plan" }));
    assert.ok(ui.getByRole("button", { name: "Build" }));
    assert.ok(ui.getByRole("button", { name: "Learn" }));
    assert.ok(ui.getByRole("button", { name: "Proof" }));
    assert.ok(ui.getByRole("button", { name: "Log" }));
    assert.ok(ui.getByRole("button", { name: "PRs" }));
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

test("React Testing Library keeps cleared time benchmarks as test-needed values", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    assert.ok(
      await ui.findByRole("heading", { name: "Masters RX assessment" }),
    );

    fireEvent.change(ui.getByLabelText("1 km row"), { target: { value: " " } });
    fireEvent.change(ui.getByLabelText("2 km row"), { target: { value: " " } });
    fireEvent.change(ui.getByLabelText("5 km run"), { target: { value: " " } });
    fireEvent.click(ui.getByRole("button", { name: "Save assessment" }));

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

test("React Testing Library generates a level-aware bar muscle-up programme", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
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
      ui.getByRole("button", { name: "Generate 8-week programme" }),
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
    assert.deepEqual(activePlan.generatorOptions, {
      goal: "barMuscleUp",
      daysPerWeek: 4,
      weakness: "muscleup",
      duration: 60,
      athleteLevel: "rxPlus",
      barMuscleUpLevel: "assisted",
    });
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

test("React Testing Library generates a Masters 35-39 RX Open prep programme", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
    assert.ok(await ui.findByRole("heading", { name: "Programme builder" }));

    fireEvent.change(ui.getByLabelText("Main goal"), {
      target: { value: "mastersRxOpen" },
    });
    fireEvent.change(ui.getByLabelText("Biggest weakness"), {
      target: { value: "runningBodyweight" },
    });
    fireEvent.click(
      ui.getByRole("button", { name: "Generate 8-week programme" }),
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
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
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
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
    fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
    fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
    fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
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

    fireEvent.click(ui.getByRole("button", { name: "Plan" }));
    const planView = view("programView");
    assert.match(document.querySelector("#programView").className, /is-active/);
    assert.ok(planView.getByRole("heading", { name: "Friday engine + skill" }));
    assert.ok(
      planView.getByText("AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees"),
    );
  } finally {
    cleanup();
  }
});

test("React Testing Library reloads the canonical active plan without regenerating it", async () => {
  const first = mountApp({ storedState: canonicalPlanState() });
  let serialized;

  try {
    assert.ok(
      await first.ui.findByRole("heading", { name: "Training dashboard" }),
    );
    serialized = JSON.stringify(first.readState());
    assert.equal(first.readState().plans[0].sessions[0].id, "saved-session-1");
  } finally {
    first.cleanup();
  }

  const second = mountApp({ storedState: serialized });
  try {
    assert.ok(
      await second.ui.findByRole("heading", { name: "Training dashboard" }),
    );
    const reloaded = second.readState();
    assert.equal(reloaded.activePlanId, "saved-plan-1");
    assert.equal(reloaded.plans[0].sessions[0].id, "saved-session-1");
    assert.equal(
      sessionWod(reloaded.plans[0].sessions[0]),
      "AMRAP 12: row, burpees, and pull-ups",
    );

    second.fireEvent.click(second.ui.getByRole("button", { name: "Plan" }));
    assert.ok(
      second
        .view("programView")
        .getByText("AMRAP 12: row, burpees, and pull-ups"),
    );
    second.fireEvent.click(second.ui.getByRole("button", { name: "Build" }));
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
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
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

    fireEvent.click(ui.getByRole("button", { name: "Plan" }));
    assert.ok(
      view("programView").getByRole("heading", {
        name: "Renamed canonical programme",
      }),
    );
    assert.ok(
      view("programView").getByText(
        "For time: run, thrusters, and chest-to-bar",
      ),
    );

    fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
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

    fireEvent.click(ui.getByRole("button", { name: "Plan" }));
    const firstSession = after.plans[0].sessions.find(
      (session) => session.week === 1,
    );
    assert.ok(view("programView").getByText(sessionWod(firstSession)));
    fireEvent.click(ui.getByRole("button", { name: "Build" }));
    assert.ok(view("builderView").getByText(sessionWod(firstSession)));
    fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    await reloaded.ui.findByRole("heading", { name: "Training dashboard" });
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
    await mounted.ui.findByRole("heading", { name: "Training dashboard" });
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    await reloaded.ui.findByRole("heading", { name: "Training dashboard" });
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    await reloaded.ui.findByRole("heading", { name: "Training dashboard" });
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "Plan" }));
    assert.equal(document.querySelector("#programWeek").value, "4");
    assert.ok(
      mounted
        .view("programView")
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "Build" }),
    );
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
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
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
    assert.match(document.querySelector("#programView").className, /is-active/);
    assert.ok(view("programView").getByRole("heading", { name: "Programme" }));

    fireEvent.click(ui.getByRole("button", { name: "Proof" }));
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
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
    const saved = readState();
    assert.equal(Object.hasOwn(saved, "customPlans"), false);
    assert.equal(saved.plans[0].sessions[0].id, "legacy-session");
    fireEvent.click(ui.getByRole("button", { name: "Plan" }));
    assert.ok(view("programView").getByText("AMRAP 10: legacy workout"));
    fireEvent.click(ui.getByRole("button", { name: "Build" }));
    assert.ok(view("builderView").getByText("AMRAP 10: legacy workout"));
  } finally {
    cleanup();
  }
});

test("React Testing Library filters the movement library", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    fireEvent.click(await ui.findByRole("button", { name: "Learn" }));
    assert.ok(await ui.findByRole("heading", { name: "Learn the skills" }));

    fireEvent.change(ui.getByLabelText("Movement category"), {
      target: { value: "Weightlifting" },
    });
    fireEvent.change(
      ui.getByPlaceholderText("Bar muscle-up, snatch, rope climb"),
      {
        target: { value: "snatch" },
      },
    );

    await waitFor(() => assert.ok(ui.getByRole("heading", { name: "Snatch" })));
    assert.equal(ui.queryByRole("heading", { name: "Bar muscle-up" }), null);
  } finally {
    cleanup();
  }
});

test("React Testing Library rejects zero and negative PR attempts before saving", async () => {
  const mounted = mountApp();

  try {
    mounted.fireEvent.click(
      await mounted.ui.findByRole("button", { name: "PRs" }),
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
  const { cleanup, fireEvent, ui, waitFor } = mountApp({ prefersDark: false });

  try {
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
  const { cleanup, ui, waitFor } = mountApp({ prefersDark: true });

  try {
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
  const { cleanup, ui } = mountApp();

  try {
    assert.ok(await ui.findByRole("heading", { name: "Database sync" }));
    assert.ok(ui.getAllByText(/Supabase SDK could not load/).length >= 1);
  } finally {
    cleanup();
  }
});

test("React Testing Library uses bundled Supabase config if the config file is cached or missing", async () => {
  const supabaseMock = createMockSupabase();
  const { cleanup, ui } = mountApp({ supabaseMock, supabaseConfig: false });

  try {
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
      assert.equal(mounted.readState().schemaVersion, 4);
    });
    const saved = mounted.readState();
    assert.equal(saved.schemaVersion, 4);
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
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
  const { cleanup, fireEvent, ui } = mountApp({ supabaseMock });

  try {
    assert.ok(
      await ui.findByText("Profile, programmes, logs, and PRs are syncing."),
    );
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/Remote squat/));
    fireEvent.click(ui.getByRole("button", { name: "PRs" }));
    assert.ok(await ui.findByText("150 kg"));
  } finally {
    cleanup();
  }
});

test("React Testing Library saves workout logs through Supabase when signed in", async () => {
  const calls = [];
  const supabaseMock = createMockSupabase({
    session: { user: { id: "user-1", email: "athlete@example.com" } },
    calls,
  });
  const { cleanup, fireEvent, ui, waitFor } = mountApp({ supabaseMock });

  try {
    assert.ok(
      await ui.findByText("Profile, programmes, logs, and PRs are syncing."),
    );
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
    mounted.fireEvent.click(
      mounted.ui.getByRole("button", { name: "Retry account sync" }),
    );
    assert.ok(
      await mounted.ui.findByText(
        "Account synced. Timer or competition-proof metadata stays local until the Supabase schema is updated.",
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
    assert.ok(
      await ui.findByText("Profile, programmes, logs, and PRs are syncing."),
    );
    assert.equal(calls.filter((call) => call.type === "select").length, 4);
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/Account-only squat/));
    assert.equal(ui.queryByText(/Guest-only squat/), null);

    fireEvent.click(ui.getByRole("button", { name: "Home" }));
    assert.ok(ui.getByRole("button", { name: /Import guest data \(/ }));
    fireEvent.click(ui.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      assert.ok(ui.getByText(/Signed out\. Local cache remains/));
    });
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    assert.ok(await ui.findByText(/Guest-only squat/));
    assert.equal(ui.queryByText(/Account-only squat/), null);

    const saved = readState();
    assert.equal(saved.schemaVersion, 4);
    assert.equal(saved.planSchemaVersion, 3);
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
  const { cleanup, fireEvent, ui } = mountApp({
    storedState,
    supabaseMock,
  });

  try {
    assert.ok(
      await ui.findByText("Profile, programmes, logs, and PRs are syncing."),
    );
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
  const { cleanup, fireEvent, ui } = mountApp({
    storedState,
    supabaseMock,
  });

  try {
    assert.ok(
      await ui.findByText("Profile, programmes, logs, and PRs are syncing."),
    );
    fireEvent.click(ui.getByRole("button", { name: "PRs" }));
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "PRs" }));
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "PRs" }));
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
    mounted.fireEvent.click(mounted.ui.getByRole("button", { name: "PRs" }));
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );
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
    assert.ok(
      await mounted.ui.findByText(
        "Could not load your private athlete account.",
      ),
    );
    assert.equal(
      calls.some(
        (call) =>
          call.type === "rpc" ||
          (call.type === "upsert" && call.table !== "athlete_states"),
      ),
      false,
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
    assert.ok(
      await mounted.ui.findByText(
        "Profile, programmes, logs, and PRs are syncing.",
      ),
    );

    initialSession.resolve({
      data: {
        session: { user: { id: "user-1", email: "one@example.com" } },
      },
      error: null,
    });
    await mounted.waitFor(() =>
      assert.equal(mounted.readState().activeScoreOwner, "user-2"),
    );
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
  const { cleanup, fireEvent, readState, ui, waitFor } = mountApp({
    supabaseMock,
  });

  try {
    assert.ok(
      await ui.findByText("Profile, programmes, logs, and PRs are syncing."),
    );
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    fireEvent.change(ui.getByLabelText("Strength or skill result"), {
      target: { value: "Offline squat survives" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    assert.ok(await ui.findByText(/Offline squat survives/));
    await waitFor(() => {
      assert.ok(ui.getByText(/Remote sync is pending; retry from Account/));
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

    fireEvent.click(ui.getByRole("button", { name: "Home" }));
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
