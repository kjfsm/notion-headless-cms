import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // .svelte-kit/tsconfig.json が未生成の環境でも動作するよう tsconfig をインライン指定
    tsconfigRaw: {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        verbatimModuleSyntax: true,
      },
    },
  },
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
  test: {
    environment: "node",
  },
});
