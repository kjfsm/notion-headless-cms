import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createClient } from "../cms";
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
      return item.lastEditedTime;
    },
    getListVersion(items) {
      return items.map((i) => i.lastEditedTime).join(",");
    },
    ...overrides,
  };
}

function makeItems(): BaseContentItem[] {
  return [
    {
      id: "1",
      slug: "alpha",
      lastEditedTime: "2024-01-01T00:00:00Z",
      status: "公開",
    },
    {
      id: "2",
      slug: "beta",
      lastEditedTime: "2024-01-02T00:00:00Z",
      status: "下書き",
    },
    {
      id: "3",
      slug: "gamma",
      lastEditedTime: "2024-01-03T00:00:00Z",
      status: "公開",
    },
  ];
}

describe("CollectionClient — params", () => {
  it("params はスラッグ文字列の配列を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const result = await cms.posts.params();
    expect(result).toEqual(["alpha", "beta", "gamma"]);
  });

  it("アイテムがない場合は空配列を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
          collections: {
            posts: { source: makeMockSource(), slugField: "slug" },
          },
        },
      },
    });
    expect(await cms.posts.params()).toEqual([]);
  });
});

describe("CollectionClient — adjacent", () => {
  it("中間要素の前後両方を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const adj = await cms.posts.adjacent("beta");
    expect(adj.prev?.slug).toBe("gamma");
    expect(adj.next?.slug).toBe("alpha");
  });

  it("先頭要素(最新)の prev は null", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const adj = await cms.posts.adjacent("gamma");
    expect(adj.prev).toBeNull();
    expect(adj.next?.slug).toBe("beta");
  });

  it("末尾要素(最古)の next は null", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const adj = await cms.posts.adjacent("alpha");
    expect(adj.prev?.slug).toBe("beta");
    expect(adj.next).toBeNull();
  });

  it("存在しない slug の場合は { prev: null, next: null } を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const adj = await cms.posts.adjacent("nonexistent");
    expect(adj.prev).toBeNull();
    expect(adj.next).toBeNull();
  });

  it("sort オプションで並び順を変えた結果で adjacent が返る", async () => {
    const items: BaseContentItem[] = [
      { id: "1", slug: "a", lastEditedTime: "2024-01-03T00:00:00Z" },
      { id: "2", slug: "b", lastEditedTime: "2024-01-01T00:00:00Z" },
      { id: "3", slug: "c", lastEditedTime: "2024-01-02T00:00:00Z" },
    ];
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const adj = await cms.posts.adjacent("c", {
      sort: { by: "lastEditedTime", dir: "asc" },
    });
    expect(adj.prev?.slug).toBe("b");
    expect(adj.next?.slug).toBe("a");
  });
});

describe("CollectionClient — cache.invalidate / cache.warm", () => {
  it("キャッシュなしでも cache.invalidate / cache.invalidateItem がエラーにならない", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
          collections: {
            posts: { source: makeMockSource(), slugField: "slug" },
          },
        },
      },
    });
    await expect(
      cms.posts.cache.invalidateItem("some-slug"),
    ).resolves.toBeUndefined();
    await expect(cms.posts.cache.invalidate()).resolves.toBeUndefined();
  });

  it("cache.invalidate() 後の list はソースから再取得する", async () => {
    const freshItem: BaseContentItem = {
      id: "2",
      slug: "fresh",
      lastEditedTime: "2024-02-01T00:00:00Z",
    };
    let callCount = 0;
    const source = makeMockSource({
      async list() {
        callCount++;
        return callCount === 1 ? makeItems() : [freshItem];
      },
    });
    const cache = memoryCache();
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      cache: [cache],
    });

    await cms.posts.list();
    await cms.posts.cache.invalidate();
    const second = await cms.posts.list();

    expect(callCount).toBe(2);
    expect(second).toHaveLength(1);
    expect(second[0]?.slug).toBe("fresh");
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
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      cache: [cache],
    });

    await cms.posts.list();
    await cms.posts.cache.invalidate();
    await cms.posts.list();

    expect(callCount).toBe(2);
  });

  it("cache.invalidateItem(slug) で特定アイテムのメタが無効化される", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const source = makeMockSource({
      async list() {
        return [item];
      },
    });
    const cache = memoryCache();
    const cms = createClient({
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      renderer: mockRenderer,
      cache: [cache],
    });

    await cms.posts.find("my-post");
    const before = await cache.doc?.getMeta("posts", "my-post");
    expect(before).not.toBeNull();

    await cms.posts.cache.invalidateItem("my-post");
    const after = await cache.doc?.getMeta("posts", "my-post");
    expect(after).toBeNull();
  });
});

