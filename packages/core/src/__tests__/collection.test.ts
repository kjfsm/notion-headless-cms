import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createCMS } from "../cms";
import { isCMSError } from "../errors";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

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

function makeItems(): BaseContentItem[] {
  return [
    {
      id: "1",
      slug: "alpha",
      updatedAt: "2024-01-01T00:00:00Z",
      status: "公開",
    },
    {
      id: "2",
      slug: "beta",
      updatedAt: "2024-01-02T00:00:00Z",
      status: "下書き",
    },
    {
      id: "3",
      slug: "gamma",
      updatedAt: "2024-01-03T00:00:00Z",
      status: "公開",
    },
  ];
}

describe("CollectionClient — params", () => {
  it("params は { slug } オブジェクトの配列を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const params = await cms.posts.params();
    expect(params).toEqual([
      { slug: "alpha" },
      { slug: "beta" },
      { slug: "gamma" },
    ]);
  });

  it("アイテムがない場合は空配列を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: { source: makeMockSource(), slugField: "slug" },
      },
    });
    expect(await cms.posts.params()).toEqual([]);
  });
});

describe("CollectionClient — cache.adjacent", () => {
  it("中間要素の前後両方を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const adj = await cms.posts.cache.adjacent("beta");
    expect(adj.prev?.slug).toBe("alpha");
    expect(adj.next?.slug).toBe("gamma");
  });

  it("先頭要素の prev は null", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const adj = await cms.posts.cache.adjacent("alpha");
    expect(adj.prev).toBeNull();
    expect(adj.next?.slug).toBe("beta");
  });

  it("末尾要素の next は null", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const adj = await cms.posts.cache.adjacent("gamma");
    expect(adj.prev?.slug).toBe("beta");
    expect(adj.next).toBeNull();
  });

  it("存在しない slug の場合は { prev: null, next: null } を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const adj = await cms.posts.cache.adjacent("nonexistent");
    expect(adj.prev).toBeNull();
    expect(adj.next).toBeNull();
  });

  it("sort オプションで並び順を変えた結果で adjacent が返る", async () => {
    const items: BaseContentItem[] = [
      { id: "1", slug: "a", updatedAt: "2024-01-03T00:00:00Z" },
      { id: "2", slug: "b", updatedAt: "2024-01-01T00:00:00Z" },
      { id: "3", slug: "c", updatedAt: "2024-01-02T00:00:00Z" },
    ];
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return items;
            },
          }),
          slugField: "slug",
        },
      },
    });
    const adj = await cms.posts.cache.adjacent("c", {
      sort: { by: "updatedAt", dir: "asc" },
    });
    expect(adj.prev?.slug).toBe("b");
    expect(adj.next?.slug).toBe("a");
  });
});

describe("CollectionClient — cache.invalidate / cache.warm", () => {
  it("キャッシュなしでも cache.invalidate がエラーにならない", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: { posts: { source: makeMockSource(), slugField: "slug" } },
    });
    await expect(
      cms.posts.cache.invalidate("some-slug"),
    ).resolves.toBeUndefined();
    await expect(cms.posts.cache.invalidate()).resolves.toBeUndefined();
  });

  it("cache.invalidate() 後の list はソースから再取得する", async () => {
    const freshItem: BaseContentItem = {
      id: "2",
      slug: "fresh",
      updatedAt: "2024-02-01T00:00:00Z",
    };
    let callCount = 0;
    const source = makeMockSource({
      async list() {
        callCount++;
        return callCount === 1 ? makeItems() : [freshItem];
      },
    });
    const cache = memoryCache();
    const cms = createCMS({
      renderer: mockRenderer,
      collections: { posts: { source, slugField: "slug" } },
      cache,
    });

    await cms.posts.list();
    await cms.posts.cache.invalidate();
    const second = await cms.posts.list();

    expect(callCount).toBe(2);
    expect(second).toHaveLength(1);
    expect(second[0]!.slug).toBe("fresh");
  });

  it("cache.invalidate() でコレクション全体が無効化される", async () => {
    let callCount = 0;
    const source = makeMockSource({
      async list() {
        callCount++;
        return makeItems();
      },
    });
    const cache = memoryCache();
    const cms = createCMS({
      renderer: mockRenderer,
      collections: { posts: { source, slugField: "slug" } },
      cache,
    });

    await cms.posts.list();
    await cms.posts.cache.invalidate();
    await cms.posts.list();

    expect(callCount).toBe(2);
  });

  it("cache.invalidate(slug) で特定アイテムのメタが無効化される", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const source = makeMockSource({
      async list() {
        return [item];
      },
    });
    const cache = memoryCache();
    const cms = createCMS({
      collections: { posts: { source, slugField: "slug" } },
      renderer: mockRenderer,
      cache,
    });

    await cms.posts.get("my-post");
    const before = await cache.doc?.getMeta("posts", "my-post");
    expect(before).not.toBeNull();

    await cms.posts.cache.invalidate("my-post");
    const after = await cache.doc?.getMeta("posts", "my-post");
    expect(after).toBeNull();
  });
});

