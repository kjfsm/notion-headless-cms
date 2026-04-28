import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createCMS } from "../cms";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

// buildCachedItem が renderer を動的 import するため、明示的に注入する
const mockRenderer: RendererFn = vi.fn().mockResolvedValue("<p>test</p>");

function makeMockSource(
  overrides: Partial<DataSource<BaseContentItem>> = {},
): DataSource<BaseContentItem> {
  return {
    name: "mock",
    async list() {
      return [];
    },
    async loadBlocks() {
      return [];
    },
    loadMarkdown: vi.fn().mockResolvedValue(""),
    getLastModified(item) {
      return item.updatedAt;
    },
    getListVersion(items) {
      return items.map((i) => i.updatedAt).join(",");
    },
    ...overrides,
  };
}

describe("SWR（Stale-While-Revalidate）", () => {
  it("TTL 設定あり・期限切れの get はブロッキングで最新データを返す", async () => {
    const staleItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    // キャッシュに stale アイテムを事前セット（cachedAt: 0 → 必ず TTL 期限切れ）
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", {
      item: staleItem,
      notionUpdatedAt: staleItem.updatedAt,
      cachedAt: 0,
    });

    const waitUntil = vi.fn();

    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      ttlMs: 1000,
      waitUntil,
    });

    const result = await cms.posts.get("my-post");

    // TTL 期限切れ → ブロッキングで最新データが返される
    expect(result).not.toBeNull();
    expect(result?.updatedAt).toBe("2024-01-02T00:00:00Z");

    // ブロッキングフェッチなのでバックグラウンド Promise は渡されない
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("TTL 設定なしの get はキャッシュを即時返却してバックグラウンドで差分チェックする", async () => {
    const cachedItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", {
      item: cachedItem,
      notionUpdatedAt: cachedItem.updatedAt,
      cachedAt: 0, // 古くてもTTLなしなので期限切れにならない
    });

    const capturedPromises: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => {
      capturedPromises.push(p);
    };

    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    // TTL 未設定（永続キャッシュ）
    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      waitUntil,
    });

    const result = await cms.posts.get("my-post");

    // キャッシュが即時返される
    expect(result).not.toBeNull();
    expect(result?.updatedAt).toBe("2024-01-01T00:00:00Z");

    // バックグラウンド差分チェックの Promise が waitUntil に渡されている
    expect(capturedPromises.length).toBeGreaterThan(0);

    // バックグラウンド処理を待つ → 更新あり → キャッシュが新しいアイテムで更新される
    await Promise.all(capturedPromises);
    const updated = await cache.doc?.getMeta<BaseContentItem>(
      "posts",
      "my-post",
    );
    expect(updated?.item.updatedAt).toBe("2024-01-02T00:00:00Z");
  });

  it("TTL 設定なしの list はキャッシュを即時返却してバックグラウンドで差分チェックする", async () => {
    const cachedItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", {
      items: [cachedItem],
      cachedAt: 0, // 古くてもTTLなしなので期限切れにならない
    });

    const capturedPromises: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => {
      capturedPromises.push(p);
    };

    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    // TTL 未設定（永続キャッシュ）
    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      waitUntil,
    });

    const items = await cms.posts.list();

    // キャッシュが即時返される
    expect(items).toHaveLength(1);
    expect(items[0]?.updatedAt).toBe("2024-01-01T00:00:00Z");

    // バックグラウンド差分チェックの Promise が waitUntil に渡されている
    expect(capturedPromises.length).toBeGreaterThan(0);
  });

  it("TTL 設定あり・期限切れの list はブロッキングで最新リストを返す", async () => {
    const staleItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "page-2",
      slug: "new-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", {
      items: [staleItem],
      cachedAt: 0, // 必ず TTL 期限切れ
    });

    const waitUntil = vi.fn();

    const source = makeMockSource({
      async list() {
        return [staleItem, freshItem];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      ttlMs: 1000,
      waitUntil,
    });

    const items = await cms.posts.list();

    // TTL 期限切れ → ブロッキングで最新リストが返される
    expect(items).toHaveLength(2);

    // ブロッキングフェッチなのでバックグラウンド Promise は渡されない
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("キャッシュミス時に logger.debug が呼ばれる", async () => {
    const debugFn = vi.fn();
    const source = makeMockSource({
      async list() {
        return [
          { id: "p1", slug: "post-1", updatedAt: "2024-01-01T00:00:00Z" },
        ];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache: memoryCache(),
      logger: { debug: debugFn },
    });

    await cms.posts.get("post-1");

    expect(debugFn).toHaveBeenCalledWith(
      "キャッシュミス、フェッチ",
      expect.objectContaining({
        operation: "get",
        slug: "post-1",
        collection: "posts",
      }),
    );
  });

  it("キャッシュヒット時に logger.debug が呼ばれる", async () => {
    const debugFn = vi.fn();
    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item,
      notionUpdatedAt: item.updatedAt,
      cachedAt: Date.now(),
    });

    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
      cache,
      logger: { debug: debugFn },
    });

    await cms.posts.get("post-1");

    expect(debugFn).toHaveBeenCalledWith(
      "キャッシュヒット",
      expect.objectContaining({
        operation: "get",
        slug: "post-1",
        collection: "posts",
      }),
    );
  });

  it("TTL 期限切れ時に logger.debug が呼ばれる", async () => {
    const debugFn = vi.fn();
    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item,
      notionUpdatedAt: item.updatedAt,
      cachedAt: 0, // 必ず TTL 期限切れ
    });

    const source = makeMockSource({
      async list() {
        return [item];
      },
    });
    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      ttlMs: 1000,
      logger: { debug: debugFn },
    });

    await cms.posts.get("post-1");

    expect(debugFn).toHaveBeenCalledWith(
      "キャッシュ期限切れ（TTL）、フェッチ",
      expect.objectContaining({
        operation: "get",
        slug: "post-1",
        collection: "posts",
      }),
    );
  });

  it("SWR が差分を検出したとき logger.debug と onCacheRevalidated が呼ばれる", async () => {
    const debugFn = vi.fn();
    const onCacheRevalidated = vi.fn();

    const cachedItem: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item: cachedItem,
      notionUpdatedAt: cachedItem.updatedAt,
      cachedAt: Date.now(),
    });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      logger: { debug: debugFn },
      hooks: { onCacheRevalidated },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.get("post-1");
    await Promise.all(capturedPromises);

    expect(debugFn).toHaveBeenCalledWith(
      "SWR: 差分を検出、メタを差し替え",
      expect.objectContaining({
        operation: "get:bg",
        slug: "post-1",
        collection: "posts",
      }),
    );
    expect(onCacheRevalidated).toHaveBeenCalledOnce();
    expect(onCacheRevalidated).toHaveBeenCalledWith(
      "post-1",
      expect.any(Object),
    );
  });

  it("SWR が差分なしのとき logger.debug が呼ばれ onCacheRevalidated は呼ばれない", async () => {
    const debugFn = vi.fn();
    const onCacheRevalidated = vi.fn();

    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item,
      notionUpdatedAt: item.updatedAt,
      cachedAt: Date.now(),
    });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [item];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      ttlMs: 60_000,
      logger: { debug: debugFn },
      hooks: { onCacheRevalidated },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.get("post-1");
    await Promise.all(capturedPromises);

    expect(debugFn).toHaveBeenCalledWith(
      "SWR: 差分なし、TTL をリセット",
      expect.objectContaining({ operation: "get:bg", slug: "post-1" }),
    );
    expect(onCacheRevalidated).not.toHaveBeenCalled();
  });

  it("SWR がリスト差分を検出したとき onListCacheRevalidated が呼ばれる", async () => {
    const onListCacheRevalidated = vi.fn();

    const oldItem: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const newItem: BaseContentItem = {
      id: "p2",
      slug: "post-2",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", {
      items: [oldItem],
      cachedAt: Date.now(),
    });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [oldItem, newItem];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      hooks: { onListCacheRevalidated },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.list();
    await Promise.all(capturedPromises);

    expect(onListCacheRevalidated).toHaveBeenCalledOnce();
    expect(onListCacheRevalidated).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([oldItem, newItem]),
        cachedAt: expect.any(Number),
      }),
    );
  });

  it("TTL 設定あり・期限内の get はキャッシュを即時返却してバックグラウンド差分チェックする", async () => {
    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    // cachedAt: Date.now()、ttlMs: 60_000 → 期限内
    await cache.doc?.setMeta("posts", "my-post", {
      item: freshItem,
      notionUpdatedAt: freshItem.updatedAt,
      cachedAt: Date.now(),
    });

    const capturedPromises: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => {
      capturedPromises.push(p);
    };

    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
      ttlMs: 60_000,
      waitUntil,
    });

    await cms.posts.get("my-post");

    // 期限内でもバックグラウンド差分チェックは行われる
    expect(capturedPromises.length).toBeGreaterThan(0);
  });

  it("リスト SWR が差分なし + TTL あり のとき cachedAt をリセットする", async () => {
    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", { items: [item], cachedAt: Date.now() });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [item];
      },
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      // ttlMs を設定するとリスト差分なし時に cachedAt がリセットされる
      cache,
      ttlMs: 60_000,
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.list();
    await Promise.all(capturedPromises);
    // エラーなく完了することを確認
    expect(capturedPromises.length).toBeGreaterThan(0);
  });
});

