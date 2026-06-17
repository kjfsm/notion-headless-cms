import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createClient } from "../cms";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";
import type { RealtimeAdapter } from "../types/realtime";

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

function makeRealtime(
  publish: RealtimeAdapter["publish"] = vi.fn().mockResolvedValue(undefined),
): RealtimeAdapter {
  return { name: "test-realtime", publish };
}

describe("realtime 更新通知", () => {
  it("find の SWR 差分検出時に publish({collection, slug, version}) を発行する", async () => {
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
      cachedAt: 0,
    });

    const captured: Promise<unknown>[] = [];
    const realtime = makeRealtime();
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  return [freshItem];
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
      renderer: mockRenderer,
      cache: [cache],
      realtime,
      waitUntil: (p) => {
        captured.push(p);
      },
    });

    await cms.posts.find("my-post");
    await Promise.all(captured);

    expect(realtime.publish).toHaveBeenCalledWith({
      collection: "posts",
      slug: "my-post",
      version: "2024-01-02T00:00:00Z",
    });
  });

  it("差分なしでは publish を発行しない", async () => {
    const item: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", {
      item,
      notionUpdatedAt: item.lastEditedTime,
      cachedAt: 0,
    });

    const captured: Promise<unknown>[] = [];
    const realtime = makeRealtime();
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
      realtime,
      waitUntil: (p) => {
        captured.push(p);
      },
    });

    await cms.posts.find("my-post");
    await Promise.all(captured);

    expect(realtime.publish).not.toHaveBeenCalled();
  });

  it("warmByPageId（webhook 経路）で publish を発行する", async () => {
    const item: BaseContentItem = {
      id: "page-1",
      slug: "my-post",
      lastEditedTime: "2024-01-03T00:00:00Z",
    };

    const realtime = makeRealtime();
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
      cache: [memoryCache()],
      realtime,
    });

    const result = await cms.warmByPageId("page-1");

    expect(result).toEqual({ collection: "posts", slug: "my-post" });
    expect(realtime.publish).toHaveBeenCalledWith({
      collection: "posts",
      slug: "my-post",
      version: "2024-01-03T00:00:00Z",
    });
  });

  it("list の SWR 差分検出時に publish({collection, version})（slug なし）を発行する", async () => {
    const oldItem: BaseContentItem = {
      id: "page-1",
      slug: "a",
      lastEditedTime: "2024-01-01T00:00:00Z",
    };
    const newItem: BaseContentItem = {
      id: "page-2",
      slug: "b",
      lastEditedTime: "2024-01-02T00:00:00Z",
    };

    const cache = memoryCache();
    await cache.doc?.setList("posts", { items: [oldItem], cachedAt: 0 });

    const captured: Promise<unknown>[] = [];
    const realtime = makeRealtime();
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  return [oldItem, newItem];
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
      renderer: mockRenderer,
      cache: [cache],
      realtime,
      waitUntil: (p) => {
        captured.push(p);
      },
    });

    await cms.posts.list();
    await Promise.all(captured);

    expect(realtime.publish).toHaveBeenCalledWith({
      collection: "posts",
      version: "2024-01-01T00:00:00Z,2024-01-02T00:00:00Z",
    });
  });

  it("publish が throw してもキャッシュ更新・戻り値は壊れない（fail-soft）", async () => {
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
      cachedAt: 0,
    });

    const captured: Promise<unknown>[] = [];
    const realtime = makeRealtime(
      vi.fn().mockRejectedValue(new Error("transport down")),
    );
    const cms = createClient({
      sources: {
        mock: {
          collections: {
            posts: {
              source: makeMockSource({
                async list() {
                  return [freshItem];
                },
              }),
              slugField: "slug",
            },
          },
        },
      },
      renderer: mockRenderer,
      cache: [cache],
      realtime,
      waitUntil: (p) => {
        captured.push(p);
      },
    });

    const result = await cms.posts.find("my-post");
    expect(result).not.toBeNull();

    // publish が reject してもバックグラウンドタスクは reject せず完走する
    await expect(Promise.all(captured)).resolves.not.toThrow();
    expect(realtime.publish).toHaveBeenCalled();

    const updated = await cache.doc?.getMeta<BaseContentItem>(
      "posts",
      "my-post",
    );
    expect(updated?.item.lastEditedTime).toBe("2024-01-02T00:00:00Z");
  });
});