describe("CollectionClient — cache.warm", () => {
  it("全アイテムをレンダリングしてキャッシュに保存する", async () => {
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.cache.warm();
    expect(result.ok).toBe(3);
    expect(result.failed).toBe(0);
  });

  it("レンダリングが一部失敗しても failed カウントが返る", async () => {
    const items = makeItems();
    const loadMarkdownMock = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("");

    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return items;
            },
            loadMarkdown: loadMarkdownMock,
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.cache.warm();
    expect(result.ok).toBe(2);
    expect(result.failed).toBe(1);
  });

  it("onProgress コールバックが呼ばれる", async () => {
    const onProgress = vi.fn();
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    await cms.posts.cache.warm({ concurrency: 1, onProgress });
    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(lastCall?.[1]);
  });

  it("アイテムがない場合は { ok: 0, failed: 0 } を返す", async () => {
    const cms = createCMS({
      collections: {
        posts: { source: makeMockSource(), slugField: "slug" },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.cache.warm();
    expect(result).toEqual({ ok: 0, failed: 0 });
  });
});

describe("CollectionClient — list フィルタ・ソート・ページング", () => {
  it("status フィルタで指定ステータスのみ返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({ status: ["公開"] });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.status === "公開")).toBe(true);
  });

  it("tag フィルタで指定タグを持つアイテムのみ返す", async () => {
    type TaggedItem = BaseContentItem & { tags: string[] };
    const taggedItems: TaggedItem[] = [
      { id: "1", slug: "a", updatedAt: "2024-01-01T00:00:00Z", tags: ["tech"] },
      { id: "2", slug: "b", updatedAt: "2024-01-02T00:00:00Z", tags: ["life"] },
      {
        id: "3",
        slug: "c",
        updatedAt: "2024-01-03T00:00:00Z",
        tags: ["tech", "life"],
      },
    ];
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return taggedItems;
            },
          }),
          slugField: "slug",
        },
      },
    });
    const result = await cms.posts.list({ tag: "tech" });
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.slug)).toEqual(["a", "c"]);
  });

  it("where フィルタで id が一致するアイテムのみ返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({ where: { id: "1" } });
    expect(items).toHaveLength(1);
    expect(items[0]!.slug).toBe("alpha");
  });

  it("sort: asc で updatedAt 昇順になる", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({
      sort: { by: "updatedAt", dir: "asc" },
    });
    expect(items.map((i) => i.slug)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("sort: desc で updatedAt 降順になる", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({
      sort: { by: "updatedAt", dir: "desc" },
    });
    expect(items.map((i) => i.slug)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("skip と limit でページングできる", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({ skip: 1, limit: 1 });
    expect(items).toHaveLength(1);
    expect(items[0]!.slug).toBe("beta");
  });

  it("limit のみ指定すると先頭から N 件を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({ limit: 2 });
    expect(items).toHaveLength(2);
    expect(items[0]!.slug).toBe("alpha");
  });

  it("skip のみ指定すると N 件スキップして残りを返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({ skip: 2 });
    expect(items).toHaveLength(1);
    expect(items[0]!.slug).toBe("gamma");
  });

  it("オプションなしで全件返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list();
    expect(items).toHaveLength(3);
  });

  it("where に配列を渡すと OR 一致でフィルタする", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({ where: { id: ["1", "3"] } });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.slug)).toEqual(["alpha", "gamma"]);
  });

  it("filter 関数で任意条件でフィルタできる", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({
      filter: (item) => item.slug.startsWith("a"),
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.slug).toBe("alpha");
  });

  it("sort.compare カスタム comparator でソートできる", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return makeItems();
            },
          }),
          slugField: "slug",
        },
      },
    });
    const items = await cms.posts.list({
      sort: {
        by: "slug",
        compare: (a, b) => b.slug.localeCompare(a.slug),
      },
    });
    expect(items.map((i) => i.slug)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("sort.by のフィールド値が string / number 以外の場合は core/sort_unsupported_type CMSError をスローする", async () => {
    type PostWithObj = BaseContentItem & { meta: object };
    const items: PostWithObj[] = [
      {
        id: "1",
        slug: "a",
        updatedAt: "2024-01-01T00:00:00Z",
        meta: { order: 1 },
      },
      {
        id: "2",
        slug: "b",
        updatedAt: "2024-01-02T00:00:00Z",
        meta: { order: 2 },
      },
    ];
    const source = makeMockSource({
      async list() {
        return items as BaseContentItem[];
      },
    });
    const cms = createCMS({
      renderer: mockRenderer,
      collections: { posts: { source, slugField: "slug" } },
    });
    await expect(
      cms.posts.list({
        sort: { by: "meta" as keyof BaseContentItem & string },
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        isCMSError(err) && err.code === "core/sort_unsupported_type",
    );
  });
});

describe("CollectionClient — 並行 get", () => {
  it("同一 slug への並行 get が全て正しいアイテムを返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "concurrent-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
            loadMarkdown: vi.fn().mockResolvedValue("# Concurrent"),
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });

    const results = await Promise.all([
      cms.posts.get("concurrent-post"),
      cms.posts.get("concurrent-post"),
      cms.posts.get("concurrent-post"),
      cms.posts.get("concurrent-post"),
      cms.posts.get("concurrent-post"),
    ]);

    for (const r of results) {
      expect(r).not.toBeNull();
      expect(r?.slug).toBe("concurrent-post");
    }
  });

  it("存在しない slug への並行 get が全て null を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [];
            },
          }),
          slugField: "slug",
        },
      },
    });

    const results = await Promise.all([
      cms.posts.get("ghost"),
      cms.posts.get("ghost"),
      cms.posts.get("ghost"),
    ]);

    for (const r of results) {
      expect(r).toBeNull();
    }
  });
});

