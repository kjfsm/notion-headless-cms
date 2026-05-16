import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "rm -f .wrangler/deploy/config.json && pnpm run build && pnpm exec wrangler dev --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
