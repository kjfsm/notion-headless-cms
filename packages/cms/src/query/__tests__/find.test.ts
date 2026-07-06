import { describe, expect, it, vi } from "vitest";

import { createEntryStore } from "../../store/entry-store.js";
import { memoryIndexStore } from "../../store/index-store.js";
import { memoryBlobStore } from "../../store/memory.js";
import type { VersionedCacheLike } from "../../store/versioned-cache.js";
import { createVersionedCacheLayer } from "../../store/versioned-cache.js";
import type { EntrySnapshot } from "../../types/entry-snapshot.js";
import { findEntry } from "../find.js";

function snapshot(overrides: Partial<EntrySnapshot> = {}): EntrySnapshot<{ title: string }> {
  return {
    collection: "posts",
    slug: "hello",
    version: "v1",
    meta: { title: "Hello" },
    blocks: [],
    images: {},
    links: {},
    ...overrides,
  } as EntrySnapshot<{ title: string }>;
}

describe("findEntry", () => {
  it("index にあり R2 にも entry があれば返す(キャッシュヒット時は Notion API を一切呼ばない)", async () => {
    const indexStore = memoryIndexStore();
    const entryStore = createEntryStore(memoryBlobStore());
    await indexStore.upsertEntry("posts", {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: {},
    });
    await entryStore.put(snapshot());

    const notionFetch = vi.fn();
    const result = await findEntry(
      { entryStore, indexStore, coldStartFetch: notionFetch },
      "posts",
      "hello",
    );

    expect(result?.slug).toBe("hello");
    expect(notionFetch).not.toHaveBeenCalled();
  });

  it("index に無ければ coldStartFetch にフォールバックする(コールドスタート)", async () => {
    const indexStore = memoryIndexStore();
    const entryStore = createEntryStore(memoryBlobStore());
    const coldStartFetch = vi.fn().mockResolvedValue(snapshot());

    const result = await findEntry({ entryStore, indexStore, coldStartFetch }, "posts", "hello");
    expect(result?.slug).toBe("hello");
    expect(coldStartFetch).toHaveBeenCalledWith("posts", "hello");
  });

  it("coldStartFetch が無い場合、未マテリアライズなら null を返す", async () => {
    const indexStore = memoryIndexStore();
    const entryStore = createEntryStore(memoryBlobStore());
    const result = await findEntry({ entryStore, indexStore }, "posts", "hello");
    expect(result).toBeNull();
  });

  it("index にあるが R2 に entry が無い不整合を検知して警告する", async () => {
    const indexStore = memoryIndexStore();
    const entryStore = createEntryStore(memoryBlobStore());
    await indexStore.upsertEntry("posts", {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: {},
    });
    // entryStore.put を呼ばず、index だけ存在する不整合状態を作る。
    const warn = vi.fn();

    const result = await findEntry({ entryStore, indexStore, logger: { warn } }, "posts", "hello");

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("不整合"),
      expect.objectContaining({
        operation: "find",
        collection: "posts",
        slug: "hello",
      }),
    );
  });

  it("versioned cache にヒットすればそこから返す(R2 を読まない)", async () => {
    const indexStore = memoryIndexStore();
    const entryStore = createEntryStore(memoryBlobStore());
    await indexStore.upsertEntry("posts", {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: {},
    });

    const store = new Map<string, Response>();
    const cache: VersionedCacheLike = {
      match: async (req) => store.get(req),
      put: async (req, res) => {
        store.set(req, res);
      },
    };
    const versionedCache = createVersionedCacheLayer({ cache });
    await versionedCache.put(
      "posts",
      "hello",
      "v1",
      new Response(JSON.stringify(snapshot({ meta: { title: "Cached" } }))),
    );

    const entryGetSpy = vi.spyOn(entryStore, "get");
    const result = await findEntry({ entryStore, indexStore, versionedCache }, "posts", "hello");
    expect((result!.meta as { title: string }).title).toBe("Cached");
    expect(entryGetSpy).not.toHaveBeenCalled();
  });

  it("戻り値は JSON.stringify / structuredClone ラウンドトリップ可能", async () => {
    const indexStore = memoryIndexStore();
    const entryStore = createEntryStore(memoryBlobStore());
    await indexStore.upsertEntry("posts", {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: {},
    });
    await entryStore.put(snapshot());

    const result = await findEntry({ entryStore, indexStore }, "posts", "hello");
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(structuredClone(result)).toEqual(result);
  });
});
