import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import { blocksFetcher } from "@notion-headless-cms/fetch-blocks";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  /** Notion Webhook 署名検証用 secret。`/api/revalidate` で使う。 */
  NOTION_WEBHOOK_SECRET?: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

// Notion からは "ランディング + 固定ページ" のみを取得する。
// fetch-blocks 戦略で BlockObjectResponse ツリーを取得し、react-renderer で
// callout / column / embed などを高忠実度に描画する。
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
        fetch: blocksFetcher(),
        publishOptions: {
          pages: {
            publishedStatuses: ["完了"],
            accessibleStatuses: ["未着手", "進行中", "完了"],
          },
        },
      }),
    },
    ...cloudflarePreset({ env, ctx }),
  });
}
