/**
 * Cloudflare Workers 向けの実装を集約するエントリ(`KVNamespaceLike`/`R2BucketLike` は
 * 構造型のため `@cloudflare/workers-types` への実依存はない)。
 * 汎用の `.` エントリからは分離する — Node 専用ランタイム(Workers 以外)の利用者には
 * 不要な公開面のため。
 */
import type { CreateCMSStoresOptions } from "./cms/create-cms.js";
import { kvDocStore, r2BlobStore } from "./store/cloudflare.js";
import type {
  KVNamespaceLike,
  R2BucketLike,
} from "./store/cloudflare-types.js";
import { memoryBlobStore, memoryDocStore } from "./store/memory.js";
import {
  createVersionedCacheLayer,
  type VersionedCacheLayer,
  type VersionedCacheLike,
} from "./store/versioned-cache.js";

export { kvDocStore, r2BlobStore } from "./store/cloudflare.js";
export type {
  KVNamespaceLike,
  R2BucketLike,
  R2HeadResultLike,
  R2ObjectLike,
} from "./store/cloudflare-types.js";
export type {
  VersionedCacheLayer,
  VersionedCacheLike,
} from "./store/versioned-cache.js";
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
 * createCMS({ stores: { docs, blobs, versionedCache: edgeVersionedCache(cache) } });
 */
export function edgeVersionedCache(
  cache?: VersionedCacheLike,
): VersionedCacheLayer {
  return createVersionedCacheLayer({ cache });
}

/**
 * `env` のバインディング有無を見て `createCMS({ stores })` を組み立てるヘルパー。
 * バインディングがある slot は KV/R2 ストア、無い slot は in-memory ストアに落ちるため、
 * KV/R2 未設定のプレビュー・ローカルでもそのまま動作する（progressive enhancement）。
 *
 * @param bindings - `docs`(KV)/`blobs`(R2)/`cache`(Cache API) のバインディング。いずれも任意。
 * @returns `createCMS({ stores })` に渡せる `CreateCMSStoresOptions`
 *
 * @example
 * // KV/R2 があれば永続化・高速化、無ければメモリで動く
 * const cache = typeof caches === "undefined" ? undefined : caches.default;
 * createCMS({
 *   schema,
 *   notion: { token: env.NOTION_TOKEN },
 *   stores: cloudflareStores({ docs: env.DOC_CACHE, blobs: env.IMG_BUCKET, cache }),
 * });
 */
export function cloudflareStores(bindings: {
  docs?: KVNamespaceLike;
  blobs?: R2BucketLike;
  cache?: VersionedCacheLike;
}): CreateCMSStoresOptions {
  return {
    docs: bindings.docs ? kvDocStore(bindings.docs) : memoryDocStore(),
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
