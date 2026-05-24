import type {
  CacheAdapter,
  MemoryCacheOptions,
  SWRConfig,
} from "@notion-headless-cms/core";
import { createClient, memoryCache } from "@notion-headless-cms/core";
import type {
  NotionPublishOptions,
  NotionSourceConfig,
  SchemaMap,
} from "@notion-headless-cms/notion-source";
import { notionSource } from "@notion-headless-cms/notion-source";

export type { CMSClient, CMSGlobalOps } from "@notion-headless-cms/core";
export {
  CMSError,
  createClient,
  isCMSError,
  nodePreset,
} from "@notion-headless-cms/core";
export type {
  NotionPublishOptions,
  NotionSourceConfig,
} from "@notion-headless-cms/notion-source";
export { notionSource } from "@notion-headless-cms/notion-source";
export type { NextHandlerOptions } from "./next-handler";
export { createNextHandler } from "./next-handler";
export type {
  NextRevalidateResolver,
  NextWebhookOptions,
} from "./next-webhook";
export { createNextWebhookHandler } from "./next-webhook";

/** `nextPreset()` のオプション。Issue #313 (M2) で導入。 */
export interface NextPresetOptions {
  /** メモリキャッシュ設定。 */
  cache?: MemoryCacheOptions;
  /** SWR (Stale-While-Revalidate) 設定。デフォルト ttlMs 5 分。 */
  swr?: SWRConfig;
}

/**
 * Next.js (App Router) 向け `createClient` プリセット。`{ cache, swr }` を
 * 返し、`nodePreset` / `cloudflarePreset` と同じ契約に揃える (Issue #313 / M2)。
 *
 * `cache-next` で ISR キャッシュを使う場合は `nextPreset` を使わず
 * `createClient({ cache: [nextISRCache(...)], ... })` のように個別に組み立てる。
 *
 * @example
 * ```ts
 * import { createClient, nextPreset, notionSource } from "@notion-headless-cms/next";
 *
 * export const cms = createClient({
 *   sources: { notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }) },
 *   ...nextPreset(),
 * });
 * ```
 */
export function nextPreset(opts: NextPresetOptions = {}): {
  cache: CacheAdapter[];
  swr: SWRConfig;
} {
  return {
    cache: [memoryCache(opts.cache)],
    swr: opts.swr ?? { ttlMs: 5 * 60_000 },
  };
}

/** `createCms()` に渡すオプション（Next.js 向け）。 */
export interface CreateCmsOptions<S extends SchemaMap>
  extends Pick<NotionSourceConfig<S>, "fetch"> {
  schema: S;
  token: string;
  publishOptions?: { [K in keyof S]?: NotionPublishOptions };
}

/**
 * Next.js App Router 向け高レベル API。`notionSource` + `memoryCache` + `createClient` をまとめて呼ぶ。
 * 永続キャッシュが必要な場合は `createClient` を直接使い、`cache-next` アダプタを組み込むこと。
 *
 * @example
 * import { createCms } from "@notion-headless-cms/next";
 * import { schema } from "./generated/nhc.js";
 *
 * export const cms = createCms({
 *   schema,
 *   token: process.env.NOTION_TOKEN!,
 *   publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
 * });
 */
export function createCms<S extends SchemaMap>(opts: CreateCmsOptions<S>) {
  return createClient({
    sources: {
      notion: notionSource({
        schema: opts.schema,
        token: opts.token,
        ...(opts.fetch ? { fetch: opts.fetch } : {}),
        publishOptions: opts.publishOptions,
      }),
    },
    cache: [memoryCache()],
  });
}
