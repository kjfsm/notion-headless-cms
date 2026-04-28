import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createCMS } from "../generated/nhc";

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
export const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN ?? "",
  cache: [nextCache({ revalidate: 300, tags: ["posts"] }), memoryCache()],
});
