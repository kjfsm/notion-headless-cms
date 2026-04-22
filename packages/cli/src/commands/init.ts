import fs from "node:fs/promises";
import path from "node:path";

export interface InitOptions {
	output?: string;
	force?: boolean;
}

const CONFIG_TEMPLATE = `import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
	dataSources: [
		{
			name: "posts",
			// dbName で Notion DB を検索して ID を自動解決します
			dbName: "ブログ記事DB",
			// id を直接指定することもできます（id が優先されます）
			// id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
			fields: {
				// slug に使う Notion プロパティ名（省略時: title 型プロパティを自動検出）
				// slug: "Slug",
				// status に使う Notion プロパティ名（省略時: "Status" などを自動検出）
				// status: "Status",
				// publishedAt に使う Notion プロパティ名（省略時: "PublishedAt" などを自動検出）
				// publishedAt: "PublishedAt",
				// 公開ステータス値（nhc generate 後に手動設定することも可能）
				// published: ["公開"],
				// accessible: ["公開", "下書き"],
			},
		},
	],
	// 生成ファイルの出力先（省略時: ./nhc-schema.ts）
	// output: "./nhc-schema.ts",
});
`;

export async function runInit(opts: InitOptions): Promise<void> {
	const outputPath = path.resolve(
		process.cwd(),
		opts.output ?? "nhc.config.ts",
	);

	const exists = await fs
		.access(outputPath)
		.then(() => true)
		.catch(() => false);

	if (exists && !opts.force) {
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
