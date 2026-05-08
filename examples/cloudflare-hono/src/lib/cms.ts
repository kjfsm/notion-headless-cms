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

// ctx は構造型で受けることで Hono の ExecutionContext と Workers の ExecutionContext 両方に対応する。
// Workers ランタイムでは常に ctx が渡るため必須とする。
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
    // 差分があったときだけ waitUntil の bg で差し替える。ctx がないと bg が打ち切られる。
    ...cloudflarePreset({ env, ctx }),
  });
}
