import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["app/**/*.test.ts", "packages/notion-backend/src/**/*.test.ts"],
	},
});
