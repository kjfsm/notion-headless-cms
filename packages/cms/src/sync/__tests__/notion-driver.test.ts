import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEntryStore } from "../../store/entry-store.js";
import { createIndexStore } from "../../store/index-store.js";
import { memoryBlobStore, memoryDocStore } from "../../store/memory.js";
import { defineCollection } from "../../types/collection.js";
import { prop } from "../../types/property.js";
import type { NotionClientLike } from "../notion-driver.js";
import { createCollectionDriver } from "../notion-driver.js";
import { createRateLimiter } from "../rate-limiter.js";

const def = defineCollection({
  dataSourceId: "ds-posts",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["draft", "published"] as const),
  },
  statusProperty: "status",
  published: ["published"],
  accessible: ["draft", "published"],
});

function richText(text: string) {
  return [{ type: "text", plain_text: text, text: { content: text } }];
}

function page(opts: {
  id: string;
  slug: string;
  title?: string;
  status?: string;
  lastEditedTime?: string;
}) {
  return {
    object: "page",
    id: opts.id,
    url: `https://notion.so/${opts.id}`,
    last_edited_time: opts.lastEditedTime ?? "2026-01-01T00:00:00.000Z",
    properties: {
      title: { type: "title", title: richText(opts.title ?? "タイトル") },
      slug: { type: "rich_text", rich_text: richText(opts.slug) },
      status: { type: "status", status: { name: opts.status ?? "published" } },
    },
  };
}

function makeClient(
  overrides: Partial<NotionClientLike> = {},
): NotionClientLike {
  return {
    dataSources: {
      query: vi.fn().mockResolvedValue({
        results: [],
        next_cursor: null,
        has_more: false,
      }),
    },
    pages: {
      retrieve: vi.fn().mockRejectedValue(new Error("not found")),
    },
    blocks: {
      children: {
        list: vi.fn().mockResolvedValue({
          results: [],
          next_cursor: null,
          has_more: false,
        }),
      },
    },
    ...overrides,
  };
}

function makeDeps() {
  const docs = memoryDocStore();
  const blobs = memoryBlobStore();
  const entryStore = createEntryStore(blobs);
  const indexStore = createIndexStore(docs);
  const rateLimiter = createRateLimiter({ requestsPerSecond: 1000 });
  return { entryStore, indexStore, blobs, rateLimiter };
}

