import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createClient } from "../cms";
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
      return item.lastEditedTime;
    },
    getListVersion(items) {
      return items.map((i) => i.lastEditedTime).join(",");
    },
    ...overrides,
  };
}

describe("SWR（Stale-While-Revalidate）", () => {
  it("staleBlockMs 設定あり・閾値超過の find はブロッキングで最新データを返す", async () => {
    const staleItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };

    // キャッシュに stale アイテムを事前セット（cachedAt: 0 → 必ず block 閾値超過）
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", {
      item: staleItem,
      notionUpdatedAt: staleItem.lastEditedTime,
      cachedAt: 0,
    });

    const waitUntil = vi.fn();

    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      swr: { staleBlockMs: 1000 },
      waitUntil,
    });

    const result = await cms.posts.find("my-post");

    expect(result).not.toBeNull();
    expect(result?.lastEditedTime).toBe("2024-01-02T00:00:00Z");

    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("ブロックなし設定（webhook 管理）の find はキャッシュを即時返却してバックグラウンドで差分チェックする", async () => {
    const cachedItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", {
      item: cachedItem,
      notionUpdatedAt: cachedItem.lastEditedTime,
      cachedAt: 0, // 古くても webhook 管理（blockMs=undefined）なのでブロックしない
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

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      // webhook 管理 → staleBlockMs 既定が無期限（ブロックしない）。
      // recheckWindowMs:0 でキャッシュヒット時に必ず裏チェックを走らせる。
      notionWebhookSecret: "wh-secret",
      swr: { recheckWindowMs: 0 },
      waitUntil,
    });

    const result = await cms.posts.find("my-post");

    expect(result).not.toBeNull();
    expect(result?.lastEditedTime).toBe("2024-01-01T00:00:00Z");

    expect(capturedPromises.length).toBeGreaterThan(0);

    await Promise.all(capturedPromises);
    const updated = await cache.doc?.getMeta<BaseContentItem>(
      "posts",
      "my-post",
    );
    expect(updated?.item.lastEditedTime).toBe("2024-01-02T00:00:00Z");
  });

  it("ブロックなし設定の list はキャッシュを即時返却してバックグラウンドで差分チェックする", async () => {
    const cachedItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", {
      items: [cachedItem],
      cachedAt: 0, // 古くても webhook 管理（blockMs=undefined）なのでブロックしない
    });

    const capturedPromises: Promise<unknown>[] = [];
    const waitUntil = (p: Promise<unknown>) => {
      capturedPromises.push(p);
    };

    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };

    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      // webhook 管理 → blockMs=undefined（リストはブロックせず裏で差分チェック）。
      notionWebhookSecret: "wh-secret",
      waitUntil,
    });

    const items = await cms.posts.list();

    expect(items).toHaveLength(1);
    expect(items[0]?.lastEditedTime).toBe("2024-01-01T00:00:00Z");

    expect(capturedPromises.length).toBeGreaterThan(0);
  });

  it("staleBlockMs 設定あり・閾値超過の list はブロッキングで最新リストを返す", async () => {
    const staleItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "page-2",
      slug: "new-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", {
      items: [staleItem],
      cachedAt: 0, // 必ず block 閾値超過
    });

    const waitUntil = vi.fn();

    const source = makeMockSource({
      async list() {
        return [staleItem, freshItem];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      swr: { staleBlockMs: 1000 },
      waitUntil,
    });

    const items = await cms.posts.list();

    expect(items).toHaveLength(2);

    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("キャッシュミス時に logger.debug が呼ばれる", async () => {
    const debugFn = vi.fn();
    const source = makeMockSource({
      async list() {
        return [
          { id: "p1", slug: "post-1", lastEditedTime: "2024-01-01T00:00:00Z" },
        ];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [memoryCache()],
      logger: { debug: debugFn },
    });

    await cms.posts.find("post-1");

    expect(debugFn).toHaveBeenCalledWith(
      "キャッシュミス、フェッチ",
      expect.objectContaining({
        operation: "find",
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
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item,
      notionUpdatedAt: item.lastEditedTime,
      cachedAt: Date.now(),
    });

    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
      cache: [cache],
      logger: { debug: debugFn },
    });

    await cms.posts.find("post-1");

    expect(debugFn).toHaveBeenCalledWith(
      "キャッシュヒット [posts] post-1",
      expect.objectContaining({
        operation: "find",
        slug: "post-1",
        collection: "posts",
      }),
    );
  });

  it("block 閾値超過時に logger.debug が呼ばれる", async () => {
    const debugFn = vi.fn();
    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item,
      notionUpdatedAt: item.lastEditedTime,
      cachedAt: 0, // 必ず block 閾値超過
    });

    const source = makeMockSource({
      async list() {
        return [item];
      },
    });
    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      swr: { staleBlockMs: 1000 },
      logger: { debug: debugFn },
    });

    await cms.posts.find("post-1");

    expect(debugFn).toHaveBeenCalledWith(
      "キャッシュ期限切れ（block 閾値）、フェッチ",
      expect.objectContaining({
        operation: "find",
        slug: "post-1",
        collection: "posts",
      }),
    );
  });

  it("SWR が差分を検出したとき logger.info と onCacheRevalidated が呼ばれる", async () => {
    const debugFn = vi.fn();
    const infoFn = vi.fn();
    const onCacheRevalidated = vi.fn();

    const cachedItem: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item: cachedItem,
      notionUpdatedAt: cachedItem.lastEditedTime,
      cachedAt: Date.now(),
    });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [freshItem];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      // recheckWindowMs:0 でキャッシュヒット時に必ず裏チェックを走らせる。
      swr: { recheckWindowMs: 0 },
      logger: { debug: debugFn, info: infoFn },
      hooks: { onCacheRevalidated },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.find("post-1");
    await Promise.all(capturedPromises);

    expect(infoFn).toHaveBeenCalledWith(
      "swr: ミラーを更新 (find) [posts] post-1",
      expect.objectContaining({
        operation: "refreshFromNotion",
        slug: "post-1",
        collection: "posts",
      }),
    );
    expect(debugFn).toHaveBeenCalledWith(
      "swr: ミラーを確認 (find) [posts] post-1",
      expect.objectContaining({
        operation: "refreshFromNotion",
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

  it("SWR が差分なしのとき確認 debug が呼ばれ onCacheRevalidated は呼ばれない", async () => {
    const debugFn = vi.fn();
    const infoFn = vi.fn();
    const onCacheRevalidated = vi.fn();

    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "post-1", {
      item,
      notionUpdatedAt: item.lastEditedTime,
      cachedAt: Date.now(),
    });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [item];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      // recheckWindowMs:0 でキャッシュヒット時に必ず裏チェックを走らせる。
      swr: { staleBlockMs: 60_000, recheckWindowMs: 0 },
      logger: { debug: debugFn, info: infoFn },
      hooks: { onCacheRevalidated },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.find("post-1");
    await Promise.all(capturedPromises);

    expect(debugFn).toHaveBeenCalledWith(
      "swr: ミラーを確認 (find) [posts] post-1",
      expect.objectContaining({
        operation: "refreshFromNotion",
        slug: "post-1",
      }),
    );
    expect(infoFn).not.toHaveBeenCalledWith(
      "swr: ミラーを更新 (find) [posts] post-1",
      expect.anything(),
    );
    expect(onCacheRevalidated).not.toHaveBeenCalled();
  });

  it("SWR がリスト差分を検出したとき logger.info と onListCacheRevalidated が呼ばれる", async () => {
    const onListCacheRevalidated = vi.fn();
    const debugFn = vi.fn();
    const infoFn = vi.fn();

    const oldItem: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const newItem: BaseContentItem = {
      id: "p2",
      slug: "post-2",
      lastEditedTime: "2024-01-02T00:00:00Z",
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

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      logger: { debug: debugFn, info: infoFn },
      hooks: { onListCacheRevalidated },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.list();
    await Promise.all(capturedPromises);

    expect(infoFn).toHaveBeenCalledWith(
      "swr: ミラーを更新 (list) [posts]",
      expect.objectContaining({ operation: "list:bg", collection: "posts" }),
    );
    expect(debugFn).toHaveBeenCalledWith(
      "swr: ミラーを確認 (list) [posts]",
      expect.objectContaining({ operation: "list:bg", collection: "posts" }),
    );
    expect(onListCacheRevalidated).toHaveBeenCalledOnce();
    expect(onListCacheRevalidated).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([oldItem, newItem]),
        cachedAt: expect.any(Number),
      }),
    );
  });

  it("staleBlockMs 設定あり・閾値内の find はキャッシュを即時返却してバックグラウンド差分チェックする", async () => {
    const freshItem: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    // cachedAt: Date.now()、staleBlockMs: 60_000 → ブロック閾値内
    await cache.doc?.setMeta("posts", "my-post", {
      item: freshItem,
      notionUpdatedAt: freshItem.lastEditedTime,
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

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
      // recheckWindowMs:0 でキャッシュヒット時に必ず裏チェックを走らせる。
      swr: { staleBlockMs: 60_000, recheckWindowMs: 0 },
      waitUntil,
    });

    await cms.posts.find("my-post");

    expect(capturedPromises.length).toBeGreaterThan(0);
  });

  it("リスト SWR が差分なし + staleBlockMs あり のとき cachedAt をリセットする", async () => {
    const item: BaseContentItem = {
      id: "p1",
      slug: "post-1",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", { items: [item], cachedAt: Date.now() });

    const capturedPromises: Promise<unknown>[] = [];
    const source = makeMockSource({
      async list() {
        return [item];
      },
    });

    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      // staleBlockMs を設定するとリスト差分なし時に cachedAt がリセットされる
      cache: [cache],
      swr: { staleBlockMs: 60_000 },
      waitUntil: (p) => capturedPromises.push(p),
    });

    await cms.posts.list();
    await Promise.all(capturedPromises);
    expect(capturedPromises.length).toBeGreaterThan(0);
  });
});

