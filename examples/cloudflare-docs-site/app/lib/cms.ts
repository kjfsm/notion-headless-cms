import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { notionShiki } from "@notion-headless-cms/notion-shiki";
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
        blocks: embed.blocks,
        enrichers: [notionKatex({ displayMode: true }), notionShiki()],
        ogp: { enabled: true },
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
    renderer: embed.renderer,
    ...cloudflarePreset({ env, ctx }),
  });
}