describe("createCollectionDriver", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      }),
    );
  });

  it("listChanged: 降順クエリで変更を返し、version 一致で打ち切る", async () => {
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [
            page({
              id: "p1",
              slug: "a",
              lastEditedTime: "2026-02-01T00:00:00Z",
            }),
            page({
              id: "p2",
              slug: "b",
              lastEditedTime: "2026-01-15T00:00:00Z",
            }),
            page({
              id: "p3",
              slug: "c",
              lastEditedTime: "2026-01-01T00:00:00Z",
            }),
          ],
          next_cursor: null,
          has_more: false,
        }),
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    // "b" は既に version 一致で同期済みとして index に登録しておく。
    await indexStore.upsertEntry("posts", {
      slug: "b",
      version: "2026-01-15T00:00:00Z",
      listed: true,
      meta: {},
    });
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });

    const result = await driver.listChanged(null, 10);
    expect(result.changes).toEqual([
      { slug: "a", lastEditedTime: "2026-02-01T00:00:00Z" },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it("syncEntry: page を materialize して entryStore/indexStore に書き込む", async () => {
    const notionPage = page({ id: "p1", slug: "hello", title: "Hello World" });
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [notionPage],
          next_cursor: null,
          has_more: false,
        }),
      },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [
              {
                object: "block",
                id: "b1",
                type: "paragraph",
                has_children: false,
                paragraph: { rich_text: richText("本文") },
              },
            ],
            next_cursor: null,
            has_more: false,
          }),
        },
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });

    const { changes } = await driver.listChanged(null, 10);
    expect(changes).toHaveLength(1);
    const [change] = changes;
    if (!change) throw new Error("change が空です");
    await driver.syncEntry(change);

    const snapshot = await entryStore.get("posts", "hello");
    expect(snapshot?.slug).toBe("hello");
    expect(snapshot?.version).toBe("2026-01-01T00:00:00.000Z");
    expect(snapshot?.meta).toMatchObject({
      title: "Hello World",
      slug: "hello",
      status: "published",
    });
    expect(snapshot?.blocks[0]?.type).toBe("paragraph");

    const entry = await indexStore.findEntry("posts", "hello");
    expect(entry?.listed).toBe(true);
    expect(entry?.meta).toMatchObject({
      id: expect.any(String),
      title: "Hello World",
    });
  });

  it("notion 別名指定時は slug/status も実際のプロパティ名で解決する", async () => {
    const aliasedDef = defineCollection({
      dataSourceId: "ds-posts",
      slug: "slug",
      properties: {
        title: prop.title("名前"),
        slug: prop.richText("URL"),
        status: prop.status(["下書き", "公開済み"] as const, "ステータス"),
      },
      statusProperty: "status",
      published: ["公開済み"],
      accessible: ["下書き", "公開済み"],
    });
    const notionPage = {
      object: "page",
      id: "p1",
      url: "https://notion.so/p1",
      last_edited_time: "2026-01-01T00:00:00.000Z",
      properties: {
        名前: { type: "title", title: richText("テスト記事") },
        URL: { type: "rich_text", rich_text: richText("hello") },
        ステータス: { type: "status", status: { name: "公開済み" } },
      },
    };
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [notionPage],
          next_cursor: null,
          has_more: false,
        }),
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "posts",
      def: aliasedDef,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });

    const { changes } = await driver.listChanged(null, 10);
    expect(changes).toEqual([
      { slug: "hello", lastEditedTime: "2026-01-01T00:00:00.000Z" },
    ]);
    const [change] = changes;
    if (!change) throw new Error("change が空です");
    await driver.syncEntry(change);

    const snapshot = await entryStore.get("posts", "hello");
    expect(snapshot?.meta).toMatchObject({
      title: "テスト記事",
      slug: "hello",
      status: "公開済み",
    });
  });

  it("syncEntry: realtime 指定時は同期完了後に version 同梱で publish する(#437 ADR-5)", async () => {
    const notionPage = page({ id: "p1", slug: "hello", title: "Hello World" });
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [notionPage],
          next_cursor: null,
          has_more: false,
        }),
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const publish = vi.fn().mockResolvedValue(undefined);
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
      realtime: { publish },
    });

    const { changes } = await driver.listChanged(null, 10);
    const [change] = changes;
    if (!change) throw new Error("change が空です");
    await driver.syncEntry(change);

    expect(publish).toHaveBeenCalledWith(
      "c:posts",
      expect.objectContaining({
        collection: "posts",
        slug: "hello",
        version: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      "c:posts:hello",
      expect.objectContaining({ collection: "posts", slug: "hello" }),
    );
  });

  it("syncEntry: chunkCache 経由で listChanged 直後は pages.retrieve を呼ばない", async () => {
    const notionPage = page({ id: "p1", slug: "hello" });
    const retrieve = vi.fn();
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [notionPage],
          next_cursor: null,
          has_more: false,
        }),
      },
      pages: { retrieve },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });
    const { changes } = await driver.listChanged(null, 10);
    const [change] = changes;
    if (!change) throw new Error("change が空です");
    await driver.syncEntry(change);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("status が accessible 外なら entry を削除する(非公開化)", async () => {
    const client = makeClient();
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    await entryStore.put({
      collection: "posts",
      slug: "old",
      version: "v1",
      meta: {},
      blocks: [],
      images: {},
      links: {},
    });
    await indexStore.upsertEntry("posts", {
      slug: "old",
      version: "v1",
      listed: true,
      meta: {},
    });
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client: {
        ...client,
        pages: {
          retrieve: vi
            .fn()
            .mockResolvedValue(
              page({ id: "old", slug: "old", status: "archived" }),
            ),
        },
      },
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });

    await driver.syncEntry({ slug: "old", lastEditedTime: "v2" });

    expect(await entryStore.get("posts", "old")).toBeNull();
    expect(await indexStore.listAllEntries("posts")).toHaveLength(0);
  });

  it("slug が空なら CMSError(sync/slug_missing) を投げる", async () => {
    const notionPage = page({ id: "p1", slug: "" });
    const client = makeClient({
      pages: { retrieve: vi.fn().mockResolvedValue(notionPage) },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });

    await expect(
      driver.syncEntry({ slug: "p1", lastEditedTime: "v1" }),
    ).rejects.toMatchObject({ code: "sync/slug_missing" });
  });

  it("slug 未設定コレクションは page id をキーに materialize する", async () => {
    const dataDef = defineCollection({
      dataSourceId: "ds-texts",
      properties: {
        key: prop.title("名前"),
        text: prop.richText("テキスト"),
      },
    });
    const notionPage = {
      object: "page",
      id: "page-abc",
      url: "https://notion.so/page-abc",
      last_edited_time: "2026-01-01T00:00:00.000Z",
      properties: {
        名前: { type: "title", title: richText("サブタイトル") },
        テキスト: { type: "rich_text", rich_text: richText("最高のバンド") },
      },
    };
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [notionPage],
          next_cursor: null,
          has_more: false,
        }),
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "siteTexts",
      def: dataDef,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });

    const { changes } = await driver.listChanged(null, 10);
    // slug プロパティが無いため page id をキーにする。
    expect(changes).toEqual([
      { slug: "page-abc", lastEditedTime: "2026-01-01T00:00:00.000Z" },
    ]);
    const [change] = changes;
    if (!change) throw new Error("change が空です");
    await driver.syncEntry(change);

    const snapshot = await entryStore.get("siteTexts", "page-abc");
    expect(snapshot?.slug).toBe("page-abc");
    expect(snapshot?.meta).toMatchObject({
      key: "サブタイトル",
      text: "最高のバンド",
    });
    const entry = await indexStore.findEntry("siteTexts", "page-abc");
    // status 未設定なので既定で list 対象(listed: true)。
    expect(entry?.listed).toBe(true);
  });

  it("画像は blobs.head が既存なら外部 fetch をスキップする(重複回避)", async () => {
    const notionPage = page({ id: "p1", slug: "with-image" });
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [notionPage],
          next_cursor: null,
          has_more: false,
        }),
      },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [
              {
                object: "block",
                id: "img1",
                type: "image",
                has_children: false,
                image: {
                  type: "external",
                  external: { url: "https://example.com/a.png" },
                  caption: [],
                },
              },
            ],
            next_cursor: null,
            has_more: false,
          }),
        },
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    // 事前に該当ハッシュを R2 相当ストアへ put しておく(重複回避対象)。
    const { imageCacheKeySource, sha256Hex } = await import(
      "../../pipeline/images.js"
    );
    const hash = await sha256Hex(
      imageCacheKeySource("https://example.com/a.png"),
    );
    await blobs.put(`image/${hash}`, new Uint8Array([9, 9, 9]), {
      contentType: "image/png",
    });

    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });
    const { changes } = await driver.listChanged(null, 10);
    const [change] = changes;
    if (!change) throw new Error("change が空です");
    await driver.syncEntry(change);

    expect(fetchSpy).not.toHaveBeenCalled();
    const snapshot = await entryStore.get("posts", "with-image");
    expect(snapshot?.images[hash]).toMatchObject({ contentType: "image/png" });
  });

  it("listAllSlugs は accessible なページの slug のみ返す", async () => {
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockResolvedValue({
          results: [
            page({ id: "p1", slug: "a", status: "published" }),
            page({ id: "p2", slug: "b", status: "archived" }),
          ],
          next_cursor: null,
          has_more: false,
        }),
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });
    expect(await driver.listAllSlugs()).toEqual(["a"]);
  });

  it("listIndexedSlugs は index に登録済みの slug を返す", async () => {
    const client = makeClient();
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    await indexStore.upsertEntry("posts", {
      slug: "x",
      version: "v1",
      listed: true,
      meta: {},
    });
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });
    expect(await driver.listIndexedSlugs()).toEqual(["x"]);
  });

  it("removeEntry は entryStore/indexStore の両方から削除する", async () => {
    const client = makeClient();
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    await entryStore.put({
      collection: "posts",
      slug: "x",
      version: "v1",
      meta: {},
      blocks: [],
      images: {},
      links: {},
    });
    await indexStore.upsertEntry("posts", {
      slug: "x",
      version: "v1",
      listed: true,
      meta: {},
    });
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });
    await driver.removeEntry("x");
    expect(await entryStore.get("posts", "x")).toBeNull();
    expect(await indexStore.listAllEntries("posts")).toHaveLength(0);
  });

  it("dataSources.query が失敗すると CMSError(sync/notion_query_failed) に包む", async () => {
    const client = makeClient({
      dataSources: {
        query: vi.fn().mockRejectedValue(new Error("network down")),
      },
    });
    const { entryStore, indexStore, blobs, rateLimiter } = makeDeps();
    const driver = createCollectionDriver({
      collection: "posts",
      def,
      client,
      rateLimiter,
      entryStore,
      indexStore,
      blobs,
    });
    await expect(driver.listChanged(null, 10)).rejects.toMatchObject({
      code: "sync/notion_query_failed",
    });
  });
});
