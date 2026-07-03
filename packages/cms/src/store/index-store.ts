import type { CollectionIndex, IndexEntry } from "../types/collection-index.js";
import type { DocStore } from "./types.js";

/** 1 シャードあたりの最大エントリ数。KV 25MB 制限に対して十分小さく保つ。 */
const DEFAULT_SHARD_SIZE = 500;

function shardKey(collection: string, page: number): string {
  return `index:${collection}:${page}`;
}

export interface IndexStore {
  getShard(collection: string, page: number): Promise<CollectionIndex | null>;
  listShards(collection: string): Promise<CollectionIndex[]>;
  /** 該当 slug の entry を追加/更新する。差分が無ければ書き込みをスキップする。 */
  upsertEntry(
    collection: string,
    entry: IndexEntry,
  ): Promise<{ wrote: boolean }>;
  removeEntry(collection: string, slug: string): Promise<{ wrote: boolean }>;
}

/**
 * KV(想定)上のコレクション index 読み書き。`index:{collection}:{page}` にシャーディングする。
 * `upsertEntry` は version/listed に差分が無ければ書き込みをスキップし、
 * 「entry 更新 1 件 = index 書き込み高々 1 回」という KV 書き込み予算(1,000/日)の
 * 制約を満たす。
 */
export function createIndexStore(
  docs: DocStore,
  shardSize = DEFAULT_SHARD_SIZE,
): IndexStore {
  async function getShard(
    collection: string,
    page: number,
  ): Promise<CollectionIndex | null> {
    const raw = await docs.get(shardKey(collection, page));
    return raw ? (JSON.parse(raw) as CollectionIndex) : null;
  }

  async function listShards(collection: string): Promise<CollectionIndex[]> {
    const keys = await docs.list(`index:${collection}:`);
    const shards = await Promise.all(
      keys.map(async (key) => {
        const raw = await docs.get(key);
        return raw ? (JSON.parse(raw) as CollectionIndex) : null;
      }),
    );
    return shards
      .filter((s): s is CollectionIndex => s !== null)
      .sort((a, b) => a.page - b.page);
  }

  async function putShard(index: CollectionIndex): Promise<void> {
    await docs.put(
      shardKey(index.collection, index.page),
      JSON.stringify(index),
    );
  }

  return {
    getShard,
    listShards,
    async upsertEntry(collection, entry) {
      const shards = await listShards(collection);
      for (const shard of shards) {
        const idx = shard.entries.findIndex((e) => e.slug === entry.slug);
        if (idx === -1) continue;
        const existing = shard.entries[idx];
        if (
          existing &&
          existing.version === entry.version &&
          existing.listed === entry.listed
        ) {
          return { wrote: false };
        }
        const nextEntries = [...shard.entries];
        nextEntries[idx] = entry;
        await putShard({ ...shard, entries: nextEntries });
        return { wrote: true };
      }
      const target = shards.find((s) => s.entries.length < shardSize);
      if (target) {
        await putShard({ ...target, entries: [...target.entries, entry] });
      } else {
        const nextPage =
          shards.length > 0 ? Math.max(...shards.map((s) => s.page)) + 1 : 0;
        await putShard({ collection, page: nextPage, entries: [entry] });
      }
      return { wrote: true };
    },
    async removeEntry(collection, slug) {
      const shards = await listShards(collection);
      for (const shard of shards) {
        if (!shard.entries.some((e) => e.slug === slug)) continue;
        await putShard({
          ...shard,
          entries: shard.entries.filter((e) => e.slug !== slug),
        });
        return { wrote: true };
      }
      return { wrote: false };
    },
  };
}
