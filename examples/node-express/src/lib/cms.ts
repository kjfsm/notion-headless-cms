import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS as createCore } from "@notion-headless-cms/core";
import {
  notionEmbed,
  youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import { postsDataSourceId, postsProperties } from "../generated/nhc.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
  throw new Error("NOTION_TOKEN env が設定されていません。");
}

// notion-embed で OGP カードや YouTube カード描画を有効化する。
// embed.blocks を使うため、生成物の createCMS ラッパーではなく低レベルの core createCMS を直接呼ぶ。
const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

export const cms = createCore({
  cache: memoryCache(),
  ttlMs: 5 * 60_000,
  renderer: embed.renderer,
  collections: {
    posts: {
      source: createNotionCollection({
        token,
        dataSourceId: postsDataSourceId,
        properties: postsProperties,
        blocks: embed.blocks,
      }),
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["公開済み"],
    },
  },
});
