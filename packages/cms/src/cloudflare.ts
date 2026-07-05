/**
 * Cloudflare Workers 向けの実装を集約するエントリ(`KVNamespaceLike`/`R2BucketLike` は
 * 構造型のため `@cloudflare/workers-types` への実依存はない)。
 * 汎用の `.` エントリからは分離する — Node 専用ランタイム(Workers 以外)の利用者には
 * 不要な公開面のため。
 */
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
