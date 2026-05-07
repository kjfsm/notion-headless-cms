import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createClient } from "@notion-headless-cms/core";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "@/app/generated/nhc";

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN ?? "",
      blocks: embed.blocks,
      publishOptions: {
        posts: {
          publishedStatuses: ["公開済み"],
          accessibleStatuses: ["下書き", "編集中", "公開済み"],
        },
      },
    }),
  },
  renderer: embed.renderer,
  cache: [nextCache({ tags: ["posts"] }), memoryCache()],
});
