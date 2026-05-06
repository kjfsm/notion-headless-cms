import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  // imageService を "passthrough" にしないと 13.3.x から IMAGES バインディングが自動追加され、
  // Cloudflare Images 未契約の環境でデプロイが失敗する。
  // このサンプルは R2 カスタムプロキシ経由で画像配信するため Astro の画像最適化は不要。
  adapter: cloudflare({ imageService: "passthrough" }),
});