describe("CollectionClient — isArchived フィルタ", () => {
  it("isArchived が true のアイテムは list から除外される", async () => {
    const items: BaseContentItem[] = [
      { id: "1", slug: "active", updatedAt: "2024-01-01T00:00:00Z" },
      {
        id: "2",
        slug: "archived",
        updatedAt: "2024-01-01T00:00:00Z",
        isArchived: true,
      },
    ];
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return items;
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.list();
    expect(result.map((i) => i.slug)).toEqual(["active"]);
  });

  it("isArchived が true のアイテムは get で null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "archived-post",
      updatedAt: "2024-01-01T00:00:00Z",
      isArchived: true,
    };
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
    });
    const result = await cms.posts.get("archived-post");
    expect(result).toBeNull();
  });
});

describe("CollectionClient — accessibleStatuses フィルタ", () => {
  it("accessibleStatuses にないステータスのアイテムは get で null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "draft-post",
      updatedAt: "2024-01-01T00:00:00Z",
      status: "下書き",
    };
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
          }),
          slugField: "slug",
          accessibleStatuses: ["公開"],
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.get("draft-post");
    expect(result).toBeNull();
  });

  it("accessibleStatuses にステータスが含まれるアイテムは get で取得できる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "public-post",
      updatedAt: "2024-01-01T00:00:00Z",
      status: "公開",
    };
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
          }),
          slugField: "slug",
          accessibleStatuses: ["公開"],
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.get("public-post");
    expect(result).not.toBeNull();
  });

  it("アイテムの status が undefined の場合は accessibleStatuses でフィルタして null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "no-status",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
          }),
          slugField: "slug",
          accessibleStatuses: ["公開"],
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.get("no-status");
    expect(result).toBeNull();
  });

  it("アイテムの status が null の場合は accessibleStatuses でフィルタして null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "null-status",
      updatedAt: "2024-01-01T00:00:00Z",
      status: null,
    };
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
          }),
          slugField: "slug",
          accessibleStatuses: ["公開"],
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.get("null-status");
    expect(result).toBeNull();
  });
});

describe("CollectionClient — render アクセサ", () => {
  it("render() は HTML を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-html",
      updatedAt: "2024-01-01T00:00:00Z",
    };
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
    });
    const result = await cms.posts.get("post-html");
    expect(result).not.toBeNull();
    const html = await result?.render();
    expect(typeof html).toBe("string");
  });

  it("render({ format: 'markdown' }) は Markdown を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-with-md",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const loadMarkdown = vi.fn().mockResolvedValue("# Hello World");
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
    });
    const result = await cms.posts.get("post-with-md");
    expect(result).not.toBeNull();
    const md = await result?.render({ format: "markdown" });
    expect(md).toBe("# Hello World");
  });

  it("render() を複数回呼んでも loadMarkdown は 1 回のみ呼ばれる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-lazy",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const loadMarkdown = vi.fn().mockResolvedValue("# Lazy");
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
    });
    const result = await cms.posts.get("post-lazy");
    expect(result).not.toBeNull();
    await result?.render();
    await result?.render();
    expect(loadMarkdown).toHaveBeenCalledTimes(1);
  });
});

