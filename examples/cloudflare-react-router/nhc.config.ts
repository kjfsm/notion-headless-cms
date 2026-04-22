import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	notionToken: env("NOTION_TOKEN"),
	dataSources: [
		{
			name: "posts",
			// DB_NAME 環境変数で上書き可能。未設定時は "ブログ記事DB" にフォールバック。
			dbName: env("DB_NAME") || "ブログ記事DB",
			fields: {
				status: "ステータス", // status に使う Notion プロパティ名
				publishedAt: "公開日", // publishedAt に使う Notion プロパティ名
			},
		},
	],
	output: "./app/generated/nhc-schema.ts",
});
