import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // process.chdir() を使うテストがあるため forks pool が必要
    pool: "forks",
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
