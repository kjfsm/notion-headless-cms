import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    // Vite 8 は rolldown を使用しており、CJS パッケージを external のままにすると
    // createRequire(import.meta.url) ラッパーが生成され、Cloudflare Workers の
    // バリデーション時に import.meta.url === undefined でクラッシュする。
    // noExternal: true で全 node_modules を Vite (rolldown) 側でバンドルし
    // createRequire 依存を排除する。Node.js 組み込み (node:*) は自動的に除外される。
    noExternal: true,
  },
});
