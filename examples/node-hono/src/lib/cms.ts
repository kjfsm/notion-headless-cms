import { markdownFetcher } from "@notion-headless-cms/fetch-markdown";
import {
  createClient,
  nodePreset,
  notionSource,
} from "@notion-headless-cms/node";
import { schema } from "../generated/nhc.js";

export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN ?? "",
      // Notion Markdown export API を 1 リクエストで叩く戦略。
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
});
