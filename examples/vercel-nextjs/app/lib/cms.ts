import { notionEmbed, youtubeProvider } from "@notion-headless-cms/block-html";
import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { markdownFetcher } from "@notion-headless-cms/fetch-markdown";
import { createClient, notionSource } from "@notion-headless-cms/next";
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
      // Notion Markdown export API を 1 リクエストで叩く戦略。
      // notion-shiki などの block-tree 前提の enricher は適用されないため、
      // code ブロックのハイライトが必要なら markdown→HTML 側の renderer
      // (rehype-shiki など) で行う。
      fetch: markdownFetcher(),
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
  // 統合ハンドラ (/app/api/cms/[...path]/route.ts) のマウントパスに合わせる。
  imageProxyBase: "/api/cms/images",
});
