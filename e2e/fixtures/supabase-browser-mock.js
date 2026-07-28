"use strict";

(function installSupabaseBrowserMock() {
  const AUTH_KEY = "forge-hour-e2e-auth-v1";
  const DATABASE_KEY = "forge-hour-e2e-supabase-v1";
  const listeners = new Set();
  const testWindow = /** @type {Window & {
    __E2E_SUPABASE_FAILURES__?: Record<string, number>,
    __E2E_SUPABASE_DELAYS__?: Record<string, number>
  }} */ (window);

  function readJson(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function database() {
    return readJson(DATABASE_KEY, {
      athlete_states: [],
      workout_logs: [],
      pr_attempts: [],
      personal_records: [],
    });
  }

  function writeDatabase(value) {
    window.localStorage.setItem(DATABASE_KEY, JSON.stringify(value));
  }

  function currentSession() {
    return readJson(AUTH_KEY, null);
  }

  function failureFor(operation) {
    const failures = testWindow.__E2E_SUPABASE_FAILURES__ || {};
    const remaining = Number(failures[operation] || 0);
    if (remaining <= 0) return null;
    failures[operation] = remaining - 1;
    return {
      code: "E2E_BACKEND_FAILURE",
      message: `Simulated ${operation} failure`,
    };
  }

  async function applyDelay(operation) {
    const delays = testWindow.__E2E_SUPABASE_DELAYS__ || {};
    const milliseconds = Number(delays[operation] || 0);
    if (milliseconds > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }
  }

  function rowKey(table, row) {
    if (table === "athlete_states") return String(row.user_id);
    if (table === "personal_records") {
      return `${row.user_id || ""}:${row.metric_id || ""}`;
    }
    return String(row.id || "");
  }

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.payload = null;
      this.filters = [];
      this.singleMode = null;
      this.rangeValue = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push({ type: "eq", column, value });
      return this;
    }

    neq(column, value) {
      this.filters.push({ type: "neq", column, value });
      return this;
    }

    order() {
      return this;
    }

    range(from, to) {
      this.rangeValue = { from, to };
      return this;
    }

    maybeSingle() {
      this.singleMode = "maybe";
      return this;
    }

    single() {
      this.singleMode = "single";
      return this;
    }

    upsert(payload) {
      this.operation = "upsert";
      this.payload = payload;
      return this;
    }

    delete() {
      this.operation = "delete";
      return this;
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    async execute() {
      const operation = `${this.table}.${this.operation}`;
      await applyDelay(operation);
      const failure = failureFor(operation);
      if (failure) return { data: null, error: failure };

      const state = database();
      const rows = Array.isArray(state[this.table]) ? state[this.table] : [];
      const matches = (row) =>
        this.filters.every((filter) =>
          filter.type === "eq"
            ? String(row[filter.column]) === String(filter.value)
            : String(row[filter.column]) !== String(filter.value),
        );

      if (this.operation === "upsert") {
        const incoming = Array.isArray(this.payload)
          ? this.payload
          : [this.payload];
        const saved = incoming.map((row) => ({
          ...row,
          updated_at: row.updated_at || new Date().toISOString(),
        }));
        saved.forEach((row) => {
          const key = rowKey(this.table, row);
          const index = rows.findIndex(
            (candidate) => rowKey(this.table, candidate) === key,
          );
          if (index >= 0) rows[index] = row;
          else rows.push(row);
        });
        state[this.table] = rows;
        writeDatabase(state);
        return {
          data: this.singleMode ? saved[0] : saved,
          error: null,
        };
      }

      if (this.operation === "delete") {
        state[this.table] = rows.filter((row) => !matches(row));
        writeDatabase(state);
        return { data: null, error: null };
      }

      let selected = rows.filter(matches);
      if (this.rangeValue) {
        selected = selected.slice(this.rangeValue.from, this.rangeValue.to + 1);
      }
      if (this.singleMode === "maybe") {
        return { data: selected[0] || null, error: null };
      }
      if (this.singleMode === "single") {
        return selected.length
          ? { data: selected[0], error: null }
          : {
              data: null,
              error: { code: "PGRST116", message: "No row found" },
            };
      }
      return { data: selected, error: null };
    }
  }

  function notifyAuth(event, session) {
    window.setTimeout(() => {
      listeners.forEach((listener) => listener(event, session));
    }, 0);
  }

  function createClient() {
    return {
      auth: {
        async getSession() {
          await applyDelay("auth.getSession");
          const failure = failureFor("auth.getSession");
          return failure
            ? { data: null, error: failure }
            : { data: { session: currentSession() }, error: null };
        },
        onAuthStateChange(callback) {
          listeners.add(callback);
          return {
            data: {
              subscription: {
                unsubscribe: () => listeners.delete(callback),
              },
            },
          };
        },
        async signInWithOtp({ email }) {
          await applyDelay("auth.signInWithOtp");
          const failure = failureFor("auth.signInWithOtp");
          if (failure) return { data: null, error: failure };
          const normalizedEmail = String(email || "e2e-athlete@example.test");
          const session = {
            access_token: "e2e-access-token",
            refresh_token: "e2e-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: `e2e-${normalizedEmail.replace(/[^a-z0-9]/gi, "-")}`,
              email: normalizedEmail,
            },
          };
          window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
          notifyAuth("SIGNED_IN", session);
          return { data: { session }, error: null };
        },
        async signOut() {
          await applyDelay("auth.signOut");
          const failure = failureFor("auth.signOut");
          if (failure) return { data: null, error: failure };
          window.localStorage.removeItem(AUTH_KEY);
          notifyAuth("SIGNED_OUT", null);
          return { data: null, error: null };
        },
      },
      from(table) {
        return new Query(table);
      },
      async rpc(name) {
        await applyDelay(`rpc.${name}`);
        const failure = failureFor(`rpc.${name}`);
        return failure
          ? { data: null, error: failure }
          : { data: null, error: null };
      },
    };
  }

  window.supabase = { createClient };
})();
