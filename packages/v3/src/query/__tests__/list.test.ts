import { describe, expect, it } from "vitest";
import { createIndexStore } from "../../store/index-store.js";
import { memoryDocStore } from "../../store/memory.js";
import type { IndexEntry } from "../../types/collection-index.js";
import { listEntries } from "../list.js";

function entry(
  slug: string,
  listed: boolean,
  meta: Record<string, unknown> = {},
): IndexEntry {
  return { slug, version: "v1", listed, meta: meta as IndexEntry["meta"] };
}

describe("listEntries", () => {
  it("listed: false の entry(限定公開)は list から除外される", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", true));
    await store.upsertEntry("posts", entry("b", false));
    const result = await listEntries(store, "posts", {});
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("where で絞り込める", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", true, { status: "published" }));
    await store.upsertEntry("posts", entry("b", true, { status: "review" }));
    const result = await listEntries(store, "posts", {
      where: { status: { equals: "published" } },
    });
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("sort で並べ替えられる", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", true, { order: 2 }));
    await store.upsertEntry("posts", entry("b", true, { order: 1 }));
    const result = await listEntries(store, "posts", {
      sort: [{ by: "order", direction: "asc" }],
    });
    expect(result.items.map((e) => e.slug)).toEqual(["b", "a"]);
  });

  it("cursor ページネーションが動く", async () => {
    const store = createIndexStore(memoryDocStore());
    for (let i = 0; i < 5; i++) {
      await store.upsertEntry("posts", entry(`slug-${i}`, true, { order: i }));
    }
    const page1 = await listEntries(store, "posts", {
      limit: 2,
      sort: [{ by: "order", direction: "asc" }],
    });
    expect(page1.items.map((e) => e.slug)).toEqual(["slug-0", "slug-1"]);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listEntries(store, "posts", {
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
      sort: [{ by: "order", direction: "asc" }],
    });
    expect(page2.items.map((e) => e.slug)).toEqual(["slug-2", "slug-3"]);

    const page3 = await listEntries(store, "posts", {
      limit: 2,
      cursor: page2.nextCursor ?? undefined,
      sort: [{ by: "order", direction: "asc" }],
    });
    expect(page3.items.map((e) => e.slug)).toEqual(["slug-4"]);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();
  });

  it("limit に負数を渡しても 0 件クランプで安全に扱う(cursor 同様の符号サニタイズ)", async () => {
    const store = createIndexStore(memoryDocStore());
    await store.upsertEntry("posts", entry("a", true));
    const result = await listEntries(store, "posts", { limit: -5 });
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(true);
  });

  it("空コレクションは空配列を返す", async () => {
    const store = createIndexStore(memoryDocStore());
    const result = await listEntries(store, "posts", {});
    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});
