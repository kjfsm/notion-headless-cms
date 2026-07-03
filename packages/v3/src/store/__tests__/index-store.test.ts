import { describe, expect, it } from "vitest";
import type { IndexEntry } from "../../types/collection-index.js";
import { createIndexStore } from "../index-store.js";
import { memoryDocStore } from "../memory.js";

function entry(slug: string, version: string, listed = true): IndexEntry {
  return { slug, version, listed, meta: {} };
}

describe("createIndexStore", () => {
  it("新規 entry を追加すると 1 シャードに乗る", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1"));
    const shards = await store.listShards("posts");
    expect(shards).toHaveLength(1);
    expect(shards[0]?.entries.map((e) => e.slug)).toEqual(["a"]);
  });

  it("shardSize を超えると新しいシャードに分割される", async () => {
    const store = createIndexStore(memoryDocStore(), 2);
    await store.upsertEntry("posts", entry("a", "v1"));
    await store.upsertEntry("posts", entry("b", "v1"));
    await store.upsertEntry("posts", entry("c", "v1"));
    const shards = await store.listShards("posts");
    expect(shards).toHaveLength(2);
    expect(shards[0]?.entries).toHaveLength(2);
    expect(shards[1]?.entries).toHaveLength(1);
  });

  it("version/listed に変更が無い upsert は書き込まない(差分検知)", async () => {
    const docs = memoryDocStore();
    const putSpy = docs.put;
    let putCount = 0;
    docs.put = async (...args) => {
      putCount++;
      return putSpy.apply(docs, args);
    };
    const store = createIndexStore(docs);
    await store.upsertEntry("posts", entry("a", "v1"));
    expect(putCount).toBe(1);

    const result = await store.upsertEntry("posts", entry("a", "v1"));
    expect(result.wrote).toBe(false);
    expect(putCount).toBe(1); // 追加の書き込みは発生しない
  });

  it("version が変わった upsert は書き込む", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1"));
    const result = await store.upsertEntry("posts", entry("a", "v2"));
    expect(result.wrote).toBe(true);
    const shards = await store.listShards("posts");
    expect(shards[0]?.entries[0]?.version).toBe("v2");
  });

  it("N entry 中 1 entry の更新は KV 書き込みが O(1)(シャード 1 枚のみ)", async () => {
    const docs = memoryDocStore();
    let putCount = 0;
    const originalPut = docs.put.bind(docs);
    docs.put = async (key, value) => {
      putCount++;
      return originalPut(key, value);
    };
    const store = createIndexStore(docs, 500);
    for (let i = 0; i < 50; i++) {
      await store.upsertEntry("posts", entry(`slug-${i}`, "v1"));
    }
    putCount = 0; // 初期投入分をリセットして計測対象を絞る
    const result = await store.upsertEntry("posts", entry("slug-25", "v2"));
    expect(result.wrote).toBe(true);
    expect(putCount).toBe(1); // シャード 1 枚のみ書き込み
  });

  it("removeEntry で index から除去できる(削除・非公開化の検知経路)", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1"));
    const result = await store.removeEntry("posts", "a");
    expect(result.wrote).toBe(true);
    const shards = await store.listShards("posts");
    expect(shards[0]?.entries).toHaveLength(0);
  });

  it("存在しない slug の removeEntry は書き込まない", async () => {
    const store = createIndexStore(memoryDocStore());
    const result = await store.removeEntry("posts", "missing");
    expect(result.wrote).toBe(false);
  });
});
