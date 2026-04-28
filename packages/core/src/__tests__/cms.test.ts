import { describe, expect, it, vi } from "vitest";
import { createCMS } from "../cms";
import { isCMSError } from "../errors";
import type { CollectionDef, RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

// renderer を明示的に注入するモック（core はゼロ依存）
const mockRenderer: RendererFn = vi.fn().mockResolvedValue("<p>test</p>");

function makeMockSource(
  overrides: Partial<DataSource<BaseContentItem>> = {},
): DataSource<BaseContentItem> {
  return {
    name: "mock",
    list: vi.fn().mockResolvedValue([]),
    loadBlocks: vi.fn().mockResolvedValue([]),
    loadMarkdown: vi.fn().mockResolvedValue(""),
    getLastModified: (item) => item.updatedAt,
    getListVersion: () => "",
    ...overrides,
  };
}

describe("createCMS - collections バリデーション", () => {
  it("collections が空の場合は CMSError をスローする", () => {
    let caught: unknown;
    try {
      createCMS({ collections: {} });
    } catch (e) {
      caught = e;
    }
    expect(caught).toSatisfy(
      (err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
    );
  });

  it("source が未定義のコレクションは CMSError をスローする", () => {
    let caught: unknown;
    try {
      createCMS({
        collections: {
          posts: { slugField: "slug" } as CollectionDef<BaseContentItem>,
        },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toSatisfy(
      (err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
    );
  });

  it("slugField が未定義のコレクションは CMSError をスローする", () => {
    let caught: unknown;
    try {
      createCMS({
        collections: {
          posts: { source: makeMockSource() } as CollectionDef<BaseContentItem>,
        },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toSatisfy(
      (err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
    );
  });

  it("有効な collections を渡した場合はエラーをスローしない", () => {
    expect(() =>
      createCMS({
        collections: {
          posts: { source: makeMockSource(), slugField: "slug" },
        },
      }),
    ).not.toThrow();
  });
});

describe("createCMS - publishedStatuses / accessibleStatuses", () => {
  it("publishedStatuses で絞り込まれたアイテムのみ list() が返す", async () => {
    const publishedItems: BaseContentItem[] = [
      {
        id: "1",
        slug: "published-post",
        updatedAt: "2024-01-01T00:00:00Z",
        status: "公開済み",
      },
      {
        id: "2",
        slug: "draft-post",
        updatedAt: "2024-01-02T00:00:00Z",
        status: "下書き",
      },
    ];

    const listMock = vi
      .fn()
      .mockImplementation(
        async (opts?: { publishedStatuses?: readonly string[] }) => {
          if (opts?.publishedStatuses?.length) {
            return publishedItems.filter(
              (i) => i.status && opts.publishedStatuses?.includes(i.status),
            );
          }
          return publishedItems;
        },
      );

    const source = makeMockSource({ list: listMock });

    const cms = createCMS({
      collections: {
        posts: {
          source,
          slugField: "slug",
          statusField: "status",
          publishedStatuses: ["公開済み"],
        },
      },
    });

    const items = await cms.posts.list();
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe("published-post");
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ publishedStatuses: ["公開済み"] }),
    );
  });

  it("publishedStatuses 未指定の場合は全アイテムを返す", async () => {
    const listMock = vi.fn().mockResolvedValue([]);

    const source = makeMockSource({ list: listMock });

    const cms = createCMS({
      collections: {
        posts: { source, slugField: "slug" },
      },
    });

    await cms.posts.list();
    // publishedStatuses なし（空配列のため undefined）で list() が呼ばれる
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ publishedStatuses: undefined }),
    );
  });

  it("accessibleStatuses でアクセス制御できる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
      status: "限定公開",
    };

    const source = makeMockSource({
      list: vi.fn().mockResolvedValue([item]),
    });

    const cms = createCMS({
      collections: {
        posts: {
          source,
          slugField: "slug",
          accessibleStatuses: ["Published", "限定公開"],
        },
      },
      renderer: mockRenderer,
    });

    // 限定公開は accessibleStatuses に含まれるのでアクセスできる
    const result = await cms.posts.get("my-post");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("my-post");
  });
});

describe("createCMS - findByProp の利用", () => {
  it("slugField が指定され findByProp が実装されている場合は findByProp を使う", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "hello",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const findByPropMock = vi.fn().mockResolvedValue(item);

    const source = makeMockSource({
      findByProp: findByPropMock,
      properties: {
        slug: { type: "richText", notion: "Slug" },
        status: { type: "select", notion: "Status" },
      },
    });

    const cms = createCMS({
      collections: {
        posts: { source, slugField: "slug" },
      },
      renderer: mockRenderer,
    });

    await cms.posts.get("hello");

    // findByProp が Notion プロパティ名 "Slug" と値 "hello" で呼ばれることを確認
    expect(findByPropMock).toHaveBeenCalledWith("Slug", "hello");
  });

  it("slugField が設定されていても findByProp 未実装の場合は list() フォールバックを使う", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "hello",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const listMock = vi.fn().mockResolvedValue([item]);

    // findByProp を持たないが properties は定義されている DataSource
    const source = makeMockSource({
      list: listMock,
      properties: {
        slug: { type: "richText", notion: "Slug" },
      },
    });

    const cms = createCMS({
      collections: {
        posts: { source, slugField: "slug" },
      },
      renderer: mockRenderer,
    });

    const result = await cms.posts.get("hello");

    // findByProp がないので list() で全件取得して線形探索する
    expect(listMock).toHaveBeenCalled();
    expect(result?.slug).toBe("hello");
  });
});