describe("CollectionClient — cache.warm", () => {
  it("全アイテムをレンダリングしてキャッシュに保存する", async () => {
    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.cache.warm();
    expect(result.ok).toBe(3);
    expect(result.failed).toHaveLength(0);
  });

  it("レンダリングが一部失敗しても failed カウントが返る", async () => {
    const items = makeItems();
    const loadMarkdownMock = vi
      .fn()
      .mockResolvedValueOnce("")
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("");

    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.cache.warm();
    expect(result.ok).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.slug).toBe("beta");
  });

  it("onProgress コールバックが呼ばれる", async () => {
    const onProgress = vi.fn();
    const cms = createClient({
      sources: {
        mock: {
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
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: { source: makeMockSource(), slugField: "slug" },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.cache.warm();
    expect(result).toEqual({ ok: 0, failed: [] });
  });
});

describe("CollectionClient — list フィルタ・ソート・ページング", () => {
  it("statuses フィルタで指定ステータスのみ返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ statuses: ["公開"] });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.status === "公開")).toBe(true);
  });

  it("tag フィルタで指定タグを持つアイテムのみ返す", async () => {
    type TaggedItem = BaseContentItem & { tags: string[] };
    const taggedItems: TaggedItem[] = [
      {
        id: "1",
        slug: "a",
        lastEditedTime: "2024-01-01T00:00:00Z",
        tags: ["tech"],
      },
      {
        id: "2",
        slug: "b",
        lastEditedTime: "2024-01-02T00:00:00Z",
        tags: ["life"],
      },
      {
        id: "3",
        slug: "c",
        lastEditedTime: "2024-01-03T00:00:00Z",
        tags: ["tech", "life"],
      },
    ];
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const result = await cms.posts.list({ tag: "tech" });
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.slug)).toEqual(["c", "a"]);
  });

  it("where フィルタで id が一致するアイテムのみ返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ where: { id: "1" } });
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("alpha");
  });

  it("sort: asc で lastEditedTime 昇順になる", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({
      sort: { by: "lastEditedTime", dir: "asc" },
    });
    expect(items.map((i) => i.slug)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("sort: desc で lastEditedTime 降順になる", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({
      sort: { by: "lastEditedTime", dir: "desc" },
    });
    expect(items.map((i) => i.slug)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("skip と limit でページングできる", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ skip: 1, limit: 1 });
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("beta");
  });

  it("limit のみ指定すると先頭から N 件を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ limit: 2 });
    expect(items).toHaveLength(2);
    expect(items[0]?.slug).toBe("gamma");
  });

  it("skip のみ指定すると N 件スキップして残りを返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ skip: 2 });
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("alpha");
  });

  it("オプションなしで全件返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list();
    expect(items).toHaveLength(3);
  });

  it("publishedAt が設定されている場合はそちらを優先してデフォルトソートする", async () => {
    const items: BaseContentItem[] = [
      {
        id: "1",
        slug: "old",
        lastEditedTime: "2024-01-03T00:00:00Z",
        publishedAt: "2024-01-01",
      },
      {
        id: "2",
        slug: "new",
        lastEditedTime: "2024-01-01T00:00:00Z",
        publishedAt: "2024-01-03",
      },
      {
        id: "3",
        slug: "mid",
        lastEditedTime: "2024-01-02T00:00:00Z",
        publishedAt: "2024-01-02",
      },
    ];
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const result = await cms.posts.list();
    expect(result.map((i) => i.slug)).toEqual(["new", "mid", "old"]);
  });

  it("publishedAt が同値の場合は順序が安定する", async () => {
    const items: BaseContentItem[] = [
      {
        id: "1",
        slug: "a",
        lastEditedTime: "2024-01-01T00:00:00Z",
        publishedAt: "2024-01-01",
      },
      {
        id: "2",
        slug: "b",
        lastEditedTime: "2024-01-01T00:00:00Z",
        publishedAt: "2024-01-01",
      },
    ];
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const result = await cms.posts.list();
    expect(result).toHaveLength(2);
  });

  it("where に配列を渡すと OR 一致でフィルタする", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ where: { id: ["1", "3"] } });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.slug)).toEqual(["gamma", "alpha"]);
  });

  it("filter 関数で任意条件でフィルタできる", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({
      filter: (item) => (item.slug ?? "").startsWith("a"),
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("alpha");
  });

  it("sort.compare カスタム comparator でソートできる", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({
      sort: {
        by: "slug",
        compare: (a, b) => (b.slug ?? "").localeCompare(a.slug ?? ""),
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
        lastEditedTime: "2024-01-01T00:00:00Z",
        meta: { order: 1 },
      },
      {
        id: "2",
        slug: "b",
        lastEditedTime: "2024-01-02T00:00:00Z",
        meta: { order: 2 },
      },
    ];
    const source = makeMockSource({
      async list() {
        return items as BaseContentItem[];
      },
    });
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
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
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
    });

    const results = await Promise.all([
      cms.posts.find("concurrent-post"),
      cms.posts.find("concurrent-post"),
      cms.posts.find("concurrent-post"),
      cms.posts.find("concurrent-post"),
      cms.posts.find("concurrent-post"),
    ]);

    for (const r of results) {
      expect(r).not.toBeNull();
      expect(r?.slug).toBe("concurrent-post");
    }
  });

  it("存在しない slug への並行 get が全て null を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });

    const results = await Promise.all([
      cms.posts.find("ghost"),
      cms.posts.find("ghost"),
      cms.posts.find("ghost"),
    ]);

    for (const r of results) {
      expect(r).toBeNull();
    }
  });
});

