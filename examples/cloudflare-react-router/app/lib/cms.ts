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
    // content:"react" は blocks 取得戦略。loader で notionBlocks() を React 描画する。
    content: "react",
    runtime: cloudflarePreset({ env, ctx }),
    collections: {
      posts: {
        published: ["公開済み"],
        accessible: ["下書き", "編集中", "公開済み"],
      },
    },
  });
}
