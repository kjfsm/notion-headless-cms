import {
  markdownFetcher,
  notionMarkdownRenderer,
} from "@notion-headless-cms/fetch-markdown";
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

export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token,
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
  renderer: notionMarkdownRenderer,
});
