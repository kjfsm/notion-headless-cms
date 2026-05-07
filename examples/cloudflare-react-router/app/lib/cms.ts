import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { createCMS, type Nhc, type Post } from "../generated/nhc";

export type { Post as BlogPost };

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export function makeCms(env: Env): Nhc {
  const embed = notionEmbed({
    providers: [youtubeProvider({ display: "card" })],
  });

  return createCMS({
    notionToken: env.NOTION_TOKEN,
    cache: cloudflareCache({
      docCache: env.DOC_CACHE,
      imgBucket: env.IMG_BUCKET,
    }),
    renderer: embed.renderer,
    blocks: embed.blocks,
    // notion-katex で fetch 時に equation ブロックを KaTeX HTML に変換する。
    // react-renderer の Equation スタブが __cachedHtml を dangerouslySetInnerHTML で描画し、
    // Workers バンドルに katex が不要になる。
    enrichers: [notionKatex({ displayMode: true })],
    // OGP 取得は有効化するが R2 永続キャッシュは付けない。
    ogp: { enabled: true },
  });
}
