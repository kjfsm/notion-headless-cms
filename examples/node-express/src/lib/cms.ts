import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
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
      blocks: embed.blocks,
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
