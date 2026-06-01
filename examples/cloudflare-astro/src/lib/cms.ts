import { createCMS } from "@notion-headless-cms/client";
import { cloudflarePreset } from "@notion-headless-cms/client/cloudflare";
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
    schema,
    token: env.NOTION_TOKEN,
    // content:"html" は markdown 取得 + HTML renderer を内部結線し、subrequest 上限を回避する。
    content: "html",
    runtime: cloudflarePreset({ env, ctx }),
    collections: {
      posts: {
        published: ["公開済み"],
        accessible: ["下書き", "編集中", "公開済み"],
      },
    },
  });
}
