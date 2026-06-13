import fs from "node:fs/promises";
import path from "node:path";
import { CMSError } from "@notion-headless-cms/core";
import { fileExists } from "../fs-utils.js";

export interface InitOptions {
  output?: string;
  force?: boolean;
  silent?: boolean;
  /** ランタイム別テンプレート名 (`node` / `cloudflare-react-router` / `cloudflare-hono` / `next`)。 */
  template?: string;
}

interface TemplateDef {
  /** スキーマ生成物の出力先 (`output` フィールド)。 */
  output: string;
  /** `notionToken` で `dotenv` を使うか (Node 系のみ。Cloudflare は .dev.vars を wrangler が読む)。 */
  useDotenv: boolean;
  /** `nhc init` 後に表示する次のステップ。 */
  nextSteps: string[];
}

/**
 * ランタイム別テンプレート定義。
 * 生成する `nhc.config.ts` 自体は共通で、`output` と次のステップだけが変わる。
 * フルスタック雛形は `examples/*` をコピーして使う想定で、ここではその入口を案内する。
 */
const TEMPLATES: Record<string, TemplateDef> = {
  node: {
    output: "src/generated/nhc.schema.ts",
    useDotenv: true,
    nextSteps: [
      "依存を追加: pnpm add @notion-headless-cms/client @notion-headless-cms/cli @notionhq/client zod notion-to-md",
      "nhc.config.ts を編集して collections を設定する",
      "NOTION_TOKEN 環境変数を設定する (Notion インテグレーションのシークレット)",
      "pnpm nhc generate でスキーマを生成する",
      'createCMS({ notion: { schema, token, collections: { posts: { published: ["公開済み"] } } }, render: { content: "html" } }) で組み込む',
    ],
  },
  "cloudflare-react-router": {
    output: "./app/generated/nhc.ts",
    useDotenv: false,
    nextSteps: [
      "依存を追加: pnpm add @notion-headless-cms/client @notionhq/client zod notion-to-md react react-dom react-router",
      "NOTION_TOKEN を .dev.vars に設定する (wrangler dev が自動読込)",
      "nhc.config.ts の dbName を編集する",
      "pnpm nhc generate でスキーマを生成する",
      "wrangler.toml に DOC_CACHE (KV) と IMG_BUCKET (R2) を binding する",
      'createCMS({ notion: { schema, token, collections: { posts: { published: ["公開済み"] } } }, render: { content: "react" }, cache: { document: kvCache({ namespace: env.DOC_CACHE }), image: r2Cache({ bucket: env.IMG_BUCKET }), waitUntil: (p) => ctx.waitUntil(p) } }) で組み込む',
      "完全な雛形 → examples/cloudflare-react-router/ / 解説 → docs/ja/recipes/react-router.md",
    ],
  },
  "cloudflare-hono": {
    output: "./src/generated/nhc.ts",
    useDotenv: false,
    nextSteps: [
      "依存を追加: pnpm add @notion-headless-cms/client @notionhq/client zod notion-to-md",
      "NOTION_TOKEN を .dev.vars に設定する (wrangler dev が自動読込)",
      "nhc.config.ts の dbName を編集する",
      "pnpm nhc generate でスキーマを生成する",
      "wrangler.toml に DOC_CACHE (KV) と IMG_BUCKET (R2) を binding する",
      'createCMS({ notion: { schema, token, collections: { posts: { published: ["公開済み"] } } }, render: { content: "html" }, cache: { document: kvCache({ namespace: env.DOC_CACHE }), image: r2Cache({ bucket: env.IMG_BUCKET }), waitUntil: (p) => ctx.waitUntil(p) } }) で組み込む',
      "完全な雛形 → examples/cloudflare-hono/ / 解説 → docs/ja/recipes/cloudflare-workers.md",
    ],
  },
  next: {
    output: "./app/generated/nhc.ts",
    useDotenv: true,
    nextSteps: [
      "依存を追加: pnpm add @notion-headless-cms/client @notion-headless-cms/cache @notionhq/client zod notion-to-md",
      "NOTION_TOKEN を .env (.env.local) に設定する",
      "nhc.config.ts の dbName を編集する",
      "pnpm nhc generate でスキーマを生成する",
      'createCMS({ notion: { schema, token, collections: { posts: { published: ["公開済み"] } } }, render: { content: "html" }, cache: { document: nextCache({ tags: ["posts"] }), image: memoryCache() } }) で組み込む',
      "完全な雛形 → examples/vercel-nextjs/ / 解説 → docs/ja/recipes/nextjs-app-router.md",
    ],
  },
};

const DEFAULT_TEMPLATE = "node";

function buildConfig(def: TemplateDef): string {
  const dotenvLine = def.useDotenv ? 'import "dotenv/config";\n' : "";
  return `${dotenvLine}import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	// Notion インテグレーションのシークレット (環境変数 NOTION_TOKEN から読み込む)
	notionToken: env("NOTION_TOKEN"),
	// 生成ファイルの出力先 (DB 構造のみ。token / 公開ポリシー等の振る舞いは createCMS() 側で指定する)
	output: "${def.output}",
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

			// 公開ステータス値 (published) は createCMS({ notion: { collections } }) 側で指定します

			// 日本語など ASCII 変換できないプロパティ名は明示マッピング必須
			// fieldMappings: { "タイトル": "title", "カテゴリ": "category" },
		},
	},
});
`;
}

export async function runInit(opts: InitOptions): Promise<void> {
  const templateName = opts.template ?? DEFAULT_TEMPLATE;
  const def = TEMPLATES[templateName];
  if (!def) {
    throw new CMSError({
      code: "cli/init_failed",
      message: `未知のテンプレート "${templateName}" です。利用可能: ${Object.keys(TEMPLATES).join(", ")}`,
      context: { operation: "runInit", template: templateName },
    });
  }

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

  await fs.writeFile(outputPath, buildConfig(def), "utf-8");

  if (!opts.silent) {
    console.log(`✓ ${outputPath} を作成しました。(template: ${templateName})`);
    console.log("");
    console.log("次のステップ:");
    def.nextSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
  }
}
