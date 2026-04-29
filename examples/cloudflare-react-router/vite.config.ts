import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

// @cloudflare/vite-plugin と @react-router/dev/vite を併用すると、SSR 環境の出力先で衝突する:
// - React Router プラグインは environments.ssr.build.outDir = "build/server" を設定する
// - @cloudflare/vite-plugin は "${build.outDir}/${envName}" = "build/ssr" を設定する
// プラグイン順序で cloudflare 側が勝ち、react-router が読みに来る
// build/server/.vite/manifest.json が存在せず ENOENT になる。
// build.outDir を "build" に固定し、ssr 環境の outDir を明示することで両者を合意させる。
// viteEnvironment.name: "ssr" は workers/app.ts の virtual:react-router/server-build を
// 解決するために必須。
export default defineConfig({
  build: { outDir: "build" },
  environments: {
    ssr: { build: { outDir: "build/server" } },
  },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), reactRouter()],
});
