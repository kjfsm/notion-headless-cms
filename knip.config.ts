import type { KnipConfig } from "knip";

export default {
	workspaces: {
		".": {
			entry: [],
			project: [],
		},
		"packages/cli": {
			entry: ["src/index.ts", "src/cli.ts"],
			project: ["src/**/*.ts"],
		},
		"packages/*": {
			entry: ["src/index.ts"],
			project: ["src/**/*.ts"],
		},
	},
	ignore: ["**/dist/**", "**/__tests__/**", "**/examples/**"],
} satisfies KnipConfig;