describe("CollectionClient — isArchived フィルタ", () => {
  it("isArchived が true のアイテムは list から除外される", async () => {
    const items: BaseContentItem[] = [
      { id: "1", slug: "active", lastEditedTime: "2024-01-01T00:00:00Z" },
      {
        id: "2",
        slug: "archived",
        lastEditedTime: "2024-01-01T00:00:00Z",
        isArchived: true,
      },
    ];
    const cms = createClient({
      sources: {
        mock: {
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
      lastEditedTime: "2024-01-01T00:00:00Z",
      isArchived: true,
    };
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
    });
    const result = await cms.posts.find("archived-post");
    expect(result).toBeNull();
  });
});

describe("CollectionClient — accessibleStatuses フィルタ", () => {
  it("accessibleStatuses にないステータスのアイテムは get で null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "draft-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
      status: "下書き",
    };
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
              accessibleStatuses: ["公開"],
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.find("draft-post");
    expect(result).toBeNull();
  });

  it("accessibleStatuses にステータスが含まれるアイテムは get で取得できる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "public-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
      status: "公開",
    };
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
              accessibleStatuses: ["公開"],
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.find("public-post");
    expect(result).not.toBeNull();
  });

  it("アイテムの status が undefined の場合は accessibleStatuses でフィルタして null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "no-status",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
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
              accessibleStatuses: ["公開"],
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.find("no-status");
    expect(result).toBeNull();
  });

  it("アイテムの status が null の場合は accessibleStatuses でフィルタして null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "null-status",
      lastEditedTime: "2024-01-01T00:00:00Z",
      status: null,
    };
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
              accessibleStatuses: ["公開"],
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.find("null-status");
    expect(result).toBeNull();
  });

  it("list() でも accessibleStatuses にないアイテムが除外される", async () => {
    const items: BaseContentItem[] = [
      {
        id: "1",
        slug: "public",
        lastEditedTime: "2024-01-01T00:00:00Z",
        status: "公開",
      },
      {
        id: "2",
        slug: "draft",
        lastEditedTime: "2024-01-01T00:00:00Z",
        status: "下書き",
      },
      { id: "3", slug: "no-status", lastEditedTime: "2024-01-01T00:00:00Z" },
    ];
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  return items;
                },
              }),
              slugField: "slug",
              accessibleStatuses: ["公開"],
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("public");
  });

  it("list() と find() で accessibleStatuses フィルタが一致する", async () => {
    const items: BaseContentItem[] = [
      {
        id: "1",
        slug: "public",
        lastEditedTime: "2024-01-01T00:00:00Z",
        status: "公開",
      },
      {
        id: "2",
        slug: "draft",
        lastEditedTime: "2024-01-01T00:00:00Z",
        status: "下書き",
      },
    ];
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  return items;
                },
              }),
              slugField: "slug",
              accessibleStatuses: ["公開"],
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const listed = await cms.posts.list();
    const slugsFromList = listed
      .map((i) => i.slug)
      .filter((s): s is string => s != null);

    for (const slug of slugsFromList) {
      const got = await cms.posts.find(slug);
      expect(got).not.toBeNull();
    }
    const excluded = await cms.posts.find("draft");
    expect(excluded).toBeNull();
  });
});

