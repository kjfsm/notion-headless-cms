import { createCMS, memoryCache } from "@notion-headless-cms/client";
import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";
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
  return createCMS({
    notion: {
      schema,
      token: env.NOTION_TOKEN,
      collections: {
        posts: {
          published: ["公開済み"],
          accessible: ["下書き", "編集中", "公開済み"],
        },
      },
    },
    // content:"react" は blocks 取得戦略。loader で notionBlocks() を React 描画する。
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
