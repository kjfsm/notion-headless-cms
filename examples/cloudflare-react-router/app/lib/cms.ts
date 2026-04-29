import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
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
    cache: cloudflareCache(env),
    renderer: embed.renderer,
    blocks: embed.blocks,
  });
}
