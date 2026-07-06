import type { EntryStore } from "../store/entry-store.js";
import type { IndexStore } from "../store/index-store.js";
import type { VersionedCacheLayer } from "../store/versioned-cache.js";
import type { EntrySnapshot } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";

export type ColdStartFetch = (collection: string, slug: string) => Promise<EntrySnapshot | null>;

export interface FindDeps {
  readonly entryStore: EntryStore;
  readonly indexStore: IndexStore;
  readonly versionedCache?: VersionedCacheLayer;
  /** index/entry が未マテリアライズの場合のみ、SyncCoordinator 経由で 1 回だけブロッキング取得する。 */
  readonly coldStartFetch?: ColdStartFetch;
}

/**
 * `find(slug)`: KV index で version/存在確認 → R2 から EntrySnapshot を読んで返す。
 * 戻り値は完全にプレーンな JSON(loader からそのまま `return { post }` できる)。
 * キャッシュヒット時、このパスは Notion API を一切呼ばない(#437 の北極星)。
 */
export async function findEntry<Meta extends JsonValue = JsonValue>(
  deps: FindDeps,
  collection: string,
  slug: string,
): Promise<EntrySnapshot<Meta> | null> {
  const indexed = await deps.indexStore.findEntry(collection, slug);
  if (!indexed) {
    return deps.coldStartFetch
      ? ((await deps.coldStartFetch(collection, slug)) as EntrySnapshot<Meta> | null)
      : null;
  }

  if (deps.versionedCache) {
    const cached = await deps.versionedCache.get(collection, slug, indexed.version);
    if (cached) return (await cached.json()) as EntrySnapshot<Meta>;
  }

  const snapshot = await deps.entryStore.get<Meta>(collection, slug);
  if (!snapshot) {
    // index にはあるが R2 に無い(同期タイミングのズレ)。コールドスタート経路にフォールバックする。
    return deps.coldStartFetch
      ? ((await deps.coldStartFetch(collection, slug)) as EntrySnapshot<Meta> | null)
      : null;
  }

  if (deps.versionedCache) {
    await deps.versionedCache.put(
      collection,
      slug,
      indexed.version,
      new Response(JSON.stringify(snapshot), {
        headers: { "content-type": "application/json" },
      }),
    );
  }

  return snapshot;
}
