"use strict";

const STORAGE_KEY = "forge-hour-state-v1";

const DEFAULT_PROFILE = {
  athleteName: "Intermediate athlete",
  maxes: {
    backSquat: 145,
    frontSquat: 125,
    snatch: 75,
    cleanJerk: 100
  },
  benchmarks: {
    row1k: "3:30",
    murph: "68:00",
    t2b: 8,
    pullUps: 10,
    chestToBar: 5,
    barMuscleUp: 0
  }
};

const WEEK_META = [
  {
    week: 1,
    title: "Week 1 - technical base",
    note: "Comfortably heavy. Keep reps crisp, preserve the intended stimulus, and learn your starting paces."
  },
  {
    week: 2,
    title: "Week 2 - volume build",
    note: "Small overload through load, total reps, or meters. Add work only when positions stay clean."
  },
  {
    week: 3,
    title: "Week 3 - intensity peak",
    note: "Heaviest week. Strength volume drops slightly while top percentages rise."
  },
  {
    week: 4,
    title: "Week 4 - deload and control",
    note: "Lower fatigue, more skill quality, and a simple 1 km row check-in."
  }
];

const PR_METRICS = [
  { id: "backSquat", name: "Back squat", unit: "kg", type: "number", direction: "higher", seed: "maxes.backSquat" },
  { id: "frontSquat", name: "Front squat", unit: "kg", type: "number", direction: "higher", seed: "maxes.frontSquat" },
  { id: "snatch", name: "Snatch", unit: "kg", type: "number", direction: "higher", seed: "maxes.snatch" },
  { id: "cleanJerk", name: "Clean and jerk", unit: "kg", type: "number", direction: "higher", seed: "maxes.cleanJerk" },
  { id: "row1k", name: "1 km row", unit: "time", type: "time", direction: "lower", seed: "benchmarks.row1k" },
  { id: "murph", name: "Murph", unit: "time", type: "time", direction: "lower", seed: "benchmarks.murph" },
  { id: "t2b", name: "Unbroken toes-to-bar", unit: "reps", type: "number", direction: "higher", seed: "benchmarks.t2b" },
  { id: "pullUps", name: "Unbroken pull-ups", unit: "reps", type: "number", direction: "higher", seed: "benchmarks.pullUps" },
  { id: "chestToBar", name: "Unbroken chest-to-bar", unit: "reps", type: "number", direction: "higher", seed: "benchmarks.chestToBar" },
  { id: "barMuscleUp", name: "Bar muscle-up", unit: "reps", type: "number", direction: "higher", seed: "benchmarks.barMuscleUp" }
];

const READINESS_LABELS = {
  green: "Green",
  amber: "Amber",
  red: "Red"
};

const state = loadState();

const elements = {
  views: Array.from(document.querySelectorAll(".view")),
  navButtons: Array.from(document.querySelectorAll(".nav-button")),
  dashboardWeek: document.querySelector("#dashboardWeek"),
  programWeek: document.querySelector("#programWeek"),
  logWeek: document.querySelector("#logWeek"),
  logDay: document.querySelector("#logDay"),
  statsGrid: document.querySelector("#statsGrid"),
  nextSession: document.querySelector("#nextSession"),
  programList: document.querySelector("#programList"),
  weekNote: document.querySelector("#weekNote"),
  profileForm: document.querySelector("#profileForm"),
  logForm: document.querySelector("#logForm"),
  prForm: document.querySelector("#prForm"),
  recentLogs: document.querySelector("#recentLogs"),
  prGrid: document.querySelector("#prGrid"),
  prMetric: document.querySelector("#prMetric"),
  prHistory: document.querySelector("#prHistory"),
  clearLogs: document.querySelector("#clearLogs"),
  resetDemoData: document.querySelector("#resetDemoData"),
  toast: document.querySelector("#toast")
};

init();

function init() {
  seedPrs();
  populateStaticSelects();
  bindEvents();
  setDefaultDates();
  renderAll();
  registerServiceWorker();
}