describe("createCMS - コレクション間のキャッシュ独立性", () => {
  it("posts と pages のリストキャッシュは互いに独立している", async () => {
    const postItem: BaseContentItem = {
      id: "p1",
      slug: "post-one",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const pageItem: BaseContentItem = {
      id: "pg1",
      slug: "page-one",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const postListMock = vi.fn().mockResolvedValue([postItem]);
    const pageListMock = vi.fn().mockResolvedValue([pageItem]);

    const { memoryCache } = await import("../cache/memory");
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({ list: postListMock }),
          slugField: "slug",
        },
        pages: {
          source: makeMockSource({ list: pageListMock }),
          slugField: "slug",
        },
      },
      cache: memoryCache(),
    });

    const posts = await cms.posts.list();
    const pages = await cms.pages.list();

    // 2 回目はキャッシュから返る（list は 1 度しか呼ばれない）
    const postsCached = await cms.posts.list();
    const pagesCached = await cms.pages.list();

    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("post-one");
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe("page-one");
    // キャッシュがスコープ別に独立しているので posts のリストが pages で上書きされない
    expect(postsCached[0].slug).toBe("post-one");
    expect(pagesCached[0].slug).toBe("page-one");
  });
});

describe("createCMS - $invalidate", () => {
  it("$invalidate 後に list が新データを返す", async () => {
    const staleItem: BaseContentItem = {
      id: "1",
      slug: "post-stale",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const freshItem: BaseContentItem = {
      id: "2",
      slug: "post-fresh",
      updatedAt: "2024-01-02T00:00:00Z",
    };

    const listMock = vi
      .fn()
      .mockResolvedValueOnce([staleItem])
      .mockResolvedValueOnce([freshItem]);

    const { memoryCache } = await import("../cache/memory");
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({ list: listMock }),
          slugField: "slug",
        },
      },
      cache: memoryCache(),
    });

    const first = await cms.posts.list();
    expect(first[0].slug).toBe("post-stale");

    await cms.$invalidate();

    const second = await cms.posts.list();
    // $invalidate 後はキャッシュがクリアされ、新しいデータが返される
    expect(second[0].slug).toBe("post-fresh");
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("$invalidate を呼んでもエラーが発生しない（キャッシュなしの場合）", async () => {
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    await expect(cms.$invalidate()).resolves.toBeUndefined();
  });

  it("$collections にコレクション名が含まれる", () => {
    const cms = createCMS({
      collections: {
        posts: { source: makeMockSource(), slugField: "slug" },
        pages: { source: makeMockSource(), slugField: "slug" },
      },
    });
    expect(cms.$collections).toContain("posts");
    expect(cms.$collections).toContain("pages");
  });
});

describe("createCMS - logLevel オプション", () => {
  it("logLevel: 'info' を設定すると debug ログが抑制される", async () => {
    const debugFn = vi.fn();
    const infoFn = vi.fn();

    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const source = makeMockSource({
      list: vi.fn().mockResolvedValue([item]),
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      logger: { debug: debugFn, info: infoFn },
      logLevel: "info",
    });

    // get でキャッシュミスの debug ログが出るはずだが抑制される
    await cms.posts.get("my-post");

    expect(debugFn).not.toHaveBeenCalled();
  });

  it("logLevel 未設定では debug ログが通常通り流れる", async () => {
    const debugFn = vi.fn();

    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const source = makeMockSource({
      list: vi.fn().mockResolvedValue([item]),
    });

    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      logger: { debug: debugFn },
    });

    await cms.posts.get("my-post");

    expect(debugFn).toHaveBeenCalled();
  });

  it("logger 未設定かつ logLevel を指定しても問題なく動作する", () => {
    expect(() =>
      createCMS({
        collections: { posts: { source: makeMockSource(), slugField: "slug" } },
        logLevel: "warn",
      }),
    ).not.toThrow();
  });
});