describe("CollectionClient — コンテンツアクセサ", () => {
  it("html() は HTML 文字列を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-html",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
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
    });
    const result = await cms.posts.find("post-html");
    expect(result).not.toBeNull();
    const html = await result?.html();
    expect(typeof html).toBe("string");
  });

  it("markdown() は Markdown 文字列を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-with-md",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const loadMarkdown = vi.fn().mockResolvedValue("# Hello World");
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
    });
    const result = await cms.posts.find("post-with-md");
    expect(result).not.toBeNull();
    const md = await result?.markdown();
    expect(md).toBe("# Hello World");
  });

  it("blocks() はコンテンツ AST を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-blocks",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const fakeBlocks = [{ type: "paragraph", content: [] }];
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  return [item];
                },
                async loadBlocks() {
                  return fakeBlocks as never;
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.find("post-blocks");
    expect(result).not.toBeNull();
    const blocks = await result?.blocks();
    expect(blocks).toEqual(fakeBlocks);
  });

  it("statuses を単一文字列で指定すると一致するアイテムだけ返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
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
        },
      },
    });
    const items = await cms.posts.list({ statuses: "公開" });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.status === "公開")).toBe(true);
  });

  it("html() を複数回呼んでも loadMarkdown は 1 回のみ呼ばれる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "post-lazy",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const loadMarkdown = vi.fn().mockResolvedValue("# Lazy");
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
    });
    const result = await cms.posts.find("post-lazy");
    expect(result).not.toBeNull();
    await result?.html();
    await result?.html();
    expect(loadMarkdown).toHaveBeenCalledTimes(1);
  });

  it("notionBlocks() が undefined のとき blocksFetcher 設定を一度だけ警告する", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "no-blocks",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const warn = vi.fn();
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              // loadNotionBlocks を持たない source → notionBlocks は常に undefined
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
      logger: { warn },
    });
    const result = await cms.posts.find("no-blocks");
    expect(await result?.notionBlocks()).toBeUndefined();
    expect(await result?.notionBlocks()).toBeUndefined();
    // 無言失敗を避けるための案内。ノイズ防止のため一度だけ。
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("blocksFetcher");
  });
});

describe("CollectionClient — check()", () => {
  it("lastEditedTime が一致するときは { stale: false } を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check("my-post", "2024-01-01T00:00:00Z");
    expect(result).toEqual({ stale: false });
  });

  it("lastEditedTime が異なるときは { stale: true, item } を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "updated-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check(
      "updated-post",
      "2024-01-01T00:00:00Z",
    );
    expect(result).not.toBeNull();
    expect(result?.stale).toBe(true);
    if (result?.stale) {
      expect(result.item.slug).toBe("updated-post");
      expect(result.item.lastEditedTime).toBe("2024-01-02T00:00:00Z");
    }
  });

  it("stale のとき html() が HTML を返す", async () => {
    const loadMarkdown = vi.fn().mockResolvedValue("# Updated");
    const item: BaseContentItem = {
      id: "1",
      slug: "render-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check("render-post", "2024-01-01T00:00:00Z");
    if (result?.stale) {
      const html = await result.item.html();
      expect(typeof html).toBe("string");
      expect(loadMarkdown).toHaveBeenCalled();
    }
  });

  it("存在しない slug は null を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
          collections: {
            posts: { source: makeMockSource(), slugField: "slug" },
          },
        },
      },
    });
    const result = await cms.posts.check("nonexistent", "2024-01-01T00:00:00Z");
    expect(result).toBeNull();
  });

  it("accessibleStatuses にないアイテムは null を返す", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "draft-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
      status: "下書き",
    };
    const cms = createClient({
      renderer: mockRenderer,
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
              accessibleStatuses: ["公開"],
            },
          },
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
      lastEditedTime: "2024-01-02T00:00:00Z",
    };
    const findByProp = vi.fn().mockResolvedValue(item);
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                findByProp,
                properties: { slug: { type: "richText", notion: "Slug" } },
              }),
              slugField: "slug",
            },
          },
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
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const findByProp = vi.fn().mockResolvedValue(item);
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                findByProp,
                properties: { slug: { type: "richText", notion: "Slug" } },
              }),
              slugField: "slug",
            },
          },
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

  it("stale のとき後続の find() でメタが更新されている", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "cache-update-post",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };
    const cache = memoryCache();
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
      cache: [cache],
      renderer: mockRenderer,
    });
    await cms.posts.check("cache-update-post", "2024-01-01T00:00:00Z");
    const meta = await cache.doc?.getMeta("posts", "cache-update-post");
    expect(meta?.item.lastEditedTime).toBe("2024-01-02T00:00:00Z");
  });

  it("currentVersion が空文字のとき lastEditedTime が何であっても stale: true になる", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "empty-version-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
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
    });
    const result = await cms.posts.check("empty-version-post", "");
    expect(result?.stale).toBe(true);
  });
});

