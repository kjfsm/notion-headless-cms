import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "build" },
  // viteEnvironment.name: "ssr" は @cloudflare/vite-plugin と @react-router/dev/vite を
  // 併用する際の必須設定。これがないと workers/app.ts のビルド時に
  // virtual:react-router/server-build が解決できず "Could not resolve" エラーになる。
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
});
