/**
 * Cloudflare Workers 向けの実装を集約するエントリ(`R2BucketLike` は構造型のため
 * `@cloudflare/workers-types` への実依存はない)。
 * 汎用の `.` エントリからは分離する — Node 専用ランタイム(Workers 以外)の利用者には
 * 不要な公開面のため。D1 を使った index ストアは `@notion-headless-cms/sql/d1` が提供する
 * （`cms` はゼロ依存原則のため Kysely 実装をここに持たない）。
 */
import type { CreateCMSStoresOptions } from "./cms/create-cms.js";
import type { R2BucketLike } from "./store/cloudflare-types.js";
import { r2BlobStore } from "./store/cloudflare.js";
import { memoryBlobStore } from "./store/memory.js";
import {
  createVersionedCacheLayer,
  type VersionedCacheLayer,
  type VersionedCacheLike,
} from "./store/versioned-cache.js";

export { r2BlobStore } from "./store/cloudflare.js";
export type { R2BucketLike, R2HeadResultLike, R2ObjectLike } from "./store/cloudflare-types.js";
export type { VersionedCacheLayer, VersionedCacheLike } from "./store/versioned-cache.js";
export type {
  DurableObjectNamespaceLike,
  DurableObjectStubLike,
  HibernatableWebSocketLike,
  RealtimeDurableObjectStateLike,
} from "./sync/durable-object-types.js";
export type {
  DurableObjectRealtimeOptions,
  ForwardRealtimeUpgradeOptions,
} from "./sync/realtime-hub-do.js";
export {
  broadcastToSockets,
  durableObjectRealtime,
  forwardRealtimeUpgrade,
  parseSubscribeChannel,
  RealtimeHubDO,
} from "./sync/realtime-hub-do.js";
export type {
  DurableObjectSyncDelegateNamespaceOptions,
  DurableObjectSyncDelegateOptions,
  DurableObjectSyncDelegateStubOptions,
  SyncCoordinatorCMS,
  SyncCoordinatorDOInstance,
  SyncCoordinatorDOOptions,
} from "./sync/sync-coordinator-do.js";
export {
  createSyncCoordinatorDO,
  durableObjectSyncDelegate,
  readerReadOnly,
} from "./sync/sync-coordinator-do.js";

/**
 * `caches.default`（Workers Cache API）を `find()` の version キャッシュ層として使うための糖衣。
 * `cache` は consumer が明示的に渡す（env を覗いて自動検出はしない）。未指定なら全経路 no-op に落ち、
 * 読者パスは KV+R2 の直読みで成立する。
 *
 * @example
 * // caches が使えない環境（プレビュー等）を考慮して optional chaining で渡す
 * const cache = typeof caches === "undefined" ? undefined : caches.default;
 * createCMS({ stores: { index, blobs, versionedCache: edgeVersionedCache(cache) } });
 */
export function edgeVersionedCache(cache?: VersionedCacheLike): VersionedCacheLayer {
  return createVersionedCacheLayer({ cache });
}

/**
 * `env` のバインディング有無を見て `createCMS({ stores })` を組み立てるヘルパー。
 * `blobs`(R2)は未指定なら in-memory ストアに落ちる（progressive enhancement）。
 * `index`(D1 等)は `@notion-headless-cms/sql/d1` の `d1IndexStore(env.DB, schema)` を
 * 呼び出し側で組み立てて `stores.index` に渡す（`cms` はゼロ依存原則のため Kysely
 * 実装をここに持てない）。
 *
 * @param bindings - `blobs`(R2)/`cache`(Cache API) のバインディング。いずれも任意。
 * @returns `createCMS({ stores })` に渡せる `CreateCMSStoresOptions` の一部（`index` は含まない）
 *
 * @example
 * // R2 があれば永続化、無ければメモリで動く。index は D1 を別途合成する。
 * const cache = typeof caches === "undefined" ? undefined : caches.default;
 * createCMS({
 *   schema,
 *   notion: { token: env.NOTION_TOKEN },
 *   stores: {
 *     ...cloudflareStores({ blobs: env.IMG_BUCKET, cache }),
 *     index: d1IndexStore(env.DB, schema),
 *   },
 * });
 */
export function cloudflareStores(bindings: {
  blobs?: R2BucketLike;
  cache?: VersionedCacheLike;
}): Omit<CreateCMSStoresOptions, "index"> {
  return {
    blobs: bindings.blobs ? r2BlobStore(bindings.blobs) : memoryBlobStore(),
    // cache 未指定なら versionedCache 自体を渡さない。`createVersionedCacheLayer`
    // は cache 無しでも no-op レイヤーを返すが、それでも find() 側の
    // `if (deps.versionedCache)` 分岐は真になり、実効ゼロの Response 生成
    // (`new Response(JSON.stringify(...))`)等が読者パスに乗ってしまうため。
    versionedCache: bindings.cache
      ? createVersionedCacheLayer({ cache: bindings.cache })
      : undefined,
  };
}
