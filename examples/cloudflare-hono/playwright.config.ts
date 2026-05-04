import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8787",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // wrangler が src/index.ts を直接バンドルするため build は不要
    command: "pnpm exec wrangler dev --port 8787",
    url: "http://localhost:8787/posts",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
