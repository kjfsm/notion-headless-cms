import type { MemoryCacheOptions } from "../cache/memory";
import { memoryCache } from "../cache/memory";
import type { CacheAdapter, SWRConfig } from "../types/index";

/** `nodePreset()` のオプション。 */
export interface NodePresetOptions {
  /** メモリキャッシュの設定。 */
  cache?: MemoryCacheOptions;
  /** SWR（Stale-While-Revalidate）設定。デフォルト: ttlMs 5 分。 */
  swr?: SWRConfig;
}

/**
 * Node.js 向け `createClient` プリセット。
 * `memoryCache()` と SWR 設定をひとまとめに返す。
 *
 * @example
 * import { createClient, nodePreset } from "@notion-headless-cms/core";
 * import { notionSource } from "@notion-headless-cms/notion-source";
 * import { schema } from "./generated/nhc.schema";
 *
 * const cms = createClient({
 *   sources: { notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }) },
 *   ...nodePreset(),
 * });
 */
export function nodePreset(opts: NodePresetOptions = {}): {
  cache: CacheAdapter[];
  swr: SWRConfig;
} {
  return {
    cache: [memoryCache(opts.cache)],
    swr: opts.swr ?? { ttlMs: 5 * 60_000 },
  };
}
