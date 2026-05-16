import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "threads",
    reporter: process.env.CI ? ["dot"] : ["verbose"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
