import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
	dataSources: [
		{
			name: "posts",
			// dbName で Notion DB を検索して ID を自動解決します
			dbName: "ブログ記事DB",
			// id を直接指定することもできます（id が優先されます）
			// id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
			fields: {
				status: "ステータス",
			},
		},
	],
	output: "./app/generated/nhc-schema.ts",
});

// 生成後: createNodeMultiCMS / createCloudflareCMSMulti の sources オプションで
// published / accessible を設定してください。
// 例: sources: { posts: { published: ["公開"], accessible: ["公開", "下書き"] } }
