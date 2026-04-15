import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	external: ["@kjfsm/notion-core", "@kjfsm/notion-cache"],
});
