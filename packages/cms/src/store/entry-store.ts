import type { EntrySnapshot } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import type { BlobStore } from "./types.js";

function entryKey(collection: string, slug: string): string {
  return `entry/${collection}/${slug}.json`;
}

export interface EntryStore {
  get<Meta extends JsonValue = JsonValue>(
    collection: string,
    slug: string,
  ): Promise<EntrySnapshot<Meta> | null>;
  put(snapshot: EntrySnapshot): Promise<void>;
  delete(collection: string, slug: string): Promise<void>;
}

/**
 * R2(想定)上の EntrySnapshot 読み書き。
 *
 * fail-soft 不変条件: `put` は呼び出し側(同期エンジン、#441)がパイプライン全段
 * 成功後に組み立てた完成品を渡す契約になっている。`put` 自体は 1 キーへの単発
 * アトミック上書きなので、途中状態が読者に見えることはない
 * (直前の正常版 → 新版へ瞬時に切り替わるのみ)。世代管理は持たない。
 */
export function createEntryStore(blobs: BlobStore): EntryStore {
  return {
    async get<Meta extends JsonValue = JsonValue>(collection: string, slug: string) {
      const bytes = await blobs.get(entryKey(collection, slug));
      if (!bytes) return null;
      return JSON.parse(new TextDecoder().decode(bytes)) as EntrySnapshot<Meta>;
    },
    async put(snapshot) {
      const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
      await blobs.put(entryKey(snapshot.collection, snapshot.slug), bytes, {
        contentType: "application/json",
      });
    },
    async delete(collection, slug) {
      await blobs.delete(entryKey(collection, slug));
    },
  };
}
