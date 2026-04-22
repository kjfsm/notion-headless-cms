import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
	build: { outDir: "build" },
	plugins: [cloudflare(), reactRouter()],
});
