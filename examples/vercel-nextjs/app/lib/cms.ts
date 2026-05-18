import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import {
  markdownFetcher,
  notionMarkdownRenderer,
} from "@notion-headless-cms/fetch-markdown";
import { createClient, notionSource } from "@notion-headless-cms/next";
import { schema } from "@/app/generated/nhc";

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
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
  // markdownFetcher が返す Notion enhanced markdown を理解する renderer。
  renderer: notionMarkdownRenderer,
  cache: [nextCache({ tags: ["posts"] }), memoryCache()],
  imageProxyBase: "/api/cms/images",
});