function loadState() {
  const fallback = {
    profile: cloneDefaultProfile(),
    logs: [],
    prs: {},
    prAttempts: [],
    selectedWeek: 1
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      profile: {
        ...fallback.profile,
        ...(parsed.profile || {}),
        maxes: {
          ...fallback.profile.maxes,
          ...((parsed.profile && parsed.profile.maxes) || {})
        },
        benchmarks: {
          ...fallback.profile.benchmarks,
          ...((parsed.profile && parsed.profile.benchmarks) || {})
        }
      }
    };
  } catch (error) {
    console.warn("Could not read saved state.", error);
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cloneDefaultProfile() {
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedPrs() {
  PR_METRICS.forEach((metric) => {
    if (state.prs[metric.id]) return;
    const rawValue = valueFromPath(state.profile, metric.seed);
    const value = normalizePrValue(rawValue, metric);
    state.prs[metric.id] = {
      metricId: metric.id,
      value,
      display: formatPrValue(value, metric),
      date: "Baseline",
      notes: "Seeded from initial research numbers."
    };
  });
  saveState();
}

function syncBaselinePrsFromProfile() {
  PR_METRICS.forEach((metric) => {
    const current = state.prs[metric.id];
    const hasAttempts = state.prAttempts.some((attempt) => attempt.metricId === metric.id);
    if (!current || current.date !== "Baseline" || hasAttempts) return;
    const rawValue = valueFromPath(state.profile, metric.seed);
    const value = normalizePrValue(rawValue, metric);
    state.prs[metric.id] = {
      ...current,
      value,
      display: formatPrValue(value, metric)
    };
  });
}

function populateStaticSelects() {
  const weekOptions = WEEK_META.map((week) => `<option value="${week.week}">Week ${week.week}</option>`).join("");
  [elements.dashboardWeek, elements.programWeek, elements.logWeek].forEach((select) => {
    select.innerHTML = weekOptions;
    select.value = String(state.selectedWeek);
  });

  elements.logDay.innerHTML = getProgramDays().map((day) => {
    return `<option value="${day.id}">${day.weekday} - ${day.shortTitle}</option>`;
  }).join("");

  elements.prMetric.innerHTML = PR_METRICS.map((metric) => {
    return `<option value="${metric.id}">${metric.name}</option>`;
  }).join("");
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.view));
  });

  [elements.dashboardWeek, elements.programWeek, elements.logWeek].forEach((select) => {
    select.addEventListener("change", () => {
      state.selectedWeek = Number(select.value);
      saveState();
      syncWeekSelects();
      renderAll();
    });
  });

  elements.profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.profileForm);
    state.profile.athleteName = String(data.get("athleteName") || "Intermediate athlete").trim();
    state.profile.maxes.backSquat = positiveNumber(data.get("backSquatMax"), state.profile.maxes.backSquat);
    state.profile.maxes.frontSquat = positiveNumber(data.get("frontSquatMax"), state.profile.maxes.frontSquat);
    state.profile.maxes.snatch = positiveNumber(data.get("snatchMax"), state.profile.maxes.snatch);
    state.profile.maxes.cleanJerk = positiveNumber(data.get("cleanJerkMax"), state.profile.maxes.cleanJerk);
    syncBaselinePrsFromProfile();
    saveState();
    renderAll();
    showToast("Training maxes saved.");
  });

  elements.logForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.logForm);
    const day = getProgramDays().find((item) => item.id === data.get("logDay"));
    const log = {
      id: createId(),
      date: String(data.get("logDate")),
      week: Number(data.get("logWeek")),
      dayId: day.id,
      dayTitle: day.shortTitle,
      readiness: String(data.get("readiness")),
      rpe: String(data.get("rpe") || "").trim(),
      strengthResult: String(data.get("strengthResult") || "").trim(),
      wodScore: String(data.get("wodScore") || "").trim(),
      notes: String(data.get("logNotes") || "").trim(),
      mobilityDone: Boolean(data.get("mobilityDone")),
      createdAt: new Date().toISOString()
    };
    state.logs.unshift(log);
    saveState();
    elements.logForm.reset();
    setDefaultDates();
    renderAll();
    showToast("Workout log saved.");
  });

  elements.prForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.prForm);
    const metric = PR_METRICS.find((item) => item.id === data.get("prMetric"));
    const normalized = normalizePrValue(String(data.get("prValue") || ""), metric);

    if (!Number.isFinite(normalized)) {
      showToast(metric.type === "time" ? "Use time like 3:30 or 14:36." : "Enter a valid number.");
      return;
    }

    const current = state.prs[metric.id];
    const isPr = !current || isBetterPr(normalized, current.value, metric);
    const attempt = {
      id: createId(),
      metricId: metric.id,
      metricName: metric.name,
      value: normalized,
      display: formatPrValue(normalized, metric),
      date: String(data.get("prDate")),
      notes: String(data.get("prNotes") || "").trim(),
      isPr,
      createdAt: new Date().toISOString()
    };

    state.prAttempts.unshift(attempt);
    if (isPr) {
      state.prs[metric.id] = {
        metricId: metric.id,
        value: normalized,
        display: attempt.display,
        date: attempt.date,
        notes: attempt.notes
      };
    }

    saveState();
    elements.prForm.reset();
    setDefaultDates();
    renderAll();
    showToast(isPr ? "New PR saved." : "Attempt saved.");
  });

  elements.clearLogs.addEventListener("click", () => {
    if (!state.logs.length) return;
    const confirmed = window.confirm("Clear all workout logs on this device?");
    if (!confirmed) return;
    state.logs = [];
    saveState();
    renderAll();
    showToast("Workout logs cleared.");
  });

  elements.resetDemoData.addEventListener("click", () => {
    const confirmed = window.confirm("Reset profile, logs, and PRs on this device?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelector("#logDate").value = today;
  document.querySelector("#prDate").value = today;
  elements.logWeek.value = String(state.selectedWeek);
}

function activateView(viewId) {
  elements.views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  elements.navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.view === viewId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  syncWeekSelects();
  renderProfile();
  renderDashboard();
  renderProgramme();
  renderLogs();
  renderPrs();
}

function syncWeekSelects() {
  [elements.dashboardWeek, elements.programWeek, elements.logWeek].forEach((select) => {
    select.value = String(state.selectedWeek);
  });
}

function renderProfile() {
  document.querySelector("#athleteName").value = state.profile.athleteName;
  document.querySelector("#backSquatMax").value = state.profile.maxes.backSquat;
  document.querySelector("#frontSquatMax").value = state.profile.maxes.frontSquat;
  document.querySelector("#snatchMax").value = state.profile.maxes.snatch;
  document.querySelector("#cleanJerkMax").value = state.profile.maxes.cleanJerk;
}

function renderDashboard() {
  const logsThisWeek = state.logs.filter((log) => log.week === state.selectedWeek);
  const completedDays = new Set(logsThisWeek.map((log) => log.dayId)).size;
  const latestRpe = state.logs.find((log) => log.rpe);
  const latestPr = state.prAttempts.find((attempt) => attempt.isPr);
  const weekPercent = Math.round((completedDays / 4) * 100);

  elements.statsGrid.innerHTML = [
    statCard(`${completedDays}/4`, "Sessions logged"),
    statCard(`${weekPercent}%`, "Week complete"),
    statCard(latestRpe ? latestRpe.rpe : "-", "Latest RPE"),
    statCard(latestPr ? latestPr.metricName : "-", "Latest PR")
  ].join("");

  const nextDay = getNextDayForToday();
  const session = buildSession(nextDay.id, state.selectedWeek, state.profile);
  elements.nextSession.innerHTML = `
    <section class="panel">
      <div class="session-topline">
        <div>
          <p class="eyebrow">Next up</p>
          <h3>${escapeHtml(session.weekday)} - ${escapeHtml(session.shortTitle)}</h3>
        </div>
        <span class="metric-pill">60 min</span>
      </div>
      <p class="muted-copy">${escapeHtml(session.focus)}</p>
      <div class="completion-bar" aria-label="Week completion"><span style="width:${weekPercent}%"></span></div>
      <div class="quick-actions">
        <button class="primary-button" type="button" data-jump-log="${session.id}">Log this</button>
        <button class="ghost-button" type="button" data-jump-plan="${session.id}">View plan</button>
      </div>
    </section>
  `;

  elements.nextSession.querySelector("[data-jump-log]").addEventListener("click", (event) => {
    elements.logDay.value = event.currentTarget.dataset.jumpLog;
    activateView("logView");
  });
  elements.nextSession.querySelector("[data-jump-plan]").addEventListener("click", () => {
    activateView("programView");
  });
}

function renderProgramme() {
  const week = WEEK_META.find((item) => item.week === state.selectedWeek);
  elements.weekNote.innerHTML = `
    <p><strong>${escapeHtml(week.title)}.</strong> ${escapeHtml(week.note)}</p>
  `;

  elements.programList.innerHTML = getProgramDays().map((day) => {
    const session = buildSession(day.id, state.selectedWeek, state.profile);
    const logged = state.logs.some((log) => log.week === state.selectedWeek && log.dayId === day.id);
    return `
      <article class="day-card" id="${session.id}">
        <div class="day-card-header">
          <div>
            <p>${escapeHtml(session.weekday)}</p>
            <h3>${escapeHtml(session.shortTitle)}</h3>
          </div>
          <span class="tag">${logged ? "Logged" : "60 min"}</span>
        </div>
        <div class="day-card-body">
          <p class="muted-copy">${escapeHtml(session.focus)}</p>
          ${session.segments.map(renderSegment).join("")}
          <div class="quick-actions">
            <button class="primary-button" type="button" data-log-day="${session.id}">Log session</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  elements.programList.querySelectorAll("[data-log-day]").forEach((button) => {
    button.addEventListener("click", (event) => {
      elements.logDay.value = event.currentTarget.dataset.logDay;
      elements.logWeek.value = String(state.selectedWeek);
      activateView("logView");
    });
  });
}

function renderSegment(segment) {
  return `
    <section class="segment">
      <h4>
        <span>${escapeHtml(segment.title)}</span>
        <span class="metric-pill">${escapeHtml(segment.minutes)} min</span>
      </h4>
      <ul>
        ${segment.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderLogs() {
  if (!state.logs.length) {
    elements.recentLogs.innerHTML = `<div class="empty-state">No workout logs yet. Save your first session after training.</div>`;
    return;
  }

  elements.recentLogs.innerHTML = state.logs.slice(0, 12).map((log) => {
    return `
      <article class="history-item">
        <h4>${escapeHtml(formatDate(log.date))} - Week ${log.week}, ${escapeHtml(log.dayTitle)}</h4>
        <p>${escapeHtml(log.wodScore || "No WOD score")} ${log.strengthResult ? "- " + escapeHtml(log.strengthResult) : ""}</p>
        ${log.notes ? `<p>${escapeHtml(log.notes)}</p>` : ""}
        <div class="history-meta">
          <span class="metric-pill readiness-${escapeHtml(log.readiness)}">${escapeHtml(READINESS_LABELS[log.readiness] || log.readiness)}</span>
          ${log.rpe ? `<span class="metric-pill">RPE ${escapeHtml(log.rpe)}</span>` : ""}
          ${log.mobilityDone ? `<span class="metric-pill">Mobility done</span>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderPrs() {
  elements.prGrid.innerHTML = PR_METRICS.map((metric) => {
    const pr = state.prs[metric.id];
    return `
      <article class="pr-card">
        <p class="pr-label">${escapeHtml(metric.name)}</p>
        <p class="pr-value">${escapeHtml(pr ? pr.display : "-")}</p>
        <p class="stat-label">${escapeHtml(pr ? pr.date : "No PR yet")}</p>
      </article>
    `;
  }).join("");

  if (!state.prAttempts.length) {
    elements.prHistory.innerHTML = `<div class="empty-state">No PR attempts yet. Baselines are loaded, and attempts you log will appear here.</div>`;
    return;
  }

  elements.prHistory.innerHTML = state.prAttempts.slice(0, 12).map((attempt) => {
    return `
      <article class="history-item">
        <h4>${attempt.isPr ? "PR" : "Attempt"} - ${escapeHtml(attempt.metricName)} ${escapeHtml(attempt.display)}</h4>
        <p>${escapeHtml(formatDate(attempt.date))}${attempt.notes ? " - " + escapeHtml(attempt.notes) : ""}</p>
      </article>
    `;
  }).join("");
}

function statCard(value, label) {
  return `
    <article class="stat-card">
      <p class="stat-label">${escapeHtml(label)}</p>
      <p class="stat-value">${escapeHtml(value)}</p>
    </article>
  `;
}

function getProgramDays() {
  return [
    {
      id: "day1",
      weekday: "Monday",
      shortTitle: "Back squat + T2B",
      focus: "Squat strength, submaximal gymnastics, and a short mixed row metcon."
    },
    {
      id: "day2",
      weekday: "Tuesday",
      shortTitle: "Snatch + row intervals",
      focus: "Olympic lifting technique before high-output rowing intervals."
    },
    {
      id: "day3",
      weekday: "Thursday",
      shortTitle: "Clean and jerk + front squat",
      focus: "Clean and jerk practice, front squat strength, and run-pull conditioning."
    },
    {
      id: "day4",
      weekday: "Saturday",
      shortTitle: "Muscle-up skill + long metcon",
      focus: "Upper-body skill progression, heavy pulls, and steady work capacity."
    }
  ];
}

function buildSession(dayId, weekNumber, profile) {
  const base = getProgramDays().find((day) => day.id === dayId);
  const builders = {
    day1: buildDayOne,
    day2: buildDayTwo,
    day3: buildDayThree,
    day4: buildDayFour
  };
  return {
    ...base,
    segments: builders[dayId](weekNumber, profile)
  };
}

function buildDayOne(week, profile) {
  const squat = {
    1: ["5x4", 0.75],
    2: ["5x4", 0.8],
    3: ["6x3", 0.85],
    4: ["3x4", 0.65]
  }[week];
  const t2b = { 1: 6, 2: 7, 3: 8, 4: 5 }[week];
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: ["3 min easy row", "Dynamic hips and ankles", "2x10 air squats", "2x10 kip swings"]
    },
    {
      title: "Strength and skill",
      minutes: "28",
      items: [
        `Back squat ${squat[0]} at ${percent(squat[1])} (${kg(profile.maxes.backSquat, squat[1])}), rest 2:00`,
        `EMOM 8: ${t2b} toes-to-bar each minute (${t2b * 8} total), stop 1-2 reps before failure`
      ]
    },
    {
      title: "WOD",
      minutes: "12",
      items: [
        `AMRAP 12: 8 power cleans at ${kg(profile.maxes.cleanJerk, 0.6)}, 10 box jump overs, 250 m row`,
        "Target RPE 8 with consistent rounds"
      ]
    },
    {
      title: "Accessory and mobility",
      minutes: "12",
      items: [
        "3 rounds: 10 DB single-leg RDL per leg + 20-30 sec hollow hold",
        "Ankle dorsiflexion, hip flexor stretch, and 60 sec hang"
      ]
    }
  ];
}

function buildDayTwo(week, profile) {
  const complexPct = { 1: 0.65, 2: 0.7, 3: 0.75, 4: 0.6 }[week];
  const singlePct = { 1: 0.8, 2: 0.825, 3: 0.85, 4: 0.75 }[week];
  const row = {
    1: "5x500 m, rest 1:00, target 1:50-1:55/500 m",
    2: "5x600 m, rest 1:00, keep splits controlled",
    3: "4x750 m, rest 1:30, strong but repeatable",
    4: "1,000 m time trial after technique work"
  }[week];
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: ["Light cardio", "Shoulder and T-spine prep", "PVC and empty-bar snatch drills"]
    },
    {
      title: "Snatch work",
      minutes: "20",
      items: [
        `Snatch complex 5x(1 hang power + 1 power + 1 OHS) at ${percent(complexPct)} (${kg(profile.maxes.snatch, complexPct)})`,
        `Then 5-6 smooth singles up to ${percent(singlePct)} (${kg(profile.maxes.snatch, singlePct)})`
      ]
    },
    {
      title: "Engine",
      minutes: "15",
      items: [row, "Score the slowest split, not the fastest one"]
    },
    {
      title: "Accessory and mobility",
      minutes: "17",
      items: ["3x12 banded face pulls", "3x10-12 external rotations", "Lat, pec, and thoracic extension work"]
    }
  ];
}

function buildDayThree(week, profile) {
  const cjPct = { 1: 0.7, 2: 0.75, 3: 0.825, 4: 0.65 }[week];
  const fs = {
    1: ["E2MOM x 6: 3 reps", 0.8],
    2: ["E2MOM x 6: 3 reps", 0.825],
    3: ["5x2", 0.875],
    4: ["3x3", 0.7]
  }[week];
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: ["400 m easy jog", "Dynamic prep", "Front rack and jerk footwork drills"]
    },
    {
      title: "Clean and jerk + squat",
      minutes: "24",
      items: [
        `Clean and jerk ${week === 3 ? "8x1 E2:00" : "EMOM 10: 1 rep"} at ${percent(cjPct)} (${kg(profile.maxes.cleanJerk, cjPct)})`,
        `Front squat ${fs[0]} at ${percent(fs[1])} (${kg(profile.maxes.frontSquat, fs[1])})`
      ]
    },
    {
      title: "WOD",
      minutes: "12",
      items: ["AMRAP 12: 200 m run, 10 pull-ups or 6 chest-to-bar, 12 wall balls", "Target RPE 8, keep runs steady"]
    },
    {
      title: "Accessory and mobility",
      minutes: "16",
      items: ["3x8-10 dips", "3x10 band pull-aparts", "Front rack, wrist, and lat mobility"]
    }
  ];
}

function buildDayFour(week, profile) {
  const pull = {
    1: ["4x3", 1.05],
    2: ["4x3", 1.1],
    3: ["5x2", 1.15],
    4: ["3x3", 0.95]
  }[week];
  const muscleUp = {
    1: "3 rounds: 5 scap pull-ups, 3-5 strict chest-to-bar or band assist, 5 jumping bar MU transitions, 3 slow negatives",
    2: "Same structure with slightly less assistance and cleaner transitions",
    3: "Try 3-6 early singles only if positions are sharp, then return to controlled negatives",
    4: "Deload drills only: transitions, hollow-arch rhythm, and easy pulling"
  }[week];
  return [
    {
      title: "Warm-up",
      minutes: "8",
      items: ["Easy bike or row", "Scap activation", "Wrist and elbow prep"]
    },
    {
      title: "Gymnastics + pull",
      minutes: "23",
      items: [
        `Muscle-up skill: ${muscleUp}`,
        `Clean pull ${pull[0]} at ${percent(pull[1])} of clean and jerk (${kg(profile.maxes.cleanJerk, pull[1])})`
      ]
    },
    {
      title: "WOD",
      minutes: week === 4 ? "15" : "18",
      items: [
        `${week === 4 ? "AMRAP 15" : "AMRAP 18"}: 400 m run, 10 pull-ups, 15 push-ups, 20 air squats`,
        "Target RPE 7-8 with round times within 10 percent"
      ]
    },
    {
      title: "Accessory and mobility",
      minutes: week === 4 ? "14" : "11",
      items: ["2 sets max hollow rocks + 2 sets max arch rocks", "Shoulder, pec, calves, and 60 sec hang"]
    }
  ];
}

function getNextDayForToday() {
  const day = new Date().getDay();
  if (day <= 1) return getProgramDays()[0];
  if (day === 2 || day === 3) return getProgramDays()[1];
  if (day === 4 || day === 5) return getProgramDays()[2];
  return getProgramDays()[3];
}

function kg(max, pct) {
  return `${roundToNearest(max * pct, 2.5)} kg`;
}

function percent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function valueFromPath(source, path) {
  return path.split(".").reduce((current, key) => current && current[key], source);
}

function normalizePrValue(rawValue, metric) {
  if (metric.type === "time") return parseTimeToSeconds(rawValue);
  const number = Number(String(rawValue).replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function parseTimeToSeconds(value) {
  if (typeof value === "number") return value;
  const raw = String(value).trim();
  if (!raw) return NaN;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return NaN;
}

function formatPrValue(value, metric) {
  if (!Number.isFinite(value)) return "-";
  if (metric.type === "time") return formatSeconds(value);
  return `${trimNumber(value)} ${metric.unit}`;
}

function formatSeconds(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`;
  return `${minutes}:${pad(rest)}`;
}

function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isBetterPr(nextValue, currentValue, metric) {
  if (!Number.isFinite(currentValue)) return true;
  return metric.direction === "lower" ? nextValue < currentValue : nextValue > currentValue;
}

function formatDate(value) {
  if (!value || value === "Baseline") return value || "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.info("Service worker registration skipped.", error);
    });
  });
}
