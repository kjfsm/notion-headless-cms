import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// React Router 7 のプラグインが build/{client,server} へ自動で書き出すため、
// vite.build.outDir は指定しない（指定すると SSR マニフェストの出力パスが
// 想定とずれて build/server/.vite/manifest.json 不在エラーになる）。
// viteEnvironment.name: "ssr" は @cloudflare/vite-plugin と @react-router/dev/vite を
// 併用する際の必須設定。
export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
});
