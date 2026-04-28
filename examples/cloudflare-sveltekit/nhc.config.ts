import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	notionToken: env("NOTION_TOKEN"),
	output: "./src/generated/nhc.ts",
	collections: {
		posts: {
			// DB_NAME 環境変数で上書き可能。未設定時は "ブログ記事DB" にフォールバック。
			dbName: env("DB_NAME") || "ブログ記事DB",
			slugField: "slug",
			statusField: "status",
			publishedStatuses: ["公開済み"],
			// 日本語プロパティ名は識別子に自動変換できないため明示マッピングする。
			columnMappings: {
				名前: "name",
				ステータス: "status",
				公開日: "publishedAt",
				URL: "slug",
				著者: "author",
			},
		},
	},
});
