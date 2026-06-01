import { createCMS } from "@notion-headless-cms/client";
import { cloudflarePreset } from "@notion-headless-cms/client/cloudflare";
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
    schema,
    token: env.NOTION_TOKEN,
    // content:"html" は Notion Markdown export API（1 リクエスト）+ HTML renderer を内部結線し、
    // Cloudflare Workers Free プランの 50 subrequest 上限を回避する。
    content: "html",
    // cloudflarePreset は swr.ttlMs を持たず永続キャッシュ。差分があれば waitUntil の bg で差し替える。
    runtime: cloudflarePreset({ env, ctx }),
    collections: {
      posts: {
        published: ["公開済み"],
        accessible: ["下書き", "編集中", "公開済み"],
      },
    },
  });
}
