import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "../generated/nhc.js";

export const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN ?? "",
  cache: [memoryCache()],
  swr: { ttlMs: 5 * 60_000 },
});
