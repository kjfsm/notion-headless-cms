import fs from "node:fs/promises";
import path from "node:path";

import { CMSError } from "@notion-headless-cms/cms";

import { fileExists } from "../fs-utils.js";
import {
  generateMountCodeTemplate,
  generateSchemaTemplate,
  generateWranglerToml,
} from "../scaffold.js";

export interface InitOptions {
  output?: string;
  force?: boolean;
  silent?: boolean;
}

const NEXT_STEPS = [
  "依存を追加: pnpm add @notion-headless-cms/cms hono",
  "wrangler.toml の KV namespace ID / R2 bucket 名 (REPLACE_WITH_...) を実際の値に差し替える",
  "NOTION_TOKEN を .dev.vars に設定する (wrangler dev が自動読込)",
  "src/schema.ts の dataSourceId (REPLACE_WITH_DATA_SOURCE_ID) を実際の data source ID に差し替える",
  "nhc.config.ts の collections.posts.dbName を編集する (nhc pull/nhc check で使う)",
  "pnpm nhc doctor で binding・token・slug 重複を診断する",
  "pnpm wrangler dev → POST /api/sync/kick で初回同期を確認する",
];

function buildConfig(): string {
  return `import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	// Notion インテグレーションのシークレット (環境変数 NOTION_TOKEN から読み込む)
	notionToken: env("NOTION_TOKEN"),
	// スキーマ本体は src/schema.ts に TS ファーストで書く (codegen ではない)
	schemaModule: "src/schema.ts",
	collections: {
		posts: {
			// dbName で Notion DB を検索して data_source_id を自動解決します
			dbName: "ブログ記事DB",
			// databaseId (= data_source_id) を直接指定することもできます (databaseId が優先されます)
			// databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",

			// 日本語など ASCII 変換できないプロパティ名は明示マッピングできます
			// fieldMappings: { "タイトル": "title", "カテゴリ": "category" },
		},
	},
});
`;
}

/**
 * `nhc init`: `nhc.config.ts` に加え、`wrangler.toml`・`src/schema.ts`・
 * Hono マウントコード一式(`src/lib/do.ts`・`src/lib/cms.ts`・`src/index.ts`)を生成する。
 * `nhc pull` と同様、既存ファイルは上書きしない(生成物の所有権はユーザーに移る)。
 */
export async function runInit(opts: InitOptions): Promise<void> {
  const configPath = path.resolve(process.cwd(), opts.output ?? "nhc.config.ts");
  if (!opts.force && (await fileExists(configPath))) {
    throw new CMSError({
      code: "cli/init_failed",
      message: `${configPath} はすでに存在します。上書きするには --force を指定してください。`,
      context: { operation: "runInit", outputPath: configPath },
    });
  }
  await fs.writeFile(configPath, buildConfig(), "utf-8");

  const projectName = path.basename(process.cwd());
  const scaffoldFiles: Record<string, string> = {
    "wrangler.toml": generateWranglerToml({ projectName }),
    "src/schema.ts": generateSchemaTemplate(),
    ...generateMountCodeTemplate({ projectName }),
  };

  let written = 0;
  let skipped = 0;
  for (const [rel, content] of Object.entries(scaffoldFiles)) {
    const filePath = path.resolve(process.cwd(), rel);
    if (await fileExists(filePath)) {
      skipped++;
      continue;
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    written++;
  }

  if (!opts.silent) {
    console.log(`✓ ${configPath} を作成しました。`);
    console.log(`✓ 追加ファイルを生成: ${written} 件 / 既存のためスキップ: ${skipped} 件`);
    console.log("");
    console.log("次のステップ:");
    NEXT_STEPS.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
  }
}
