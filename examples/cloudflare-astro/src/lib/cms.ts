import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

// ctx は `waitUntil` だけ要求する構造型で受ける。
// Astro の Locals.cfContext などをそのまま渡せる。Workers では常に提供される。
export function makeCms(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
) {
  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        publishOptions: {
          posts: {
            publishedStatuses: ["公開済み"],
            accessibleStatuses: ["下書き", "編集中", "公開済み"],
          },
        },
      }),
    },
    // swr.ttlMs は未指定。キャッシュは永続させ、Notion の lastEditedTime に
    // 差分があったときだけ waitUntil の bg で差し替える。
    // ctx を渡さないと bg が打ち切られて KV の古いキャッシュが残るため、
    // Astro ページ側から Astro.locals.runtime.ctx を必ず渡すこと。
    ...cloudflarePreset({ env, ctx }),
  });
}
