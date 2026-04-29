import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { createCMS } from "@/app/generated/nhc";

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
export const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN ?? "",
  renderer: embed.renderer,
  blocks: embed.blocks,
  cache: [nextCache({ tags: ["posts"] }), memoryCache()],
});
