import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
import { markdownFetcher } from "@notion-headless-cms/fetch-markdown";
import {
  createClient,
  nodePreset,
  notionSource,
} from "@notion-headless-cms/node";
import { schema } from "../generated/nhc.js";

const token = process.env.NOTION_TOKEN;
if (!token) {
  throw new Error("NOTION_TOKEN env が設定されていません。");
}

const embed = notionEmbed({
  providers: [youtubeProvider({ display: "card" })],
});

export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token,
      // Notion Markdown export API を 1 リクエストで叩く戦略。
      // `blocks: embed.blocks` (notion-to-md カスタムハンドラ) は block tree 戦略
      // 前提なので md 戦略では適用されない。embed の HTML 化は renderer 側で行う。
      fetch: markdownFetcher(),
      publishOptions: {
        posts: {
          publishedStatuses: ["公開済み"],
          accessibleStatuses: ["下書き", "編集中", "公開済み"],
        },
      },
    }),
  },
  ...nodePreset(),
  renderer: embed.renderer,
});
