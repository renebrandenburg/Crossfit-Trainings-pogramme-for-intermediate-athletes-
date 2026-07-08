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

function mountApp({ prefersDark = false } = {}) {
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

  freshRequire("../app.js");
  dom.window.ForgeHour = global.ForgeHour;
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
