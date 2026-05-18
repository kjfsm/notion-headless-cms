import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import { markdownFetcher } from "@notion-headless-cms/fetch-markdown";
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
  const embed = notionEmbed({
    providers: [youtubeProvider({ display: "card" })],
  });

  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        // Cloudflare Workers Free プランの 50 subrequest 上限を回避するため、
        // Notion Markdown export API を 1 リクエストで叩く戦略を使う。
        // notionKatex / notionShiki などの enricher、`blocks` (notion-to-md カスタム)、
        // `ogp` は block tree 戦略前提なので、md 戦略では適用されない。
        // syntax highlight や数式が必要なら markdown→HTML 側の renderer で対応する。
        fetch: markdownFetcher(),
        publishOptions: {
          posts: {
            publishedStatuses: ["公開済み"],
            accessibleStatuses: ["下書き", "編集中", "公開済み"],
          },
        },
      }),
    },
    // markdown→HTML 変換は引き続き embed.renderer で行う (fetcher と直交)。
    renderer: embed.renderer,
    // swr.ttlMs は未指定。キャッシュは永続させ、Notion の lastEditedTime に
    // 差分があったときだけ waitUntil の bg で差し替える。
    // ctx を渡さないと bg が打ち切られて KV の古いキャッシュが残るため、
    // Astro ページ側から Astro.locals.runtime.ctx を必ず渡すこと。
    ...cloudflarePreset({ env, ctx }),
  });
}
