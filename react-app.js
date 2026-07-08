"use strict";

(function mountForgeHourReact() {
  const rootElement = document.querySelector("#root");
  const api = window.ForgeHour;
  const ReactRuntime = window.React;
  const ReactDOMRuntime = window.ReactDOM;

  if (!rootElement) return;

  if (!api || !ReactRuntime || !ReactDOMRuntime) {
    rootElement.innerHTML = '<div class="app-shell"><section class="panel"><h1>Forge Hour</h1><p class="muted-copy">React could not load. Check your connection and reload the app.</p></section></div>';
    return;
  }

  const {
    GOAL_LABELS,
    PR_METRICS,
    READINESS_LABELS,
    WEEK_META,
    WEAKNESS_LABELS,
    buildGeneratedProgramme,
    buildSession,
    clamp,
    cloneDefaultProfile,
    createId,
    customPlanSegments,
    filterMovementLibrary,
    formatDate,
    formatPrValue,
    getNextDayForToday,
    getProgramDays,
    isBetterPr,
    migrateGeneratedProgrammePlans,
    normalizePrValue,
    positiveNumber,
    registerServiceWorker,
    splitLines,
    valueFromPath
  } = api;

  const STORAGE_KEY = "forge-hour-state-v1";
  const THEME_COLORS = {
    light: "#10120f",
    dark: "#070907"
  };
  const h = ReactRuntime.createElement;

  function fallbackState() {
    return {
      profile: cloneDefaultProfile(),
      logs: [],
      customPlans: [],
      prs: {},
      prAttempts: [],
      selectedWeek: 1,
      themePreference: "system"
    };
  }

  function loadState() {
    const fallback = fallbackState();

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedState(fallback);

      const parsed = JSON.parse(raw);
      const merged = {
        ...fallback,
        ...parsed,
        selectedWeek: clamp(Number(parsed.selectedWeek) || fallback.selectedWeek, 1, 8),
        themePreference: normalizeThemePreference(parsed.themePreference),
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

      return seedState(merged);
    } catch (error) {
      console.warn("Could not read saved state.", error);
      return seedState(fallback);
    }
  }

  function seedState(state) {
    let next = seedPrs(state);
    const migration = migrateGeneratedProgrammePlans(next.customPlans, next.profile);

    if (migration.migrated) {
      next = { ...next, customPlans: migration.plans };
    }

    saveState(next);
    return next;
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Could not save state.", error);
    }
  }

  function seedPrs(state) {
    const prs = { ...(state.prs || {}) };
    let changed = false;

    PR_METRICS.forEach((metric) => {
      if (prs[metric.id]) return;
      const value = normalizePrValue(valueFromPath(state.profile, metric.seed), metric);
      prs[metric.id] = {
        metricId: metric.id,
        value,
        display: formatPrValue(value, metric),
        date: "Baseline",
        notes: "Seeded from initial research numbers."
      };
      changed = true;
    });

    return changed ? { ...state, prs } : state;
  }

  function syncBaselinePrsFromProfile(state) {
    const prs = { ...(state.prs || {}) };
    let changed = false;

    PR_METRICS.forEach((metric) => {
      const current = prs[metric.id];
      const hasAttempts = state.prAttempts.some((attempt) => attempt.metricId === metric.id);
      if (!current || current.date !== "Baseline" || hasAttempts) return;

      const value = normalizePrValue(valueFromPath(state.profile, metric.seed), metric);
      prs[metric.id] = {
        ...current,
        value,
        display: formatPrValue(value, metric)
      };
      changed = true;
    });

    return changed ? { ...state, prs } : state;
  }

  function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeThemePreference(value) {
    return ["system", "light", "dark"].includes(value) ? value : "system";
  }

  function getSystemTheme() {
    if (typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

  function weekOptions() {
    return WEEK_META.map((week) => h("option", { key: week.week, value: String(week.week) }, `Week ${week.week}`));
  }

  function viewClass(viewId, activeView) {
    return `view${viewId === activeView ? " is-active" : ""}`;
  }

  function App() {
    const [appState, setAppState] = ReactRuntime.useState(loadState);
    const [activeView, setActiveView] = ReactRuntime.useState("dashboardView");
    const [toast, setToast] = ReactRuntime.useState("");
    const [systemTheme, setSystemTheme] = ReactRuntime.useState(getSystemTheme);
    const [logSelection, setLogSelection] = ReactRuntime.useState(() => ({
      week: 1,
      dayId: getNextDayForToday().id
    }));
    const toastTimer = ReactRuntime.useRef(null);
    const themePreference = normalizeThemePreference(appState.themePreference);
    const activeTheme = resolveTheme(themePreference, systemTheme);

    const updateAppState = ReactRuntime.useCallback((updater) => {
      setAppState((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        saveState(next);
        return next;
      });
    }, []);

    const notify = ReactRuntime.useCallback((message) => {
      setToast(message);
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(""), 2400);
    }, []);

    const activateView = ReactRuntime.useCallback((viewId) => {
      setActiveView(viewId);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    }, []);

    const setSelectedWeek = ReactRuntime.useCallback((week) => {
      const selectedWeek = clamp(Number(week) || 1, 1, 8);
      setLogSelection((current) => ({ ...current, week: selectedWeek }));
      updateAppState((current) => ({ ...current, selectedWeek }));
    }, [updateAppState]);

    const jumpToLog = ReactRuntime.useCallback((dayId, weekNumber) => {
      const week = clamp(Number(weekNumber) || appState.selectedWeek, 1, 8);
      setLogSelection({ dayId, week });
      updateAppState((current) => ({ ...current, selectedWeek: week }));
      activateView("logView");
    }, [activateView, appState.selectedWeek, updateAppState]);

    ReactRuntime.useEffect(() => {
      setLogSelection((current) => ({ ...current, week: appState.selectedWeek }));
    }, [appState.selectedWeek]);

    ReactRuntime.useEffect(() => {
      registerServiceWorker();
      return () => window.clearTimeout(toastTimer.current);
    }, []);

    ReactRuntime.useEffect(() => {
      if (typeof window.matchMedia !== "function") return undefined;
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (event) => setSystemTheme(event.matches ? "dark" : "light");

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

    return h(ReactRuntime.Fragment, null,
      h("div", { className: "app-shell" },
        h("header", { className: "topbar" },
          h("div", null,
            h("p", { className: "eyebrow" }, "Intermediate CrossFit"),
            h("h1", null, "Forge Hour")
          ),
          h("div", { className: "topbar-actions" },
            h("div", { className: "status-pill" }, "Local save"),
            h(ThemeControl, {
              value: themePreference,
              onChange: (nextPreference) => {
                updateAppState((current) => ({
                  ...current,
                  themePreference: normalizeThemePreference(nextPreference)
                }));
              }
            })
          )
        ),
        h("main", null,
          h(DashboardView, {
            appState,
            activeView,
            onWeekChange: setSelectedWeek,
            onJumpLog: jumpToLog,
            onViewPlan: () => activateView("programView"),
            onSaveProfile: (profile) => {
              updateAppState((current) => syncBaselinePrsFromProfile({ ...current, profile }));
              notify("Training maxes saved.");
            },
            onReset: () => {
              if (!window.confirm("Reset profile, custom sessions, logs, and PRs on this device?")) return;
              window.localStorage.removeItem(STORAGE_KEY);
              const next = loadState();
              setAppState(next);
              setLogSelection({ week: next.selectedWeek, dayId: getNextDayForToday().id });
              notify("Demo data reset.");
            }
          }),
          h(ProgramView, {
            appState,
            activeView,
            onWeekChange: setSelectedWeek,
            onLogSession: jumpToLog
          }),
          h(BuilderView, {
            appState,
            activeView,
            onNotify: notify,
            onWeekChange: setSelectedWeek,
            onGenerate: (plans, replaceGenerated) => {
              updateAppState((current) => {
                const keptPlans = replaceGenerated ? current.customPlans.filter((plan) => !plan.generated) : current.customPlans;
                return { ...current, customPlans: [...plans, ...keptPlans], selectedWeek: 1 };
              });
              setLogSelection((current) => ({ ...current, week: 1 }));
              notify(`Generated ${plans.length} sessions.`);
            },
            onAddCustomPlan: (plan) => {
              updateAppState((current) => ({ ...current, customPlans: [plan, ...current.customPlans] }));
              notify("Training session saved.");
            },
            onClearCustomPlans: () => {
              if (!appState.customPlans.length) return;
              if (!window.confirm("Clear all custom training sessions on this device?")) return;
              updateAppState((current) => ({ ...current, customPlans: [] }));
              notify("Custom programme cleared.");
            },
            onDeleteCustomPlan: (planId) => {
              const plan = appState.customPlans.find((item) => item.id === planId);
              if (!plan || !window.confirm(`Delete "${plan.title}"?`)) return;
              updateAppState((current) => ({
                ...current,
                customPlans: current.customPlans.filter((item) => item.id !== planId)
              }));
              notify("Custom session deleted.");
            },
            onLogSession: jumpToLog
          }),
          h(LearnView, { activeView }),
          h(LogView, {
            appState,
            activeView,
            logSelection,
            onLogSelectionChange: setLogSelection,
            onWeekChange: setSelectedWeek,
            onNotify: notify,
            onSaveLog: (log) => {
              updateAppState((current) => ({ ...current, logs: [log, ...current.logs] }));
              notify("Workout log saved.");
            },
            onClearLogs: () => {
              if (!appState.logs.length) return;
              if (!window.confirm("Clear all workout logs on this device?")) return;
              updateAppState((current) => ({ ...current, logs: [] }));
              notify("Workout logs cleared.");
            }
          }),
          h(PrView, {
            appState,
            activeView,
            onNotify: notify,
            onSaveAttempt: (attempt) => {
              updateAppState((current) => {
                const prs = { ...current.prs };
                if (attempt.isPr) {
                  prs[attempt.metricId] = {
                    metricId: attempt.metricId,
                    value: attempt.value,
                    display: attempt.display,
                    date: attempt.date,
                    notes: attempt.notes
                  };
                }
                return { ...current, prs, prAttempts: [attempt, ...current.prAttempts] };
              });
              notify(attempt.isPr ? "New PR saved." : "Attempt saved.");
            }
          })
        ),
        h(BottomNav, { activeView, onActivate: activateView })
      ),
      h("div", { id: "toast", className: `toast${toast ? " is-visible" : ""}`, role: "status", "aria-live": "polite" }, toast)
    );
  }

  function ThemeControl({ value, onChange }) {
    return h("label", { className: "theme-control" },
      h("span", { className: "theme-control-label" }, "Theme"),
      h("select", {
        "aria-label": "Theme preference",
        value,
        onChange: (event) => onChange(event.target.value)
      },
        h("option", { value: "system" }, "System"),
        h("option", { value: "light" }, "Light"),
        h("option", { value: "dark" }, "Dark")
      )
    );
  }

  function WeekSelect({ id, label, value, onChange }) {
    return h("select", { id, "aria-label": label, value: String(value), onChange: (event) => onChange(event.target.value) }, weekOptions());
  }

  function DashboardView({ appState, activeView, onWeekChange, onJumpLog, onViewPlan, onSaveProfile, onReset }) {
    const logsThisWeek = appState.logs.filter((log) => log.week === appState.selectedWeek);
    const mainDayIds = getProgramDays().map((day) => day.id);
    const completedDays = new Set(logsThisWeek.filter((log) => mainDayIds.includes(log.dayId)).map((log) => log.dayId)).size;
    const latestRpe = appState.logs.find((log) => log.rpe);
    const latestPr = appState.prAttempts.find((attempt) => attempt.isPr);
    const weekPercent = Math.round((completedDays / 4) * 100);
    const nextDay = getNextDayForToday();
    const session = buildSession(nextDay.id, appState.selectedWeek, appState.profile);

    return h("section", { id: "dashboardView", className: viewClass("dashboardView", activeView), "aria-labelledby": "dashboardTitle" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Today"),
          h("h2", { id: "dashboardTitle" }, "Training dashboard")
        ),
        h(WeekSelect, { id: "dashboardWeek", label: "Dashboard week", value: appState.selectedWeek, onChange: onWeekChange })
      ),
      h("div", { className: "stats-grid", id: "statsGrid" },
        h(StatCard, { value: `${completedDays}/4`, label: "Sessions logged" }),
        h(StatCard, { value: `${weekPercent}%`, label: "Week complete" }),
        h(StatCard, { value: latestRpe ? latestRpe.rpe : "-", label: "Latest RPE" }),
        h(StatCard, { value: latestPr ? latestPr.metricName : "-", label: "Latest PR" })
      ),
      h("div", { id: "nextSession" },
        h("section", { className: "panel" },
          h("div", { className: "session-topline" },
            h("div", null,
              h("p", { className: "eyebrow" }, "Next up"),
              h("h3", null, `${session.weekday} - ${session.shortTitle}`)
            ),
            h("span", { className: "metric-pill" }, "60 min")
          ),
          h("p", { className: "muted-copy" }, session.focus),
          h("div", { className: "completion-bar", "aria-label": "Week completion" },
            h("span", { style: { width: `${weekPercent}%` } })
          ),
          h("div", { className: "quick-actions" },
            h("button", { className: "primary-button", type: "button", onClick: () => onJumpLog(session.id, appState.selectedWeek) }, "Log this"),
            h("button", { className: "ghost-button", type: "button", onClick: onViewPlan }, "View plan")
          )
        )
      ),
      h(ProfilePanel, { profile: appState.profile, onSave: onSaveProfile, onReset })
    );
  }

  function StatCard({ value, label }) {
    return h("article", { className: "stat-card" },
      h("p", { className: "stat-label" }, label),
      h("p", { className: "stat-value" }, value)
    );
  }

  function ProfilePanel({ profile, onSave, onReset }) {
    const [draft, setDraft] = ReactRuntime.useState(() => ({
      athleteName: profile.athleteName,
      maxes: { ...profile.maxes }
    }));

    ReactRuntime.useEffect(() => {
      setDraft({ athleteName: profile.athleteName, maxes: { ...profile.maxes } });
    }, [profile]);

    function updateMax(key, value) {
      setDraft((current) => ({ ...current, maxes: { ...current.maxes, [key]: value } }));
    }

    return h("section", { className: "panel", "aria-labelledby": "profileTitle" },
      h("div", { className: "panel-title" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Profile"),
          h("h3", { id: "profileTitle" }, "Training maxes")
        ),
        h("button", { className: "ghost-button", id: "resetDemoData", type: "button", onClick: onReset }, "Reset")
      ),
      h("form", {
        id: "profileForm",
        className: "profile-grid",
        onSubmit: (event) => {
          event.preventDefault();
          onSave({
            ...profile,
            athleteName: String(draft.athleteName || "Intermediate athlete").trim(),
            maxes: {
              backSquat: positiveNumber(draft.maxes.backSquat, profile.maxes.backSquat),
              frontSquat: positiveNumber(draft.maxes.frontSquat, profile.maxes.frontSquat),
              snatch: positiveNumber(draft.maxes.snatch, profile.maxes.snatch),
              cleanJerk: positiveNumber(draft.maxes.cleanJerk, profile.maxes.cleanJerk)
            }
          });
        }
      },
        h("label", null, "Athlete",
          h("input", { id: "athleteName", name: "athleteName", type: "text", autoComplete: "name", value: draft.athleteName, onChange: (event) => setDraft((current) => ({ ...current, athleteName: event.target.value })) })
        ),
        h(NumberInput, { id: "backSquatMax", name: "backSquatMax", label: "Back squat 1RM", value: draft.maxes.backSquat, onChange: (value) => updateMax("backSquat", value) }),
        h(NumberInput, { id: "frontSquatMax", name: "frontSquatMax", label: "Front squat 1RM", value: draft.maxes.frontSquat, onChange: (value) => updateMax("frontSquat", value) }),
        h(NumberInput, { id: "snatchMax", name: "snatchMax", label: "Snatch 1RM", value: draft.maxes.snatch, onChange: (value) => updateMax("snatch", value) }),
        h(NumberInput, { id: "cleanJerkMax", name: "cleanJerkMax", label: "Clean and jerk 1RM", value: draft.maxes.cleanJerk, onChange: (value) => updateMax("cleanJerk", value) }),
        h("button", { className: "primary-button", type: "submit" }, "Save maxes")
      )
    );
  }

  function NumberInput({ id, name, label, value, onChange }) {
    return h("label", null, label,
      h("input", { id, name, type: "number", min: "1", step: "0.5", inputMode: "decimal", value, onChange: (event) => onChange(event.target.value) })
    );
  }

  function ProgramView({ appState, activeView, onWeekChange, onLogSession }) {
    const week = WEEK_META.find((item) => item.week === appState.selectedWeek);

    return h("section", { id: "programView", className: viewClass("programView", activeView), "aria-labelledby": "programTitle" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Eight-week cycle"),
          h("h2", { id: "programTitle" }, "Programme")
        ),
        h(WeekSelect, { id: "programWeek", label: "Programme week", value: appState.selectedWeek, onChange: onWeekChange })
      ),
      h("div", { className: "week-note", id: "weekNote" },
        h("p", null, h("strong", null, `${week.title}.`), ` ${week.note}`)
      ),
      h("div", { className: "day-list", id: "programList" },
        getProgramDays().map((day) => {
          const session = buildSession(day.id, appState.selectedWeek, appState.profile);
          const logged = appState.logs.some((log) => log.week === appState.selectedWeek && log.dayId === day.id);
          return h(SessionCard, {
            key: session.id,
            session,
            tag: logged ? "Logged" : "60 min",
            onLog: () => onLogSession(session.id, appState.selectedWeek)
          });
        })
      )
    );
  }

  function SessionCard({ session, tag, meta, onLog, onDelete }) {
    return h("article", { className: "day-card", id: session.id },
      h("div", { className: "day-card-header" },
        h("div", null,
          h("p", null, session.weekday || `Week ${session.week}`),
          h("h3", null, session.shortTitle || session.title)
        ),
        h("span", { className: "tag" }, tag)
      ),
      h("div", { className: "day-card-body" },
        meta,
        h("p", { className: "muted-copy" }, session.focus || "Custom training session"),
        h(SegmentList, { segments: session.segments }),
        h("div", { className: "quick-actions" },
          onLog ? h("button", { className: "primary-button", type: "button", onClick: onLog }, "Log session") : null,
          onDelete ? h("button", { className: "danger-button", type: "button", onClick: onDelete }, "Delete") : null
        )
      )
    );
  }

  function SegmentList({ segments }) {
    return segments.map((segment) => h("section", { className: "segment", key: segment.title },
      h("h4", null,
        h("span", null, segment.title),
        h("span", { className: "metric-pill" }, `${segment.minutes} min`)
      ),
      h("ul", null, segment.items.map((item, index) => h("li", { key: `${segment.title}-${index}` }, item)))
    ));
  }

  function BuilderView({ appState, activeView, onNotify, onGenerate, onAddCustomPlan, onClearCustomPlans, onDeleteCustomPlan, onLogSession }) {
    const [customFormVersion, setCustomFormVersion] = ReactRuntime.useState(0);

    return h("section", { id: "builderView", className: viewClass("builderView", activeView), "aria-labelledby": "builderTitle" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Personal programming"),
          h("h2", { id: "builderTitle" }, "Programme builder")
        )
      ),
      h(GeneratorForm, {
        profile: appState.profile,
        onGenerate,
        onNotify
      }),
      h(CustomPlanForm, {
        key: `${appState.selectedWeek}-${customFormVersion}`,
        selectedWeek: appState.selectedWeek,
        onNotify,
        onSave: (plan) => {
          onAddCustomPlan(plan);
          setCustomFormVersion((version) => version + 1);
        }
      }),
      h("section", { className: "panel", "aria-labelledby": "customProgramTitle" },
        h("div", { className: "panel-title" },
          h("div", null,
            h("p", { className: "eyebrow" }, "Saved"),
            h("h3", { id: "customProgramTitle" }, "My training programme")
          ),
          h("button", { className: "ghost-button", id: "clearCustomPlans", type: "button", onClick: onClearCustomPlans }, "Clear custom")
        ),
        h("div", { id: "customProgramList", className: "custom-list" },
          appState.customPlans.length
            ? appState.customPlans.map((plan) => {
              const logged = appState.logs.some((log) => log.dayId === plan.id);
              const session = {
                id: plan.id,
                week: plan.week,
                weekday: `Week ${plan.week}`,
                shortTitle: plan.title,
                title: plan.title,
                focus: plan.focus,
                segments: customPlanSegments(plan)
              };
              return h(SessionCard, {
                key: plan.id,
                session,
                tag: `${plan.duration} min`,
                meta: h("div", { className: "history-meta" },
                  h("span", { className: "metric-pill" }, plan.intensity || "Moderate"),
                  plan.generated ? h("span", { className: "metric-pill" }, GOAL_LABELS[plan.sourceGoal] || "Generated") : null,
                  logged ? h("span", { className: "metric-pill" }, "Logged") : null
                ),
                onLog: () => onLogSession(plan.id, plan.week),
                onDelete: () => onDeleteCustomPlan(plan.id)
              });
            })
            : h("div", { className: "empty-state" }, "No custom sessions yet. Build one here, then log it from the Log tab.")
        )
      )
    );
  }

  function GeneratorForm({ profile, onGenerate }) {
    return h("form", {
      id: "programmeGeneratorForm",
      className: "panel builder-form",
      onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const options = {
          goal: String(data.get("generatorGoal") || "stronger"),
          daysPerWeek: Number(data.get("generatorDays") || 4),
          weakness: String(data.get("generatorWeakness") || "squat"),
          duration: positiveNumber(data.get("generatorDuration"), 60)
        };
        const generatedPlans = buildGeneratedProgramme(options, profile, createId);
        onGenerate(generatedPlans, Boolean(data.get("replaceGenerated")));
      }
    },
      h("div", { className: "panel-title" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Generate"),
          h("h3", null, "Programme from your needs")
        )
      ),
      h("div", { className: "form-row" },
        h("label", null, "Main goal",
          h("select", { id: "generatorGoal", name: "generatorGoal", required: true, defaultValue: "stronger" },
            h("option", { value: "stronger" }, "Get stronger"),
            h("option", { value: "endurance" }, "More endurance"),
            h("option", { value: "gymnastics" }, "Better gymnastics"),
            h("option", { value: "balanced" }, "All-round CrossFit")
          )
        ),
        h("label", null, "Sessions per week",
          h("select", { id: "generatorDays", name: "generatorDays", required: true, defaultValue: "4" },
            h("option", { value: "4" }, "4 days"),
            h("option", { value: "3" }, "3 days"),
            h("option", { value: "5" }, "5 days")
          )
        )
      ),
      h("div", { className: "form-row" },
        h("label", null, "Biggest weakness",
          h("select", { id: "generatorWeakness", name: "generatorWeakness", required: true, defaultValue: "squat" },
            Object.entries(WEAKNESS_LABELS).map(([value, label]) => h("option", { key: value, value }, label))
          )
        ),
        h("label", null, "Max session length",
          h("input", { id: "generatorDuration", name: "generatorDuration", type: "number", min: "45", max: "60", step: "5", inputMode: "numeric", defaultValue: "60" })
        )
      ),
      h("label", { className: "check-row" },
        h("input", { id: "replaceGenerated", name: "replaceGenerated", type: "checkbox", defaultChecked: true }),
        "Replace earlier generated sessions"
      ),
      h("button", { className: "primary-button", type: "submit" }, "Generate 8-week programme")
    );
  }

  function CustomPlanForm({ selectedWeek, onNotify, onSave }) {
    return h("form", {
      id: "customPlanForm",
      className: "panel builder-form",
      onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const title = String(data.get("customPlanTitle") || "").trim();
        if (!title) {
          onNotify("Add a title for the training session.");
          return;
        }

        onSave({
          id: createId(),
          week: Number(data.get("customPlanWeek")),
          title,
          focus: String(data.get("customPlanFocus") || "Custom training session").trim(),
          warmup: splitLines(data.get("customPlanWarmup")),
          strength: splitLines(data.get("customPlanStrength")),
          wod: splitLines(data.get("customPlanWod")),
          mobility: splitLines(data.get("customPlanMobility")),
          duration: Math.min(90, Math.max(15, positiveNumber(data.get("customPlanDuration"), 60))),
          intensity: String(data.get("customPlanIntensity") || "Moderate"),
          createdAt: new Date().toISOString()
        });
      }
    },
      h("div", { className: "panel-title" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Manual"),
          h("h3", null, "Add one training session")
        )
      ),
      h("div", { className: "form-row" },
        h("label", null, "Week",
          h("select", { id: "customPlanWeek", name: "customPlanWeek", required: true, defaultValue: String(selectedWeek) }, weekOptions())
        ),
        h("label", null, "Day or title",
          h("input", { id: "customPlanTitle", name: "customPlanTitle", type: "text", required: true, placeholder: "Friday engine + skill" })
        )
      ),
      h("label", null, "Focus",
        h("input", { id: "customPlanFocus", name: "customPlanFocus", type: "text", placeholder: "Engine, pull-up volume, mobility" })
      ),
      h("label", null, "Warm-up",
        h("textarea", { id: "customPlanWarmup", name: "customPlanWarmup", rows: "3", placeholder: "8 min easy bike\nDynamic hips and shoulders" })
      ),
      h("label", null, "Strength or skill",
        h("textarea", { id: "customPlanStrength", name: "customPlanStrength", rows: "3", placeholder: "EMOM 10: 2 strict pull-ups + 6 kip swings" })
      ),
      h("label", null, "WOD",
        h("textarea", { id: "customPlanWod", name: "customPlanWod", rows: "3", placeholder: "AMRAP 14: 12 cal row, 10 DB snatches, 8 burpees" })
      ),
      h("label", null, "Cooldown or mobility",
        h("textarea", { id: "customPlanMobility", name: "customPlanMobility", rows: "3", placeholder: "5 min nasal breathing\nLats, pecs, hip flexors" })
      ),
      h("div", { className: "form-row" },
        h("label", null, "Duration",
          h("input", { id: "customPlanDuration", name: "customPlanDuration", type: "number", min: "15", max: "90", step: "5", inputMode: "numeric", defaultValue: "60" })
        ),
        h("label", null, "Intensity",
          h("select", { id: "customPlanIntensity", name: "customPlanIntensity", defaultValue: "Technique" },
            h("option", { value: "Technique" }, "Technique"),
            h("option", { value: "Moderate" }, "Moderate"),
            h("option", { value: "Hard" }, "Hard"),
            h("option", { value: "Deload" }, "Deload"),
            h("option", { value: "Test" }, "Test")
          )
        )
      ),
      h("button", { className: "primary-button", type: "submit" }, "Save training session")
    );
  }

  function LearnView({ activeView }) {
    const [category, setCategory] = ReactRuntime.useState("all");
    const [query, setQuery] = ReactRuntime.useState("");
    const movements = filterMovementLibrary(category, query);

    return h("section", { id: "learnView", className: viewClass("learnView", activeView), "aria-labelledby": "learnTitle" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Movement library"),
          h("h2", { id: "learnTitle" }, "Learn the skills")
        )
      ),
      h("section", { className: "panel movement-controls", "aria-labelledby": "movementFilterTitle" },
        h("div", { className: "panel-title" },
          h("div", null,
            h("p", { className: "eyebrow" }, "Video guides"),
            h("h3", { id: "movementFilterTitle" }, "Gymnastics and lifting")
          )
        ),
        h("div", { className: "movement-filters" },
          h("label", null, "Category",
            h("select", { id: "movementCategory", "aria-label": "Movement category", value: category, onChange: (event) => setCategory(event.target.value) },
              h("option", { value: "all" }, "All movements"),
              h("option", { value: "Gymnastics" }, "Gymnastics"),
              h("option", { value: "Weightlifting" }, "Weightlifting")
            )
          ),
          h("label", null, "Search",
            h("input", { id: "movementSearch", type: "search", autoComplete: "off", placeholder: "Bar muscle-up, snatch, rope climb", value: query, onChange: (event) => setQuery(event.target.value) })
          )
        )
      ),
      h("div", { id: "movementLibrary", className: "movement-grid" },
        movements.length
          ? movements.map((movement) => h(MovementCard, { key: movement.id, movement }))
          : h("div", { className: "empty-state" }, "No movements found. Try a different search or category.")
      )
    );
  }

  function MovementCard({ movement }) {
    return h("article", { className: "movement-card" },
      h("div", { className: "movement-card-header" },
        h("div", null,
          h("p", { className: "eyebrow" }, movement.category),
          h("h3", null, movement.name)
        ),
        h("span", { className: "tag" }, movement.level)
      ),
      h("p", { className: "muted-copy" }, movement.focus),
      h("div", { className: "movement-detail-grid" },
        h("section", null,
          h("h4", null, "Cues"),
          h("ul", null, movement.cues.map((cue) => h("li", { key: cue }, cue)))
        ),
        h("section", null,
          h("h4", null, "Progression"),
          h("ul", null, movement.progressions.map((step) => h("li", { key: step }, step)))
        )
      ),
      h("p", { className: "movement-scale" }, h("strong", null, "Scale:"), ` ${movement.scale}`),
      h("div", { className: "quick-actions" },
        h("a", { className: "primary-button movement-link", href: movement.videoUrl, target: "_blank", rel: "noopener noreferrer" }, "Open video"),
        h("a", { className: "ghost-button movement-link", href: movement.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, "Source")
      )
    );
  }

  function LogView({ appState, activeView, logSelection, onLogSelectionChange, onWeekChange, onNotify, onSaveLog, onClearLogs }) {
    const [formVersion, setFormVersion] = ReactRuntime.useState(0);
    const selectedWeek = clamp(Number(logSelection.week) || appState.selectedWeek, 1, 8);
    const selectedDayId = logSelection.dayId || getProgramDays()[0].id;

    return h("section", { id: "logView", className: viewClass("logView", activeView), "aria-labelledby": "logTitle" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "SugarWOD-style"),
          h("h2", { id: "logTitle" }, "Log workout")
        )
      ),
      h("form", {
        key: formVersion,
        id: "logForm",
        className: "panel log-form",
        onSubmit: (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const day = findTrainingSessionForState(String(data.get("logDay")), Number(data.get("logWeek")), appState);

          if (!day) {
            onNotify("Choose a valid session to log.");
            return;
          }

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
            notes: String(data.get("logNotes") || "").trim(),
            mobilityDone: Boolean(data.get("mobilityDone")),
            createdAt: new Date().toISOString()
          };

          onSaveLog(log);
          setFormVersion((version) => version + 1);
        }
      },
        h("div", { className: "form-row" },
          h("label", null, "Date",
            h("input", { id: "logDate", name: "logDate", type: "date", required: true, defaultValue: todayInputValue() })
          ),
          h("label", null, "Week",
            h("select", {
              id: "logWeek",
              name: "logWeek",
              required: true,
              value: String(selectedWeek),
              onChange: (event) => {
                const week = Number(event.target.value);
                onLogSelectionChange({ ...logSelection, week });
                onWeekChange(week);
              }
            }, weekOptions())
          )
        ),
        h("label", null, "Session",
          h("select", {
            id: "logDay",
            name: "logDay",
            required: true,
            value: selectedDayId,
            onChange: (event) => onLogSelectionChange({ ...logSelection, dayId: event.target.value, week: selectedWeek })
          },
            h("optgroup", { label: "Forge Hour" },
              getProgramDays().map((day) => h("option", { key: day.id, value: day.id }, `${day.weekday} - ${day.shortTitle}`))
            ),
            appState.customPlans.length ? h("optgroup", { label: "My programme" },
              appState.customPlans.map((plan) => h("option", { key: plan.id, value: plan.id }, `Custom W${plan.week}: ${plan.title}`))
            ) : null
          )
        ),
        h("div", { className: "form-row" },
          h("label", null, "Readiness",
            h("select", { id: "readiness", name: "readiness", defaultValue: "green" },
              h("option", { value: "green" }, "Green - push the plan"),
              h("option", { value: "amber" }, "Amber - hold technique"),
              h("option", { value: "red" }, "Red - scale today")
            )
          ),
          h("label", null, "RPE",
            h("input", { id: "rpe", name: "rpe", type: "number", min: "1", max: "10", step: "0.5", inputMode: "decimal", placeholder: "8" })
          )
        ),
        h("label", null, "Strength or skill result",
          h("input", { id: "strengthResult", name: "strengthResult", type: "text", placeholder: "Back squat 5x4 at 110 kg, all smooth" })
        ),
        h("label", null, "WOD score",
          h("input", { id: "wodScore", name: "wodScore", type: "text", placeholder: "4 rounds + 8 reps, or 14:36" })
        ),
        h("label", null, "Notes",
          h("textarea", { id: "logNotes", name: "logNotes", rows: "4", placeholder: "Pacing, scaling, misses, mobility, next adjustment" })
        ),
        h("label", { className: "check-row" },
          h("input", { id: "mobilityDone", name: "mobilityDone", type: "checkbox" }),
          "Mobility completed"
        ),
        h("button", { className: "primary-button", type: "submit" }, "Save workout log")
      ),
      h("section", { className: "panel", "aria-labelledby": "recentLogsTitle" },
        h("div", { className: "panel-title" },
          h("div", null,
            h("p", { className: "eyebrow" }, "History"),
            h("h3", { id: "recentLogsTitle" }, "Recent logs")
          ),
          h("button", { className: "ghost-button", id: "clearLogs", type: "button", onClick: onClearLogs }, "Clear logs")
        ),
        h("div", { id: "recentLogs", className: "history-list" },
          appState.logs.length
            ? appState.logs.slice(0, 12).map((log) => h(LogHistoryItem, { key: log.id, log }))
            : h("div", { className: "empty-state" }, "No workout logs yet. Save your first session after training.")
        )
      )
    );
  }

  function LogHistoryItem({ log }) {
    return h("article", { className: "history-item" },
      h("h4", null, `${formatDate(log.date)} - Week ${log.week}, ${log.dayTitle}`),
      h("p", null, `${log.wodScore || "No WOD score"} ${log.strengthResult ? "- " + log.strengthResult : ""}`),
      log.notes ? h("p", null, log.notes) : null,
      h("div", { className: "history-meta" },
        h("span", { className: `metric-pill readiness-${log.readiness}` }, READINESS_LABELS[log.readiness] || log.readiness),
        log.rpe ? h("span", { className: "metric-pill" }, `RPE ${log.rpe}`) : null,
        log.mobilityDone ? h("span", { className: "metric-pill" }, "Mobility done") : null
      )
    );
  }

  function findTrainingSessionForState(sessionId, weekNumber, state) {
    const mainDay = getProgramDays().find((day) => day.id === sessionId);
    if (mainDay) {
      return buildSession(mainDay.id, weekNumber, state.profile);
    }

    const customPlan = state.customPlans.find((plan) => plan.id === sessionId);
    if (!customPlan) return null;

    return {
      id: customPlan.id,
      week: customPlan.week,
      weekday: `Week ${customPlan.week}`,
      shortTitle: customPlan.title,
      focus: customPlan.focus,
      segments: customPlanSegments(customPlan)
    };
  }

  function PrView({ appState, activeView, onNotify, onSaveAttempt }) {
    const [formVersion, setFormVersion] = ReactRuntime.useState(0);

    return h("section", { id: "prView", className: viewClass("prView", activeView), "aria-labelledby": "prTitle" },
      h("div", { className: "section-heading" },
        h("div", null,
          h("p", { className: "eyebrow" }, "Personal records"),
          h("h2", { id: "prTitle" }, "PR tracker")
        )
      ),
      h("div", { className: "pr-grid", id: "prGrid" },
        PR_METRICS.map((metric) => {
          const pr = appState.prs[metric.id];
          return h("article", { className: "pr-card", key: metric.id },
            h("p", { className: "pr-label" }, metric.name),
            h("p", { className: "pr-value" }, pr ? pr.display : "-"),
            h("p", { className: "stat-label" }, pr ? pr.date : "No PR yet")
          );
        })
      ),
      h("form", {
        key: formVersion,
        id: "prForm",
        className: "panel pr-form",
        onSubmit: (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const metric = PR_METRICS.find((item) => item.id === data.get("prMetric"));
          const normalized = normalizePrValue(String(data.get("prValue") || ""), metric);

          if (!Number.isFinite(normalized)) {
            onNotify(metric.type === "time" ? "Use time like 3:30 or 14:36." : "Enter a valid number.");
            return;
          }

          const current = appState.prs[metric.id];
          const isPr = !current || isBetterPr(normalized, current.value, metric);
          onSaveAttempt({
            id: createId(),
            metricId: metric.id,
            metricName: metric.name,
            value: normalized,
            display: formatPrValue(normalized, metric),
            date: String(data.get("prDate")),
            notes: String(data.get("prNotes") || "").trim(),
            isPr,
            createdAt: new Date().toISOString()
          });
          setFormVersion((version) => version + 1);
        }
      },
        h("div", { className: "panel-title" },
          h("div", null,
            h("p", { className: "eyebrow" }, "Attempt"),
            h("h3", null, "Log PR attempt")
          )
        ),
        h("label", null, "Metric",
          h("select", { id: "prMetric", name: "prMetric", defaultValue: PR_METRICS[0].id },
            PR_METRICS.map((metric) => h("option", { key: metric.id, value: metric.id }, metric.name))
          )
        ),
        h("div", { className: "form-row" },
          h("label", null, "Result",
            h("input", { id: "prValue", name: "prValue", type: "text", required: true, placeholder: "145, 3:30, 12" })
          ),
          h("label", null, "Date",
            h("input", { id: "prDate", name: "prDate", type: "date", required: true, defaultValue: todayInputValue() })
          )
        ),
        h("label", null, "Notes",
          h("textarea", { id: "prNotes", name: "prNotes", rows: "3", placeholder: "How it felt, setup, video cue, split, scaling" })
        ),
        h("button", { className: "primary-button", type: "submit" }, "Save PR attempt")
      ),
      h("section", { className: "panel", "aria-labelledby": "attemptHistoryTitle" },
        h("div", { className: "panel-title" },
          h("div", null,
            h("p", { className: "eyebrow" }, "Timeline"),
            h("h3", { id: "attemptHistoryTitle" }, "Recent PR attempts")
          )
        ),
        h("div", { id: "prHistory", className: "history-list" },
          appState.prAttempts.length
            ? appState.prAttempts.slice(0, 12).map((attempt) => h("article", { className: "history-item", key: attempt.id },
              h("h4", null, `${attempt.isPr ? "PR" : "Attempt"} - ${attempt.metricName} ${attempt.display}`),
              h("p", null, `${formatDate(attempt.date)}${attempt.notes ? " - " + attempt.notes : ""}`)
            ))
            : h("div", { className: "empty-state" }, "No PR attempts yet. Baselines are loaded, and attempts you log will appear here.")
        )
      )
    );
  }

  function BottomNav({ activeView, onActivate }) {
    const items = [
      ["dashboardView", "Home"],
      ["programView", "Plan"],
      ["builderView", "Build"],
      ["learnView", "Learn"],
      ["logView", "Log"],
      ["prView", "PRs"]
    ];

    return h("nav", { className: "bottom-nav", "aria-label": "Main navigation" },
      items.map(([viewId, label]) => h("button", {
        key: viewId,
        className: `nav-button${activeView === viewId ? " is-active" : ""}`,
        type: "button",
        "data-view": viewId,
        onClick: () => onActivate(viewId)
      }, label))
    );
  }

  const root = ReactDOMRuntime.createRoot(rootElement);
  root.render(h(App));
})();
