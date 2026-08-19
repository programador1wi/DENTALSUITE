import { defineConfig, devices } from "@playwright/test";

const hasE2eCredentials = Boolean(process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD);
const authenticatedState = "test-results/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: true,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    ...(hasE2eCredentials
      ? [{
          name: "setup",
          testMatch: /auth\.setup\.ts/
        }]
      : []),
    {
      name: "chromium",
      dependencies: hasE2eCredentials ? ["setup"] : [],
      use: {
        ...devices["Desktop Chrome"],
        storageState: hasE2eCredentials ? authenticatedState : undefined
      }
    }
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000
      }
});
