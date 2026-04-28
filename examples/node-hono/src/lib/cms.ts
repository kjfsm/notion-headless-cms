import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "../generated/nhc.js";

// `nhc generate` で生成された createCMS にランタイム設定を渡す。
// TTL は createCMS の ttlMs (createCMS のオプション) で指定する。
export const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN ?? "",
  cache: memoryCache(),
  ttlMs: 5 * 60_000,
});