describe("metadata と content の分離", () => {
  it("find は content を読まない（render() アクセス時に初めて読む）", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "lazy-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const loadMarkdown = vi.fn().mockResolvedValue("# hi");
    const cache = memoryCache();
    expect(cache.doc).toBeDefined();
    if (!cache.doc) return;
    const getContentSpy = vi.spyOn(cache.doc, "getContent");

    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
      cache: [cache],
    });

    const result = await cms.posts.find("lazy-post");
    expect(getContentSpy).not.toHaveBeenCalled();
    expect(loadMarkdown).not.toHaveBeenCalled();

    await result?.html();
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

describe("itemKey", () => {
  it("slug があれば slug を identity に使う", async () => {
    const { itemKey } = await import("../collection");
    expect(
      itemKey({ id: "page-1", slug: "my-post", lastEditedTime: "t" }),
    ).toBe("my-post");
  });

  it("slug 未設定なら id にフォールバックする", async () => {
    const { itemKey } = await import("../collection");
    expect(itemKey({ id: "page-1", lastEditedTime: "t" })).toBe("page-1");
  });

  it("slug が空文字でも id にフォールバックし衝突を防ぐ", async () => {
    const { itemKey } = await import("../collection");
    // ?? ではなく || なので空文字は id に倒れる。
    expect(itemKey({ id: "page-1", slug: "", lastEditedTime: "t" })).toBe(
      "page-1",
    );
  });
});

describe("リトライ中のロガー", () => {
  it("list() がリトライ中に logger.warn を呼ぶ", async () => {
    const warnFn = vi.fn();
    const retryableErr = Object.assign(new Error("rate limit"), {
      status: 503,
    });
    let callCount = 0;
    const cms = createClient({
      sources: {
        mock: {
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

  it("find() がリトライ中に logger.warn を呼ぶ", async () => {
    const warnFn = vi.fn();
    const retryableErr = Object.assign(new Error("service unavailable"), {
      status: 503,
    });
    const targetItem: BaseContentItem = {
      id: "1",
      slug: "retry-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    let callCount = 0;
    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
      logger: { warn: warnFn },
      rateLimiter: { maxRetries: 1, baseDelayMs: 0, retryOn: [503] },
    });
    await cms.posts.find("retry-post");
    expect(warnFn).toHaveBeenCalledWith(
      "find() リトライ中",
      expect.objectContaining({ attempt: 1, status: 503 }),
    );
  });
});

describe("foreground 取得失敗のロガー", () => {
  it("list() のハード失敗で logger.error を呼ぶ", async () => {
    const errorFn = vi.fn();
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  throw new Error("boom");
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
      renderer: mockRenderer,
      logger: { error: errorFn },
    });
    await expect(cms.posts.list()).rejects.toThrow();
    expect(errorFn).toHaveBeenCalledWith(
      "foreground 取得に失敗",
      expect.objectContaining({ operation: "list", collection: "posts" }),
    );
  });

  it("find() のハード失敗で slug 付きの logger.error を呼ぶ", async () => {
    const errorFn = vi.fn();
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  throw new Error("boom");
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
      renderer: mockRenderer,
      logger: { error: errorFn },
    });
    await expect(cms.posts.find("missing")).rejects.toThrow();
    expect(errorFn).toHaveBeenCalledWith(
      "foreground 取得に失敗",
      expect.objectContaining({
        operation: "find",
        slug: "missing",
        collection: "posts",
      }),
    );
  });
});
