import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // Svelte 5 runes モードを強制（node_modules は除外）
    runes: ({ filename }) =>
      filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
  },
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
  },
};

export default config;
