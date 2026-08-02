const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "build/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "tmp/**",
      "temp/**",
      "playwright-report/**",
      "test-results/**",
      "playwright/.auth/**",
      ".agents/**",
      ".codex/**",
      "src/programming-v2/**",
      "AGENTS.md",
      "skills-lock.json",
    ],
  },
  js.configs.recommended,
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        module: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    files: [
      "tests/**/*.js",
      "e2e/**/*.js",
      "scripts/**/*.js",
      "playwright.config.js",
      "eslint.config.cjs",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    files: ["e2e/fixtures/supabase-browser-mock.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser,
    },
  },
  eslintConfigPrettier,
];
