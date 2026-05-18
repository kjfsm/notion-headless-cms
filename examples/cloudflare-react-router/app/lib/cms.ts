import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import {
  createNotionMarkdownRenderer,
  markdownFetcher,
} from "@notion-headless-cms/fetch-markdown";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { notionShiki } from "@notion-headless-cms/notion-shiki";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        // Cloudflare Workers Free プランの 50 subrequest 上限を回避するため、
        // Notion Markdown export API を 1 リクエストで叩く戦略を使う。
        fetch: markdownFetcher(),
        publishOptions: {
          posts: {
            publishedStatuses: ["公開済み"],
            accessibleStatuses: ["下書き", "編集中", "公開済み"],
          },
        },
      }),
    },
    // post.html() を使う場合のサーバーサイド renderer。
    // katex・shiki を含む非同期プラグインも動作する。
    renderer: createNotionMarkdownRenderer([notionKatex(), notionShiki()]),
    ...cloudflarePreset({ env, ctx }),
  });
}
