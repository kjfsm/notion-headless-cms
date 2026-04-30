import { memoryCache } from "@notion-headless-cms/cache";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { createCMS } from "../generated/nhc.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
  throw new Error("NOTION_TOKEN env が設定されていません。");
}

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

export const cms = createCMS({
  notionToken: token,
  cache: [memoryCache()],
  swr: { ttlMs: 5 * 60_000 },
  renderer: embed.renderer,
  blocks: embed.blocks,
});
