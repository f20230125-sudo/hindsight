import { defineConfig, devices } from "@playwright/test";

// End-to-end tests drive the real app in a real browser. Locally they use the
// dev server (and reuse one that is already running); in CI they run against
// the production build.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3040",
    trace: "retain-on-failure",
    // Times are shown in the visitor's own zone. One fixed zone keeps a test
    // the same on a laptop in Dubai and on a CI machine in UTC.
    timezoneId: "Asia/Dubai",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3040",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Nothing is at this address, so the server uses the recorded copy of the
    // GitHub bot's runs. The tests then read the same 54 runs every time.
    env: { HINDSIGHT_SNAPSHOT_URL: "http://127.0.0.1:9/no-snapshot-here" },
  },
});