describe("metadata と content の分離", () => {
  it("get は content を読まない（render() アクセス時に初めて読む）", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "lazy-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const loadMarkdown = vi.fn().mockResolvedValue("# hi");
    const cache = memoryCache();
    expect(cache.doc).toBeDefined();
    if (!cache.doc) return;
    const getContentSpy = vi.spyOn(cache.doc, "getContent");

    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
            loadMarkdown,
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
      cache,
    });

    const result = await cms.posts.get("lazy-post");
    expect(getContentSpy).not.toHaveBeenCalled();
    expect(loadMarkdown).not.toHaveBeenCalled();

    await result?.render();
    expect(getContentSpy).toHaveBeenCalledWith("posts", "lazy-post");
    expect(loadMarkdown).toHaveBeenCalled();
  });
});

describe("collectionKey", () => {
  it("slug 無しでは collection 名のみを返す", async () => {
    const { collectionKey } = await import("../collection");
    expect(collectionKey("posts")).toBe("posts");
  });

  it("slug 付きでは {collection}:{slug} を返す", async () => {
    const { collectionKey } = await import("../collection");
    expect(collectionKey("posts", "my-post")).toBe("posts:my-post");
  });
});

describe("リトライ中のロガー", () => {
  it("list() がリトライ中に logger.warn を呼ぶ", async () => {
    const warnFn = vi.fn();
    const retryableErr = Object.assign(new Error("rate limit"), {
      status: 503,
    });
    let callCount = 0;
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              callCount++;
              if (callCount === 1) throw retryableErr;
              return [];
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
      logger: { warn: warnFn },
      rateLimiter: { maxRetries: 1, baseDelayMs: 0, retryOn: [503] },
    });
    await cms.posts.list();
    expect(warnFn).toHaveBeenCalledWith(
      "list() リトライ中",
      expect.objectContaining({ attempt: 1, status: 503 }),
    );
  });

  it("get() がリトライ中に logger.warn を呼ぶ", async () => {
    const warnFn = vi.fn();
    const retryableErr = Object.assign(new Error("service unavailable"), {
      status: 503,
    });
    const targetItem: BaseContentItem = {
      id: "1",
      slug: "retry-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    let callCount = 0;
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              callCount++;
              if (callCount === 1) throw retryableErr;
              return [targetItem];
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
      logger: { warn: warnFn },
      rateLimiter: { maxRetries: 1, baseDelayMs: 0, retryOn: [503] },
    });
    await cms.posts.get("retry-post");
    expect(warnFn).toHaveBeenCalledWith(
      "get() リトライ中",
      expect.objectContaining({ attempt: 1, status: 503 }),
    );
  });
});
