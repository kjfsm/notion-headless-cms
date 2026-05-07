import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { notionSource } from "@notion-headless-cms/notion-source";
import { type Post, schema } from "../generated/nhc";

export type { Post as BlogPost };

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export function makeCms(env: Env) {
  const embed = notionEmbed({
    providers: [youtubeProvider({ display: "card" })],
  });

  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        blocks: embed.blocks,
        // notion-katex で fetch 時に equation ブロックを KaTeX HTML に変換する。
        // react-renderer の Equation スタブが __cachedHtml を dangerouslySetInnerHTML で描画し、
        // Workers バンドルに katex が不要になる。
        enrichers: [notionKatex({ displayMode: true })],
        // OGP 取得は有効化するが R2 永続キャッシュは付けない。
        ogp: { enabled: true },
        publishOptions: {
          posts: {
            publishedStatuses: ["公開済み"],
            accessibleStatuses: ["下書き", "編集中", "公開済み"],
          },
        },
      }),
    },
    cache: cloudflareCache({
      docCache: env.DOC_CACHE,
      imgBucket: env.IMG_BUCKET,
    }),
    renderer: embed.renderer,
  });
}
