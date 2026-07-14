"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

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

function createMockSupabase({ session = null, remote = {}, calls = [] } = {}) {
  const data = {
    workout_logs: remote.workout_logs || [],
    pr_attempts: remote.pr_attempts || [],
    personal_records: remote.personal_records || [],
  };

  function ok(value) {
    return Promise.resolve({ data: value, error: null });
  }

  const client = {
    auth: {
      getSession: () => ok({ session }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
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
        if (table === "personal_records") return ok(data[table]);
        return {
          order: () => ok(data[table]),
        };
      },
      upsert: (payload) => {
        calls.push({ type: "upsert", table, payload });
        return ok(payload);
      },
      delete: () => ({
        neq: (column, value) => {
          calls.push({ type: "delete", table, column, value });
          return ok([]);
        },
      }),
    }),
  };

  return {
    client,
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

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("forge-hour-state-v1"),
      );
      assert.equal(saved.profile.benchmarks.row1k, "");
      assert.equal(saved.profile.benchmarks.row2k, "");
      assert.equal(saved.profile.benchmarks.run5k, "");
      assert.ok(ui.getByText("Test needed: 1 km row"));
    });
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
    assert.equal(activePlan.sessions.length, 32);
    assert.equal(Object.hasOwn(saved, "customPlans"), false);
    assert.ok(
      activePlan.sessions.every(
        (session) => !session.addOns || Array.isArray(session.addOns),
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
      assert.ok(
        ["amrap", "emom", "forTime", "interval", "tabata", "rest"].includes(
          saved.logs[0].timerResult.mode,
        ),
      );
      assert.equal(saved.logs[0].timerResult.splits.length, 1);
      assert.match(saved.logs[0].wodScore, /splits/);
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
      { timeout: 4500 },
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
      assert.equal(saved.logs[0].competitionProof.recorded, true);
      assert.equal(saved.logs[0].competitionProof.overlayEmbedded, true);
      assert.equal(saved.logs[0].competitionProof.interrupted, false);
      assert.equal(saved.logs[0].competitionProof.temporaryStorage, "opfs");
      assert.ok(saved.logs[0].competitionProof.fileName.endsWith(".mp4"));
      assert.ok(saved.logs[0].competitionProof.exportedAt);
      assert.equal(saved.logs[0].dayTitle, "Open Test 1");
      assert.equal(saved.logs[0].timerResult.mode, "amrap");
      assert.equal(saved.logs[0].timerResult.plannedSeconds, 720);
      assert.equal(saved.logs[0].timerResult.status, "completed");
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
      assert.equal(saved.logs[0].competitionProof.interrupted, true);
      assert.match(
        saved.logs[0].competitionProof.interruptions[0].reason,
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
      reloaded.plans[0].sessions[0].wod[0],
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

test("React Testing Library regenerates the active plan without duplicating it", async () => {
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
    assert.equal(after.plans[0].sessions.length, 32);
    assert.equal(
      after.plans[0].sessions.some(
        (session) => session.id === "saved-session-1",
      ),
      false,
    );
    assert.notEqual(
      after.plans[0].sessions[0].wod[0],
      before.plans[0].sessions[0].wod[0],
    );

    fireEvent.click(ui.getByRole("button", { name: "Plan" }));
    const firstSession = after.plans[0].sessions.find(
      (session) => session.week === 1,
    );
    assert.ok(view("programView").getByText(firstSession.wod[0]));
    fireEvent.click(ui.getByRole("button", { name: "Build" }));
    assert.ok(view("builderView").getByText(firstSession.wod[0]));
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
    assert.equal(saved.logs[0].id, "historical-log");
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
    assert.ok(ui.getByText("Sign in to sync logs and PRs."));
    assert.ok(ui.getByRole("button", { name: "Email sign-in link" }));
  } finally {
    cleanup();
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
    assert.ok(await ui.findByText("Scores are syncing with Supabase."));
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
    assert.ok(await ui.findByText("Scores are syncing with Supabase."));
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
