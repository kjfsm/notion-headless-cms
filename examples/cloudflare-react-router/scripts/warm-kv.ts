/**
 * KV ウォームアップスクリプト（Node.js 専用）
 *
 * Cloudflare Workers のフリープランでは外部サブリクエストが 50 件/invocation に制限される。
 * 大きな Notion ページはブロックツリー取得だけで数十〜数百リクエストを消費するため、
 * 初回アクセスでタイムアウトする問題がある。
 *
 * このスクリプトを Node.js で実行してすべての投稿を KV に書き込んでおくと、
 * Workers は KV（内部リクエスト）から読み取るだけになり Notion API を一切叩かない。
 *
 * 使い方:
 *   CLOUDFLARE_ACCOUNT_ID=xxx \
 *   KV_NAMESPACE_ID=yyy \
 *   CLOUDFLARE_API_TOKEN=zzz \
 *   NOTION_TOKEN=ntn_... \
 *   pnpm warm
 *
 * または .dev.vars に変数を書いて:
 *   pnpm env -- pnpm warm
 *
 * GitHub Actions での自動実行例は .github/workflows/warm.yml を参照。
 *
 * 必要な環境変数:
 *   CLOUDFLARE_ACCOUNT_ID   — Cloudflare アカウント ID
 *   KV_NAMESPACE_ID         — DOC_CACHE の KV namespace ID (wrangler.toml の id)
 *   CLOUDFLARE_API_TOKEN    — Workers KV Storage: Edit 権限の API トークン
 *   NOTION_TOKEN            — Notion インテグレーションのシークレット
 */

import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
import {
  createCms,
  restKvNamespace,
} from "@notion-headless-cms/cloudflare";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { notionShiki } from "@notion-headless-cms/notion-shiki";
import { schema } from "../app/generated/nhc.js";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const namespaceId = process.env.KV_NAMESPACE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const notionToken = process.env.NOTION_TOKEN;

if (!accountId || !namespaceId || !apiToken || !notionToken) {
  console.error(
    "エラー: 以下の環境変数がすべて必要です:\n" +
      "  CLOUDFLARE_ACCOUNT_ID\n" +
      "  KV_NAMESPACE_ID\n" +
      "  CLOUDFLARE_API_TOKEN\n" +
      "  NOTION_TOKEN",
  );
  process.exit(1);
}

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

const kv = restKvNamespace({ accountId, namespaceId, apiToken });

const cms = createCms({
  schema,
  token: notionToken,
  blocks: embed.blocks,
  enrichers: [notionKatex({ displayMode: true }), notionShiki()],
  ogp: { enabled: true },
  publishOptions: {
    posts: {
      publishedStatuses: ["公開済み"],
      accessibleStatuses: ["下書き", "編集中", "公開済み"],
    },
  },
  env: { DOC_CACHE: kv },
  // waitUntil はウォームアップ後に完了するため no-op で十分
  ctx: { waitUntil: (p: Promise<unknown>) => p.catch(console.error) },
});

console.log("KV ウォームアップ開始...");
const start = Date.now();

const result = await cms.posts.cache.warm({
  onProgress: (done: number, total: number) => {
    process.stdout.write(`\r  ${done}/${total} 件処理済み`);
  },
});

process.stdout.write("\n");
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`完了 (${elapsed}s): ${result.ok} 件成功, ${result.failed.length} 件失敗`);

if (result.failed.length > 0) {
  console.error("\n失敗したアイテム:");
  for (const f of result.failed) {
    const msg = f.error instanceof Error ? f.error.message : String(f.error);
    console.error(`  - ${f.slug}: ${msg}`);
  }
  process.exit(1);
}
