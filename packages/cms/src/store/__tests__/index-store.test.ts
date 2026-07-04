import { describe, expect, it } from "vitest";
import type { IndexEntry } from "../../types/collection-index.js";
import type { JsonValue } from "../../types/json-value.js";
import { createIndexStore } from "../index-store.js";
import { memoryDocStore } from "../memory.js";

function entry(
  slug: string,
  version: string,
  opts: { listed?: boolean; meta?: JsonValue } = {},
): IndexEntry {
  return {
    slug,
    version,
    listed: opts.listed ?? true,
    meta: opts.meta ?? {},
  };
}

function spyPutCount(docs: ReturnType<typeof memoryDocStore>): () => number {
  let count = 0;
  const originalPut = docs.put.bind(docs);
  docs.put = async (key, value) => {
    count++;
    return originalPut(key, value);
  };
  return () => count;
}

describe("createIndexStore", () => {
  it("新規 entry は findEntry/listEntries の両方に反映される", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1"));
    expect(await store.findEntry("posts", "a")).toEqual(entry("a", "v1"));
    const result = await store.listEntries("posts", {});
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("同一 version の upsert は書き込まない(差分検知)", async () => {
    const docs = memoryDocStore();
    const putCount = spyPutCount(docs);
    const store = createIndexStore(docs);
    await store.upsertEntry("posts", entry("a", "v1"));
    expect(putCount()).toBe(2); // 点読みキー + マニフェスト(新規追加)

    const result = await store.upsertEntry("posts", entry("a", "v1"));
    expect(result.wrote).toBe(false);
    expect(putCount()).toBe(2); // 追加の書き込みは発生しない
  });

  it("version のみ変化し meta/listed が不変の更新(内容編集)は点読みキーだけ書き込む", async () => {
    const docs = memoryDocStore();
    const meta = { title: "同じタイトル" };
    const store = createIndexStore(docs);
    await store.upsertEntry("posts", entry("a", "v1", { meta }));

    const putCount = spyPutCount(docs);
    const result = await store.upsertEntry("posts", entry("a", "v2", { meta }));
    expect(result.wrote).toBe(true);
    expect(putCount()).toBe(1); // 点読みキーのみ、マニフェストへの書き込みは無い

    expect((await store.findEntry("posts", "a"))?.version).toBe("v2");
    // マニフェスト側は meta/listed が不変なので古い version のままでよい(find() が真の鮮度を保証する)。
    const listed = await store.listAllEntries("posts");
    expect(listed[0]?.version).toBe("v1");
  });

  it("meta が変化した更新はマニフェストも書き込む", async () => {
    const docs = memoryDocStore();
    const store = createIndexStore(docs);
    await store.upsertEntry(
      "posts",
      entry("a", "v1", { meta: { title: "旧" } }),
    );

    const putCount = spyPutCount(docs);
    await store.upsertEntry(
      "posts",
      entry("a", "v2", { meta: { title: "新" } }),
    );
    expect(putCount()).toBe(2); // 点読みキー + マニフェスト

    const listed = await store.listAllEntries("posts");
    expect(listed[0]?.meta).toEqual({ title: "新" });
    expect(listed[0]?.version).toBe("v2");
  });

  it("listed が変化した更新はマニフェストも書き込む", async () => {
    const docs = memoryDocStore();
    const store = createIndexStore(docs);
    await store.upsertEntry("posts", entry("a", "v1", { listed: true }));

    const putCount = spyPutCount(docs);
    await store.upsertEntry("posts", entry("a", "v2", { listed: false }));
    expect(putCount()).toBe(2);

    const result = await store.listEntries("posts", {});
    expect(result.items).toHaveLength(0); // listed:false は list() から隠れる
    expect(await store.findEntry("posts", "a")).not.toBeNull(); // find() は通す
  });

  it("removeEntry で点読みキーとマニフェストの両方から除去される", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1"));
    const result = await store.removeEntry("posts", "a");
    expect(result.wrote).toBe(true);
    expect(await store.findEntry("posts", "a")).toBeNull();
    expect(await store.listAllEntries("posts")).toHaveLength(0);
  });

  it("存在しない slug の removeEntry は書き込まない", async () => {
    const store = createIndexStore(memoryDocStore());
    const result = await store.removeEntry("posts", "missing");
    expect(result.wrote).toBe(false);
  });

  it("listEntries は where/sort/pagination を評価する", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry(
      "posts",
      entry("a", "v1", { meta: { title: "A", order: 2 } }),
    );
    await store.upsertEntry(
      "posts",
      entry("b", "v1", { meta: { title: "B", order: 1 } }),
    );
    await store.upsertEntry(
      "posts",
      entry("c", "v1", { meta: { title: "C", order: 3 } }),
    );

    const sorted = await store.listEntries("posts", {
      sort: [{ by: "order", direction: "asc" }],
    });
    expect(sorted.items.map((e) => e.slug)).toEqual(["b", "a", "c"]);

    const filtered = await store.listEntries("posts", {
      where: { title: { equals: "B" } },
    });
    expect(filtered.items.map((e) => e.slug)).toEqual(["b"]);

    const paged = await store.listEntries("posts", { limit: 2 });
    expect(paged.items).toHaveLength(2);
    expect(paged.hasMore).toBe(true);
    expect(paged.nextCursor).toBe("2");
  });

  it("listSlugs は listed 問わず全 slug を返す(reconcile 用)", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1", { listed: true }));
    await store.upsertEntry("posts", entry("b", "v1", { listed: false }));
    expect(await store.listSlugs("posts")).toEqual(["a", "b"]);
  });

  it("コレクションが異なれば別々に管理される", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", "v1"));
    await store.upsertEntry("fixedPages", entry("a", "v1"));
    expect(await store.listSlugs("posts")).toEqual(["a"]);
    expect(await store.listSlugs("fixedPages")).toEqual(["a"]);
  });
});
