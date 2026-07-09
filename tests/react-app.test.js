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
      listeners.forEach((listener) => listener({ matches: nextMatches, media: query }));
    }
  });
}

function createMockSupabase({ session = null, remote = {}, calls = [] } = {}) {
  const data = {
    workout_logs: remote.workout_logs || [],
    pr_attempts: remote.pr_attempts || [],
    personal_records: remote.personal_records || []
  };

  function ok(value) {
    return Promise.resolve({ data: value, error: null });
  }

  const client = {
    auth: {
      getSession: () => ok({ session }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      signInWithOtp: (payload) => {
        calls.push({ type: "signInWithOtp", payload });
        return ok({});
      },
      signOut: () => {
        calls.push({ type: "signOut" });
        return ok({});
      }
    },
    from: (table) => ({
      select: () => {
        if (table === "personal_records") return ok(data[table]);
        return {
          order: () => ok(data[table])
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
        }
      })
    })
  };

  return {
    client,
    supabase: {
      createClient: () => client
    }
  };
}

function mountApp({ prefersDark = false, supabaseMock = null, supabaseConfig = true } = {}) {
  const dom = new JSDOM("<!doctype html><html><head><meta name=\"theme-color\" content=\"#10120f\"></head><body><div id=\"root\"></div></body></html>", {
    pretendToBeVisual: true,
    url: "http://localhost/"
  });

  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: dom.window.navigator
  });
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.MutationObserver = dom.window.MutationObserver;
  global.FormData = dom.window.FormData;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

  dom.window.confirm = () => true;
  dom.window.scrollTo = () => undefined;
  dom.window.matchMedia = createMatchMedia(prefersDark);
  dom.window.React = require("react");
  dom.window.ReactDOM = require("react-dom/client");
  if (supabaseMock) {
    dom.window.supabase = supabaseMock.supabase;
    if (supabaseConfig) dom.window.ForgeHourSupabaseConfig = {
      url: "https://example.supabase.co",
      anonKey: "public-anon-key"
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
    }
  };
}

test("React Testing Library renders the dashboard and bottom navigation", async () => {
  const { cleanup, ui } = mountApp();

  try {
    assert.ok(await ui.findByRole("heading", { name: "Training dashboard" }));
    assert.ok(ui.getByRole("heading", { name: "Masters RX assessment" }));
    assert.ok(ui.getByRole("heading", { name: "RX readiness" }));
    assert.ok(ui.getAllByText("Men Masters 35-39").length >= 1);
    assert.ok(ui.getByLabelText("Deadlift 1RM"));
    assert.ok(ui.getByLabelText("Unbroken ring muscle-ups"));
    assert.ok(ui.getByText("Sessions logged"));
    assert.ok(ui.getByRole("button", { name: "Home" }));
    assert.ok(ui.getByRole("button", { name: "Plan" }));
    assert.ok(ui.getByRole("button", { name: "Build" }));
    assert.ok(ui.getByRole("button", { name: "Learn" }));
    assert.ok(ui.getByRole("button", { name: "Log" }));
    assert.ok(ui.getByRole("button", { name: "PRs" }));
  } finally {
    cleanup();
  }
});

test("React Testing Library keeps cleared time benchmarks as test-needed values", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    assert.ok(await ui.findByRole("heading", { name: "Masters RX assessment" }));

    fireEvent.change(ui.getByLabelText("1 km row"), { target: { value: " " } });
    fireEvent.change(ui.getByLabelText("2 km row"), { target: { value: " " } });
    fireEvent.change(ui.getByLabelText("5 km run"), { target: { value: " " } });
    fireEvent.click(ui.getByRole("button", { name: "Save assessment" }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem("forge-hour-state-v1"));
      assert.equal(saved.profile.benchmarks.row1k, "");
      assert.equal(saved.profile.benchmarks.row2k, "");
      assert.equal(saved.profile.benchmarks.run5k, "");
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
      target: { value: "mastersRxOpen" }
    });
    fireEvent.click(ui.getByRole("button", { name: "Generate 8-week programme" }));

    await waitFor(() => assert.ok(ui.getAllByRole("heading", { name: /Squat \+ TTB capacity/ }).length >= 8));
    assert.ok(ui.getAllByText("Optional add-ons").length > 0);
    assert.ok(ui.getAllByText(/Men Masters 35-39 RX prep/).length > 0);

    const saved = JSON.parse(window.localStorage.getItem("forge-hour-state-v1"));
    assert.equal(saved.customPlans.filter((plan) => plan.sourceGoal === "mastersRxOpen").length, 32);
    assert.ok(saved.customPlans.every((plan) => !plan.addOns || Array.isArray(plan.addOns)));
  } finally {
    cleanup();
  }
});

