import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    // @notionhq/client と notion-to-md は CJS のみのパッケージ。
    // Vite SSR ビルドで external のままにすると wrangler が
    // createRequire(import.meta.url) ラッパーを生成し Workers 上で失敗する。
    // noExternal に指定して Vite (rollup) 側で ESM へ変換させる。
    noExternal: ["@notionhq/client", "notion-to-md"],
  },
});
