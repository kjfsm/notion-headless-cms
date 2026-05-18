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
        fetch: markdownFetcher(),
        publishOptions: {
          docs: {
            publishedStatuses: ["完了"],
            accessibleStatuses: ["未着手", "進行中", "完了"],
          },
          pages: {
            publishedStatuses: ["完了"],
            accessibleStatuses: ["未着手", "進行中", "完了"],
          },
        },
      }),
    },
    // markdown→HTML 変換は引き続き embed.renderer で行う (fetcher と直交)。
    renderer: embed.renderer,
    ...cloudflarePreset({ env, ctx }),
  });
}
