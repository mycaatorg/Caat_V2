import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const BASE_HOST = new URL(BASE_URL).hostname;
const USE_LOCAL_SERVER = ["localhost", "127.0.0.1"].includes(BASE_HOST);
const LOCAL_PORT = new URL(BASE_URL).port || "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // auth tests need sequential order
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  maxFailures: process.env.CI ? 5 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Auth setup runs first — saves session to file
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // All E2E tests reuse the saved auth session (excludes unauth spec)
    {
      name: "e2e",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      testIgnore: [
        /unauth\.spec\.ts/,
        /public-smoke\.spec\.ts/,
        /route-guard\.spec\.ts/,
        /staging-(?:journeys|community|auth)\.spec\.ts/,
      ],
      dependencies: ["setup"],
    },
    // Read-only public pages and the unauthenticated redirect guard. This
    // project deliberately has no auth setup dependency.
    {
      name: "public-smoke",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [/public-smoke\.spec\.ts/, /route-guard\.spec\.ts/],
    },
    // Writes only against the disposable local Supabase stack. Each spec also
    // enforces CAAT_ISOLATED_E2E and a loopback base/API URL before it runs.
    {
      name: "staging",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [/staging-journeys\.spec\.ts/, /staging-community\.spec\.ts/, /staging-auth\.spec\.ts/],
    },
    // Unauthenticated tests (route protection, public pages)
    {
      name: "e2e-unauth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /unauth\.spec\.ts/,
    },
  ],

  webServer: USE_LOCAL_SERVER ? {
    // In CI, test against a real production build — dev mode would NOT have
    // caught the /communities serverless 500 (jsdom only failed in the prod
    // bundle). Locally, use the fast dev server.
    command: process.env.CI
      ? `npm run build && npm run start -- --hostname 127.0.0.1 --port ${LOCAL_PORT}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${LOCAL_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  } : undefined,
});
