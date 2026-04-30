import fs from "node:fs/promises";
import path from "node:path";
import { CMSError } from "@notion-headless-cms/core";
import { fileExists } from "../fs-utils.js";

export interface InitOptions {
  output?: string;
  force?: boolean;
  silent?: boolean;
}

const CONFIG_TEMPLATE = `import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	// Notion インテグレーションのシークレット (環境変数 NOTION_TOKEN から読み込む)
	notionToken: env("NOTION_TOKEN"),
	// 生成ファイルの出力先
	output: "src/generated/nhc.ts",
	// コレクション定義 (cms.posts → "posts")
	collections: {
		posts: {
			// dbName で Notion DB を検索して ID を自動解決します
			dbName: "ブログ記事DB",
			// databaseId を直接指定することもできます (databaseId が優先されます)
			// databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",

			// slug / status として使う TS フィールド名 (デフォルト: "slug" / "status")
			// slugField: "slug",
			// statusField: "status",

			// list() のデフォルト絞り込みに使う公開ステータス値
			publishedStatuses: ["公開済み"],

			// 日本語など ASCII 変換できないプロパティ名は明示マッピング必須
			// fieldMappings: { "タイトル": "title", "カテゴリ": "category" },
		},
	},
});

// ── 使い方 ──────────────────────────────────────────────────────────────
// 生成ファイルから createCMS をインポートし、ランタイム設定だけ渡します。
//
// import { createCMS } from "./generated/nhc";
// import { memoryCache } from "@notion-headless-cms/cache";
//
// export const cms = createCMS({
//   notionToken: process.env.NOTION_TOKEN!,
//   cache: memoryCache({ ttlMs: 5 * 60_000 }),
// });
//
// const posts = await cms.posts.list({ limit: 10 });
// const post = await cms.posts.get("hello-world");
// const html = await post?.render();
`;

export async function runInit(opts: InitOptions): Promise<void> {
  const outputPath = path.resolve(
    process.cwd(),
    opts.output ?? "nhc.config.ts",
  );

  if (!opts.force && (await fileExists(outputPath))) {
    throw new CMSError({
      code: "cli/init_failed",
      message: `${outputPath} はすでに存在します。上書きするには --force を指定してください。`,
      context: { operation: "runInit", outputPath },
    });
  }

  await fs.writeFile(outputPath, CONFIG_TEMPLATE, "utf-8");

  if (!opts.silent) {
    console.log(`✓ ${outputPath} を作成しました。`);
    console.log("");
    console.log("次のステップ:");
    console.log("  1. nhc.config.ts を編集して collections を設定する");
    console.log(
      "  2. NOTION_TOKEN 環境変数を設定する (Notion インテグレーションのシークレット)",
    );
    console.log("  3. pnpm nhc generate でスキーマを生成する");
  }
}
