import path from "node:path";
import { defineConfig } from "vitest/config";

// テスト実行時にワークスペースパッケージの dist/ が存在しなくてもインポートを解決できるよう、
// サブパスエクスポートをソースファイルに直接エイリアスする。
const workspaceRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "**/node_modules/**"],
  },
  resolve: {
    alias: {
      "@notion-headless-cms/core/html": path.resolve(
        workspaceRoot,
        "packages/core/src/html.ts",
      ),
    },
  },
});
