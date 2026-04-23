import fs from "node:fs/promises";
import path from "node:path";
import { fileExists } from "../fs-utils.js";

export interface InitOptions {
	output?: string;
	force?: boolean;
}

const CONFIG_TEMPLATE = `import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	// Notion インテグレーションのシークレット（環境変数 NOTION_TOKEN から読み込む）
	notionToken: env("NOTION_TOKEN"),
	dataSources: [
		{
			name: "posts",
			// dbName で Notion DB を検索して ID を自動解決します
			dbName: "ブログ記事DB",
			// id を直接指定することもできます（id が優先されます）
			// id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
			// fields: {
			// 	// 自動検出が当たらない場合のみ指定してください
			// 	// slug: "Slug",        // slug に使う Notion プロパティ名
			// 	// status: "Status",    // status に使う Notion プロパティ名
			// 	// publishedAt: "公開日", // publishedAt に使う Notion プロパティ名
			// 	// 日本語など ASCII 変換できないプロパティ名は必須指定
			// 	// properties: { "タイトル": "title", "カテゴリ": "category" },
			// },
		},
	],
	// 生成ファイルの出力先
	output: "./app/generated/nhc-schema.ts",
});

// 生成後: createNodeCMS / createCloudflareCMS の sources オプションで
// published / accessible を設定してください。
// 例: sources: { posts: { published: ["公開"], accessible: ["公開", "下書き"] } }
`;

export async function runInit(opts: InitOptions): Promise<void> {
	const outputPath = path.resolve(
		process.cwd(),
		opts.output ?? "nhc.config.ts",
	);

	if (!opts.force && (await fileExists(outputPath))) {
		throw new Error(
			`${outputPath} はすでに存在します。上書きするには --force を指定してください。`,
		);
	}

	await fs.writeFile(outputPath, CONFIG_TEMPLATE, "utf-8");

	console.log(`✓ ${outputPath} を作成しました。`);
	console.log("");
	console.log("次のステップ:");
	console.log("  1. nhc.config.ts を編集して dataSources を設定する");
	console.log(
		"  2. NOTION_TOKEN 環境変数を設定する（Notion インテグレーションのシークレット）",
	);
	console.log("  3. pnpm nhc generate でスキーマを生成する");
}
