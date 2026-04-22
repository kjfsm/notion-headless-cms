import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
	dataSources: [
		{
			name: "posts",
			dbName: "ブログ記事DB",

			fields: {
				status: "ステータス", // status に使う Notion プロパティ名
				publishedAt: "公開日", // publishedAt に使う Notion プロパティ名
			},
		},
	],
	output: "./app/generated/nhc-schema.ts",
});
