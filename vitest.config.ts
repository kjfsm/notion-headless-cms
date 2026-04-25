import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			provider: "v8",
			thresholds: {
				lines: 75,
				functions: 80,
				branches: 60,
				statements: 75,
			},
		},
	},
});