describe("CollectionClient — find() bypassCache", () => {
  it("bypassCache: true はキャッシュを無視してソースから取得する", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "live-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    let callCount = 0;
    const source = makeMockSource({
      async list() {
        callCount++;
        return [item];
      },
    });
    const cache = memoryCache();
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: { collections: { posts: { source, slugField: "slug" } } },
      },
      cache: [cache],
    });

    await cms.posts.find("live-post");
    const beforeBypass = callCount;

    const result = await cms.posts.find("live-post", { bypassCache: true });
    expect(result).not.toBeNull();
    expect(callCount).toBeGreaterThan(beforeBypass);
  });

  it("bypassCache: true で存在しない slug は null を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
          collections: {
            posts: { source: makeMockSource(), slugField: "slug" },
          },
        },
      },
    });
    const result = await cms.posts.find("nonexistent", { bypassCache: true });
    expect(result).toBeNull();
  });
});

describe("CollectionClient — slugField + findByProp", () => {
  it("slugField と findByProp が設定されていると効率的なプロパティ検索を使う", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
      status: "公開",
    };
    const findByProp = vi.fn().mockResolvedValue(item);
    const cms = createClient({
      sources: {
        mock: {
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
        },
      },
      renderer: mockRenderer,
    });
    const result = await cms.posts.find("my-post");
    expect(result).not.toBeNull();
    expect(findByProp).toHaveBeenCalledWith("Slug", "my-post");
  });
});

describe("CollectionClient — cache.prime", () => {
  it("単件を取得してメタ・本文キャッシュを作り直す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: {
        mock: {
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
        },
      },
    });
    await cms.posts.cache.prime("alpha");
    const version = await cms.posts.peekVersion("alpha");
    expect(version).not.toBeNull();
    expect(version?.notionUpdatedAt).toBe("2024-01-01T00:00:00Z");
  });

  it("存在しない slug は何もしない", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: {
        mock: {
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
        },
      },
    });
    await cms.posts.cache.prime("missing");
    expect(await cms.posts.peekVersion("missing")).toBeNull();
  });
});

describe("cms.warmByPageId", () => {
  it("findById で解決したページを温め collection / slug を返す", async () => {
    const findById = vi
      .fn()
      .mockImplementation(
        async (id: string) => makeItems().find((i) => i.id === id) ?? null,
      );
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                findById,
                async list() {
                  return makeItems();
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
    });
    const result = await cms.warmByPageId("3");
    expect(result).toEqual({ collection: "posts", slug: "gamma" });
    expect(findById).toHaveBeenCalledWith("3");
    expect(await cms.posts.peekVersion("gamma")).not.toBeNull();
  });

  it("findById 未実装なら list を id で走査して解決する", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: {
        mock: {
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
        },
      },
    });
    expect(await cms.warmByPageId("1")).toEqual({
      collection: "posts",
      slug: "alpha",
    });
  });

  it("どのコレクションにも属さない page id は null を返す", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: {
        mock: {
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
        },
      },
    });
    expect(await cms.warmByPageId("nonexistent")).toBeNull();
  });
});