describe("createCMS - collections.hooks コレクション固有フック", () => {
  it("collections.hooks.onCacheHit がコレクション固有フックとして呼ばれる", async () => {
    const globalHook = vi.fn();
    const collectionHook = vi.fn();

    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const { memoryCache } = await import("../cache/memory");
    const cache = memoryCache();
    // キャッシュにアイテムを事前登録
    await cache.doc?.setMeta("posts", "my-post", {
      item,
      notionUpdatedAt: item.updatedAt,
      cachedAt: Date.now(),
    });

    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            list: vi.fn().mockResolvedValue([item]),
          }),
          slugField: "slug",
          hooks: { onCacheHit: collectionHook },
        },
      },
      renderer: mockRenderer,
      cache,
      hooks: { onCacheHit: globalHook },
    });

    await cms.posts.get("my-post");

    // グローバルフックとコレクション固有フックの両方が呼ばれる
    expect(globalHook).toHaveBeenCalledOnce();
    expect(collectionHook).toHaveBeenCalledOnce();
  });

  it("collections.hooks がないコレクションはグローバルフックのみ実行される", async () => {
    const globalHook = vi.fn();

    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const { memoryCache } = await import("../cache/memory");
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", {
      item,
      notionUpdatedAt: item.updatedAt,
      cachedAt: Date.now(),
    });

    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            list: vi.fn().mockResolvedValue([item]),
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
      cache,
      hooks: { onCacheHit: globalHook },
    });

    await cms.posts.get("my-post");

    expect(globalHook).toHaveBeenCalledOnce();
  });
});

describe("createCMS - beforeCacheMeta / beforeCacheContent フック", () => {
  it("get でメタ保存時に beforeCacheMeta が呼ばれる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "test-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const beforeCacheMeta = vi.fn().mockImplementation((meta) => meta);

    const source = makeMockSource({
      list: vi.fn().mockResolvedValue([item]),
    });

    const cms = createCMS({
      collections: {
        posts: { source, slugField: "slug" },
      },
      renderer: mockRenderer,
      hooks: { beforeCacheMeta },
    });

    await cms.posts.get("test-post");

    expect(beforeCacheMeta).toHaveBeenCalledOnce();
  });

  it("render() アクセス時に beforeCacheContent が呼ばれる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "test-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const beforeCacheContent = vi.fn().mockImplementation((content) => content);

    const source = makeMockSource({
      list: vi.fn().mockResolvedValue([item]),
    });

    const cms = createCMS({
      collections: {
        posts: { source, slugField: "slug" },
      },
      renderer: mockRenderer,
      hooks: { beforeCacheContent },
    });

    const result = await cms.posts.get("test-post");
    // 本文をアクセスして初めて呼ばれる
    expect(beforeCacheContent).not.toHaveBeenCalled();
    await result?.render();
    expect(beforeCacheContent).toHaveBeenCalledOnce();
  });
});

describe("createCMS - $getCachedImage", () => {
  it("$getCachedImage が imageCache.get を呼ぶ", async () => {
    const getCachedImage = vi.fn().mockResolvedValue(null);
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
      cache: {
        name: "test-image-cache",
        handles: ["image"],
        img: {
          get: getCachedImage,
          set: vi.fn(),
        },
      },
    });
    const result = await cms.$getCachedImage("test-hash");
    expect(getCachedImage).toHaveBeenCalledWith("test-hash");
    expect(result).toBeNull();
  });
});

describe("createCMS - $handler", () => {
  it("$handler() がハンドラ関数を返す", () => {
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    const handler = cms.$handler();
    expect(typeof handler).toBe("function");
  });

  it("slug と collection を含む JSON body で $invalidate が呼ばれる", async () => {
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    const handler = cms.$handler();
    const req = new Request("http://localhost/api/cms/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "my-post", collection: "posts" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("collection のみの JSON body で $invalidate が呼ばれる", async () => {
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    const handler = cms.$handler();
    const req = new Request("http://localhost/api/cms/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ collection: "posts" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it("不正な JSON body の場合は 400 を返す", async () => {
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    const handler = cms.$handler();
    const req = new Request("http://localhost/api/cms/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it("DataSource に parseWebhook がある場合はそちらを優先する", async () => {
    const parseWebhook = vi.fn().mockResolvedValue({ collection: "posts" });
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({ parseWebhook }),
          slugField: "slug",
        },
      },
    });
    const handler = cms.$handler();
    const req = new Request("http://localhost/api/cms/revalidate", {
      method: "POST",
      body: "{}",
    });
    await handler(req);
    expect(parseWebhook).toHaveBeenCalled();
  });

  it("DataSource の parseWebhook が失敗した場合は JSON フォールバックを使う", async () => {
    const parseWebhook = vi.fn().mockRejectedValue(new Error("webhook error"));
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({ parseWebhook }),
          slugField: "slug",
        },
      },
    });
    const handler = cms.$handler();
    const req = new Request("http://localhost/api/cms/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "test", collection: "posts" }),
    });
    const res = await handler(req);
    // パースウェブフック失敗後にJSONフォールバックが動く
    expect(res.status).toBe(200);
  });

  it("slug も collection もない JSON body では 400 を返す", async () => {
    const cms = createCMS({
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    const handler = cms.$handler();
    const req = new Request("http://localhost/api/cms/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ other: "data" }),
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});
