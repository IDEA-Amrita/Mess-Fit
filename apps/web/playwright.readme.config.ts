import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Captures the README screenshots (scripts/readme-shots/). Reuses the e2e
// servers (auth mock, API mock, next dev); kept out of the e2e run.
export default defineConfig({
  ...base,
  testDir: "./scripts/readme-shots",
  testMatch: "*.shots.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { ...base.use, colorScheme: "dark" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
