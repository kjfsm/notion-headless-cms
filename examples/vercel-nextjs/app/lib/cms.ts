import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createCMS } from "@notion-headless-cms/client";
import { schema } from "@/app/generated/nhc";

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
export const cms = createCMS({
  schema,
  token: process.env.NOTION_TOKEN ?? "",
  content: "html",
  runtime: { cache: [nextCache({ tags: ["posts"] }), memoryCache()] },
  imageProxyBase: "/api/cms/images",
  collections: {
    posts: {
      published: ["公開済み"],
      accessible: ["下書き", "編集中", "公開済み"],
    },
  },
});
