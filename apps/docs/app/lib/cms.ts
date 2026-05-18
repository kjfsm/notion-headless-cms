import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import {
  markdownFetcher,
  notionMarkdownRenderer,
} from "@notion-headless-cms/fetch-markdown";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  /** Notion Webhook 署名検証用 secret。`/api/revalidate` で使う。 */
  NOTION_WEBHOOK_SECRET?: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

// Notion からは "ランディング + 固定ページ" のみを取得する。
// 本体ドキュメントは docs/ 配下の md を直接配信するため、ここには出てこない。
export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        fetch: markdownFetcher(),
        publishOptions: {
          pages: {
            publishedStatuses: ["完了"],
            accessibleStatuses: ["未着手", "進行中", "完了"],
          },
        },
      }),
    },
    renderer: notionMarkdownRenderer,
    ...cloudflarePreset({ env, ctx }),
  });
}