test("React Testing Library saves a manual training session", async () => {
  const { cleanup, fireEvent, ui, waitFor } = mountApp();

  try {
    fireEvent.click(await ui.findByRole("button", { name: "Build" }));
    assert.ok(await ui.findByRole("heading", { name: "Programme builder" }));

    fireEvent.change(ui.getByLabelText("Day or title"), {
      target: { value: "Friday engine + skill" }
    });
    fireEvent.change(ui.getByLabelText("Focus"), {
      target: { value: "Engine and pull-up volume" }
    });
    fireEvent.change(ui.getByLabelText("Warm-up"), {
      target: { value: "8 min easy bike\nDynamic shoulders" }
    });
    fireEvent.change(ui.getByLabelText("Strength or skill"), {
      target: { value: "EMOM 10: 2 strict pull-ups + 6 kip swings" }
    });
    fireEvent.change(ui.getByLabelText("WOD"), {
      target: { value: "AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees" }
    });

    fireEvent.click(ui.getByRole("button", { name: "Save training session" }));

    await waitFor(() => assert.ok(ui.getByRole("heading", { name: "Friday engine + skill" })));
    assert.ok(ui.getByText("Engine and pull-up volume"));
    assert.ok(ui.getByText("AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees"));
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
      target: { value: "Weightlifting" }
    });
    fireEvent.change(ui.getByPlaceholderText("Bar muscle-up, snatch, rope climb"), {
      target: { value: "snatch" }
    });

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

    await waitFor(() => assert.equal(document.documentElement.dataset.theme, "dark"));
    assert.equal(document.querySelector('meta[name="theme-color"]').getAttribute("content"), "#070907");

    const savedDarkState = JSON.parse(window.localStorage.getItem("forge-hour-state-v1"));
    assert.equal(savedDarkState.themePreference, "dark");

    fireEvent.change(themeSelect, { target: { value: "light" } });

    await waitFor(() => assert.equal(document.documentElement.dataset.theme, "light"));
    assert.equal(document.querySelector('meta[name="theme-color"]').getAttribute("content"), "#10120f");

    const savedLightState = JSON.parse(window.localStorage.getItem("forge-hour-state-v1"));
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
    await waitFor(() => assert.equal(document.documentElement.dataset.theme, "dark"));
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
      workout_logs: [{
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
        created_at: "2026-07-08T10:00:00.000Z"
      }],
      pr_attempts: [],
      personal_records: [{
        metric_id: "backSquat",
        value: 150,
        display: "150 kg",
        date: "2026-07-08",
        notes: "Remote PR"
      }]
    }
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
    calls
  });
  const { cleanup, fireEvent, ui, waitFor } = mountApp({ supabaseMock });

  try {
    assert.ok(await ui.findByText("Scores are syncing with Supabase."));
    fireEvent.click(ui.getByRole("button", { name: "Log" }));
    fireEvent.change(ui.getByLabelText("WOD score"), {
      target: { value: "4 rounds + 8 reps" }
    });
    fireEvent.click(ui.getByRole("button", { name: "Save workout log" }));

    await waitFor(() => {
      const insert = calls.find((call) => call.type === "upsert" && call.table === "workout_logs");
      assert.ok(insert);
      assert.equal(insert.payload.user_id, "user-1");
      assert.equal(insert.payload.wod_score, "4 rounds + 8 reps");
    });
  } finally {
    cleanup();
  }
});
