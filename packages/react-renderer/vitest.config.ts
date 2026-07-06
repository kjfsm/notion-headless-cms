import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // tsconfig.json の paths と揃える（shadcn CLI 既定の `src/...` インポート対応）
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    pool: "vmThreads",
    globals: false,
  },
});