describe("CollectionClient — check()", () => {
  it("updatedAt が一致するときは { stale: false } を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check("my-post", "2024-01-01T00:00:00Z");
    expect(result).toEqual({ stale: false });
  });

  it("updatedAt が異なるときは { stale: true, item } を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "updated-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check(
      "updated-post",
      "2024-01-01T00:00:00Z",
    );
    expect(result).not.toBeNull();
    expect(result?.stale).toBe(true);
    if (result?.stale) {
      expect(result.item.slug).toBe("updated-post");
      expect(result.item.updatedAt).toBe("2024-01-02T00:00:00Z");
    }
  });

  it("stale のとき render() が HTML を返す", async () => {
    const loadMarkdown = vi.fn().mockResolvedValue("# Updated");
    const item: BaseContentItem = {
      id: "1",
      slug: "render-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check("render-post", "2024-01-01T00:00:00Z");
    if (result?.stale) {
      const html = await result.item.render();
      expect(typeof html).toBe("string");
      expect(loadMarkdown).toHaveBeenCalled();
    }
  });

  it("存在しない slug は null を返す", async () => {
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: { source: makeMockSource(), slugField: "slug" },
      },
    });
    const result = await cms.posts.check("nonexistent", "2024-01-01T00:00:00Z");
    expect(result).toBeNull();
  });

  it("accessibleStatuses にないアイテムは null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "draft-post",
      updatedAt: "2024-01-01T00:00:00Z",
      status: "下書き",
    };
    const cms = createCMS({
      renderer: mockRenderer,
      collections: {
        posts: {
          source: makeMockSource({
            async list() {
              return [item];
            },
          }),
          slugField: "slug",
          accessibleStatuses: ["公開"],
        },
      },
    });
    const result = await cms.posts.check("draft-post", "2024-01-01T00:00:00Z");
    expect(result).toBeNull();
  });

  it("findByProp が設定されていると効率的なプロパティ検索を使う", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "fp-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };
    const findByProp = vi.fn().mockResolvedValue(item);
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            findByProp,
            properties: { slug: { type: "richText", notion: "Slug" } },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    await cms.posts.check("fp-post", "2024-01-01T00:00:00Z");
    expect(findByProp).toHaveBeenCalledWith("Slug", "fp-post");
  });

  it("not stale のときソースは1回だけ呼ばれる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "unchanged-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const findByProp = vi.fn().mockResolvedValue(item);
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            findByProp,
            properties: { slug: { type: "richText", notion: "Slug" } },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.check(
      "unchanged-post",
      "2024-01-01T00:00:00Z",
    );
    expect(result).toEqual({ stale: false });
    expect(findByProp).toHaveBeenCalledTimes(1);
  });

  it("stale のとき後続の get() でメタが更新されている", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "cache-update-post",
      updatedAt: "2024-01-02T00:00:00Z",
    };
    const cache = memoryCache();
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
      cache,
      renderer: mockRenderer,
    });
    await cms.posts.check("cache-update-post", "2024-01-01T00:00:00Z");
    const meta = await cache.doc?.getMeta("posts", "cache-update-post");
    expect(meta?.item.updatedAt).toBe("2024-01-02T00:00:00Z");
  });

  it("currentVersion が空文字のとき updatedAt が何であっても stale: true になる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "empty-version-post",
      updatedAt: "2024-01-01T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check("empty-version-post", "");
    expect(result?.stale).toBe(true);
  });
});

describe("CollectionClient — slugField + findByProp", () => {
  it("slugField と findByProp が設定されていると効率的なプロパティ検索を使う", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      updatedAt: "2024-01-01T00:00:00Z",
      status: "公開",
    };
    const findByProp = vi.fn().mockResolvedValue(item);
    const cms = createCMS({
      collections: {
        posts: {
          source: makeMockSource({
            findByProp,
            properties: {
              slug: { type: "richText", notion: "Slug" },
            },
          }),
          slugField: "slug",
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.get("my-post");
    expect(result).not.toBeNull();
    expect(findByProp).toHaveBeenCalledWith("Slug", "my-post");
  });
});
