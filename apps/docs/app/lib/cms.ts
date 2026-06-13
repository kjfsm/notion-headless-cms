import { createCMS, memoryCache } from "@notion-headless-cms/client";
import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  /** Notion Webhook 署名検証用 secret。`/api/revalidate` で使う。 */
  NOTION_WEBHOOK_SECRET?: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

// Notion からは "ランディング + 固定ページ" のみを取得する。
// content:"react" は blocks 取得戦略で BlockObjectResponse ツリーを取得し、react-renderer で
// callout / column / embed などを高忠実度に描画する。
// 本体ドキュメントは docs/ 配下の md を直接配信するため、ここには出てこない。
export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  return createCMS({
    notion: {
      schema,
      token: env.NOTION_TOKEN,
      collections: {
        pages: {
          published: ["完了"],
          accessible: ["未着手", "進行中", "完了"],
        },
      },
    },
    render: { content: "react" },
    // binding があれば KV/R2、無ければ in-process memory（ローカル / テスト用）にフォールバック。
    cache: {
      document: env.DOC_CACHE
        ? kvCache({ namespace: env.DOC_CACHE })
        : memoryCache(),
      image: env.IMG_BUCKET
        ? r2Cache({ bucket: env.IMG_BUCKET })
        : memoryCache(),
      waitUntil: (p) => ctx.waitUntil(p),
    },
  });
}
