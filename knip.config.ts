import type { KnipConfig } from "knip";

export default {
	workspaces: {
		".": {
			entry: [],
			project: [],
			// vitest.workspace.ts は knip では解析できないため除外
			vitest: {
				config: [],
			},
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
	ignore: ["**/examples/**"],
	// 未使用 exports / types は内部 API や公開 API の複雑な判定が必要なため
	// 未使用ファイルと依存チェックのみ有効化する
	exclude: ["exports", "types"],
} satisfies KnipConfig;
