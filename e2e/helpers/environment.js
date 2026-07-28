"use strict";

const { createClient } = require("@supabase/supabase-js");

const PRODUCTION_SUPABASE_URL = "https://wvypnaojkysxrftuqrnu.supabase.co";
const explicitSafetyAcknowledgement = "I_UNDERSTAND_THIS_IS_NOT_PRODUCTION";

function isMockMode() {
  return process.env.E2E_MODE !== "staging";
}

function requireEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required for staging E2E mode.`);
  return value;
}

function assertSafeSupabaseUrl(url, operation = "use") {
  const parsed = new URL(url);
  if (parsed.origin === PRODUCTION_SUPABASE_URL) {
    throw new Error(
      `Refusing to ${operation} the production Supabase project.`,
    );
  }
  const obviouslyNonProduction =
    ["localhost", "127.0.0.1"].includes(parsed.hostname) ||
    /(local|test|staging|preview|dev)/i.test(parsed.hostname);
  if (
    !obviouslyNonProduction &&
    process.env.E2E_ALLOW_NON_PRODUCTION_SUPABASE !==
      explicitSafetyAcknowledgement
  ) {
    throw new Error(
      `Refusing to ${operation} ${parsed.origin} without the explicit non-production acknowledgement.`,
    );
  }
  return parsed.origin;
}

function stagingEnvironment() {
  const url = assertSafeSupabaseUrl(
    requireEnvironment("E2E_SUPABASE_URL"),
    "run E2E tests against",
  );
  return {
    url,
    anonKey: requireEnvironment("E2E_SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnvironment("E2E_SUPABASE_SERVICE_ROLE_KEY"),
    email: requireEnvironment("E2E_USER_EMAIL"),
  };
}

async function generateStagingMagicLink(baseURL) {
  const environment = stagingEnvironment();
  const admin = createClient(environment.url, environment.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: environment.email,
    options: { redirectTo: baseURL },
  });
  if (error) throw error;
  const actionLink = data?.properties?.action_link;
  if (!actionLink) throw new Error("Supabase did not return a magic link.");
  return actionLink;
}

async function cleanupStagingUser() {
  if (process.env.E2E_ENABLE_REMOTE_CLEANUP !== "true") return;
  const environment = stagingEnvironment();
  assertSafeSupabaseUrl(environment.url, "clean E2E data from");
  const admin = createClient(environment.url, environment.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const users = /** @type {Array<{id: string, email?: string}>} */ (data.users);
  const user = users.find((candidate) => candidate.email === environment.email);
  if (!user) return;
  for (const table of [
    "workout_logs",
    "pr_attempts",
    "personal_records",
    "athlete_states",
  ]) {
    const result = await admin.from(table).delete().eq("user_id", user.id);
    if (result.error) throw result.error;
  }
}

module.exports = {
  assertSafeSupabaseUrl,
  cleanupStagingUser,
  generateStagingMagicLink,
  isMockMode,
  stagingEnvironment,
};
