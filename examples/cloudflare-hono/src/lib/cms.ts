import { createCMS, memoryCache } from "@notion-headless-cms/client";
import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";
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
    // content:"html" は Notion Markdown export API（1 リクエスト）+ HTML renderer を内部結線し、
    // Cloudflare Workers Free プランの 50 subrequest 上限を回避する。
    render: { content: "html" },
    // document=KV / image=R2 を役割別に明示。binding が無ければ memory にフォールバック。
    // waitUntil で SWR バックグラウンド更新を応答後も完走させる。
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
