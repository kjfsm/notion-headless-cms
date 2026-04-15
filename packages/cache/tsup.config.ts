import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: {
		compilerOptions: {
			skipLibCheck: true,
		},
	},
	external: ["@kjfsm/notion-core"],
});
