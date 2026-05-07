import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

// 構造型で受けることで Hono の `ExecutionContext<unknown>` と
// Workers ランタイムの `ExecutionContext` の差を吸収する。
export function makeCms(
  env: Env,
  ctx?: { waitUntil(p: Promise<unknown>): void },
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
    // 差分があったときだけ waitUntil の bg で差し替える。Hono では
    // c.executionCtx を渡さないと bg が打ち切られる。
    ...cloudflarePreset({ env, ctx }),
  });
}
