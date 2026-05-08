import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

// ctx は `waitUntil` だけ要求する構造型で受ける。
// React Router / Hono / Astro 等で型が微妙に違っても通る。
export function makeCms(
  env: Env,
  ctx?: { waitUntil(p: Promise<unknown>): void },
) {
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
    renderer: embed.renderer,
    // swr.ttlMs はあえて未指定。キャッシュは期限なしで永続させ、
    // Notion 側の lastEditedTime に差分があったときだけ waitUntil の bg で差し替える。
    // TTL を入れると期限切れ時にブロッキング再取得が走り、変更が無くても遅延が発生する。
    // cache (KV+R2) と waitUntil (SWR bg をレスポンス送信後も完走させる) を一括で注入。
    // ctx を渡さないと bg が打ち切られて KV の古いキャッシュが残り続ける。
    ...cloudflarePreset({ env, ctx }),
  });
}
