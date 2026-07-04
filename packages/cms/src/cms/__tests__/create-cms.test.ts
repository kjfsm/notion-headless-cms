import type { PageObjectResponse } from "@notionhq/client";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { memoryBlobStore, memoryDocStore } from "../../store/memory.js";
import { createNodeSyncScheduler } from "../../sync/node-scheduler.js";
import type { NotionClientLike } from "../../sync/notion-driver.js";
import { defineCollection, defineSchema } from "../../types/collection.js";
import { prop } from "../../types/property.js";
import { createCMS } from "../create-cms.js";

const posts = defineCollection({
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

const news = defineCollection({
  dataSourceId: "ds-news",
  slug: "slug",
  properties: { heading: prop.title(), slug: prop.richText() },
});

const schema = defineSchema({ posts, news });

function richText(text: string) {
  return [{ type: "text", plain_text: text, text: { content: text } }];
}

function notionPage(opts: {
  id: string;
  dataSourceId: string;
  slug: string;
  title?: string;
  titleKey?: string;
  status?: string;
}): PageObjectResponse {
  const titleKey = opts.titleKey ?? "title";
  return {
    object: "page" as const,
    id: opts.id,
    url: `https://notion.so/${opts.id}`,
    last_edited_time: "2026-01-01T00:00:00.000Z",
    properties: {
      [titleKey]: { type: "title", title: richText(opts.title ?? "Title") },
      slug: { type: "rich_text", rich_text: richText(opts.slug) },
      ...(opts.status
        ? { status: { type: "status", status: { name: opts.status } } }
        : {}),
    },
  } as unknown as PageObjectResponse;
}

function makeFakeClient(
  pagesByDataSource: Record<string, ReturnType<typeof notionPage>[]>,
): NotionClientLike {
  return {
    dataSources: {
      query: vi.fn(async ({ data_source_id }) => ({
        results: pagesByDataSource[data_source_id] ?? [],
        next_cursor: null,
        has_more: false,
      })),
    },
    pages: { retrieve: vi.fn().mockRejectedValue(new Error("not found")) },
    blocks: {
      children: {
        list: vi.fn().mockResolvedValue({
          results: [],
          next_cursor: null,
          has_more: false,
        }),
      },
    },
  };
}

function makeStores() {
  return { docs: memoryDocStore(), blobs: memoryBlobStore() };
}

describe("createCMS", () => {
  it("kick が全コレクションを同期し、find/list が読める", async () => {
    const client = makeFakeClient({
      "ds-posts": [
        notionPage({
          id: "p1",
          dataSourceId: "ds-posts",
          slug: "hello",
          title: "Hello",
          status: "published",
        }),
      ],
      "ds-news": [
        notionPage({
          id: "n1",
          dataSourceId: "ds-news",
          slug: "flash",
          title: "Flash",
          titleKey: "heading",
        }),
      ],
    });

    const cms = createCMS({
      schema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });

    await cms.sync.kick();

    const post = await cms.posts.find("hello");
    expect(post?.meta.title).toBe("Hello");
    expect(post?.slug).toBe("hello");

    const newsItem = await cms.news.find("flash");
    expect(newsItem?.meta.heading).toBe("Flash");

    const list = await cms.posts.list();
    expect(list.items.map((i) => i.slug)).toEqual(["hello"]);

    const state = await cms.sync.getState();
    expect(state.failures).toEqual([]);
  });

  it("find は存在しない slug には null を返す(Notion API を呼ばない)", async () => {
    const client = makeFakeClient({});
    const cms = createCMS({
      schema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });
    expect(await cms.posts.find("missing")).toBeNull();
    expect(client.dataSources.query).not.toHaveBeenCalled();
  });

  it("list の where/sort が型付きで動く", async () => {
    const client = makeFakeClient({
      "ds-posts": [
        notionPage({
          id: "p1",
          dataSourceId: "ds-posts",
          slug: "a",
          title: "A",
          status: "published",
        }),
        notionPage({
          id: "p2",
          dataSourceId: "ds-posts",
          slug: "b",
          title: "B",
          status: "draft",
        }),
      ],
    });
    const cms = createCMS({
      schema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });
    await cms.sync.kick();

    // draft は published のみを既定表示する list には出てこない(限定公開)。
    const listed = await cms.posts.list();
    expect(listed.items.map((i) => i.slug)).toEqual(["a"]);

    const filtered = await cms.posts.list({
      where: { status: { equals: "published" } },
    });
    expect(filtered.items.map((i) => i.slug)).toEqual(["a"]);
  });

  it("予約されたコレクション名は CMSError(schema/reserved_collection_name) を投げる", () => {
    const badSchema = defineSchema({
      sync: defineCollection({
        dataSourceId: "ds",
        slug: "slug",
        properties: { slug: prop.richText() },
      }),
    });
    expect(() =>
      createCMS({
        schema: badSchema,
        notion: { client: makeFakeClient({}) },
        stores: makeStores(),
        scheduler: createNodeSyncScheduler(),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "schema/reserved_collection_name" }),
    );
  });

  it('"stats" はトップレベル API と衝突しないため予約名扱いしない(sync.stats() の内側にネストされるだけ)', () => {
    const okSchema = defineSchema({
      stats: defineCollection({
        dataSourceId: "ds",
        slug: "slug",
        properties: { slug: prop.richText() },
      }),
    });
    expect(() =>
      createCMS({
        schema: okSchema,
        notion: { client: makeFakeClient({}) },
        stores: makeStores(),
        scheduler: createNodeSyncScheduler(),
      }),
    ).not.toThrow();
  });

  it('コレクション名に ":" を含む場合は CMSError(schema/reserved_collection_name) を投げる', () => {
    const badSchema = defineSchema({
      "a:b": defineCollection({
        dataSourceId: "ds",
        slug: "slug",
        properties: { slug: prop.richText() },
      }),
    });
    expect(() =>
      createCMS({
        schema: badSchema,
        notion: { client: makeFakeClient({}) },
        stores: makeStores(),
        scheduler: createNodeSyncScheduler(),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "schema/reserved_collection_name" }),
    );
  });

  it("notion.client も token も無ければ CMSError(schema/notion_config_missing) を投げる", () => {
    expect(() =>
      createCMS({
        schema,
        notion: {},
        stores: makeStores(),
        scheduler: createNodeSyncScheduler(),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "schema/notion_config_missing" }),
    );
  });

  it("fetch は webhook を受けて debounce 後に同期をキックする", async () => {
    vi.useFakeTimers();
    try {
      const client = makeFakeClient({
        "ds-posts": [
          notionPage({
            id: "p1",
            dataSourceId: "ds-posts",
            slug: "hello",
            title: "Hello",
            status: "published",
          }),
        ],
      });
      const cms = createCMS({
        schema,
        notion: { client },
        stores: makeStores(),
        scheduler: createNodeSyncScheduler(),
        webhookSecret: "s3cr3t",
      });
      const { hmacSha256Hex } = await import("../../http/webhook.js");
      const body = JSON.stringify({ entity: { type: "page", id: "p1" } });
      const signature = `sha256=${await hmacSha256Hex("s3cr3t", body)}`;
      const res = await cms.fetch(
        new Request("https://x/api/cms/webhook", {
          method: "POST",
          headers: { "X-Notion-Signature": signature },
          body,
        }),
      );
      expect(res.status).toBe(200);
      // debounce 前はまだ同期されていない。
      expect(await cms.posts.find("hello")).toBeNull();

      // debounceMs(3000) + レートリミッタ(3req/s)による複数 Notion 呼び出し間の待機分を見込む。
      await vi.advanceTimersByTimeAsync(6000);
      const post = await cms.posts.find("hello");
      expect(post?.meta.title).toBe("Hello");
    } finally {
      vi.useRealTimers();
    }
  });

  it("scheduled は reconcile を実行する", async () => {
    const client = makeFakeClient({});
    const cms = createCMS({
      schema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });
    await cms.scheduled();
    const state = await cms.sync.getState();
    expect(state.lastReconcileAt).not.toBeNull();
  });

  it("型推論: find の戻り値 meta はスキーマから推論された型になる", () => {
    const client = makeFakeClient({});
    const cms = createCMS({
      schema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });
    expectTypeOf(cms.posts.find).parameter(0).toEqualTypeOf<string>();

    type PostMeta = NonNullable<
      Awaited<ReturnType<typeof cms.posts.find>>
    >["meta"];
    expectTypeOf<PostMeta["status"]>().toEqualTypeOf<"draft" | "published">();
    expectTypeOf<PostMeta["title"]>().toEqualTypeOf<string>();

    type NewsMeta = NonNullable<
      Awaited<ReturnType<typeof cms.news.find>>
    >["meta"];
    expectTypeOf<NewsMeta["heading"]>().toEqualTypeOf<string>();
    expectTypeOf<NewsMeta>().not.toHaveProperty("status");
  });

  it("型推論: list の戻り値 meta もスキーマから推論された型になる", () => {
    const client = makeFakeClient({});
    const cms = createCMS({
      schema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });
    type PostListMeta = Awaited<
      ReturnType<typeof cms.posts.list>
    >["items"][number]["meta"];
    expectTypeOf<PostListMeta["status"]>().toEqualTypeOf<
      "draft" | "published"
    >();
    expectTypeOf<PostListMeta["title"]>().toEqualTypeOf<string>();
    expectTypeOf<PostListMeta["slug"]>().toEqualTypeOf<string>();
  });

  it("slug 未設定コレクションは page id で list/find でき、list の meta も型付く", async () => {
    const siteTexts = defineCollection({
      dataSourceId: "ds-texts",
      properties: { key: prop.title("名前"), text: prop.richText("テキスト") },
    });
    const dataSchema = defineSchema({ siteTexts });
    const textPage = {
      object: "page" as const,
      id: "page-xyz",
      url: "https://notion.so/page-xyz",
      last_edited_time: "2026-01-01T00:00:00.000Z",
      properties: {
        名前: { type: "title", title: richText("サブタイトル") },
        テキスト: { type: "rich_text", rich_text: richText("最高のバンド") },
      },
    } as unknown as PageObjectResponse;
    const client: NotionClientLike = {
      dataSources: {
        query: vi.fn(async ({ data_source_id }) => ({
          results: data_source_id === "ds-texts" ? [textPage] : [],
          next_cursor: null,
          has_more: false,
        })),
      },
      pages: { retrieve: vi.fn().mockRejectedValue(new Error("not found")) },
      blocks: {
        children: {
          list: vi.fn().mockResolvedValue({
            results: [],
            next_cursor: null,
            has_more: false,
          }),
        },
      },
    };

    const cms = createCMS({
      schema: dataSchema,
      notion: { client },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
    });
    await cms.sync.kick();

    const list = await cms.siteTexts.list();
    expect(list.items.map((i) => i.meta.key)).toEqual(["サブタイトル"]);
    // slug プロパティ未設定なのでキーは page id。
    expect(list.items[0]?.slug).toBe("page-xyz");

    const found = await cms.siteTexts.find("page-xyz");
    expect(found?.meta.text).toBe("最高のバンド");

    type TextListMeta = Awaited<
      ReturnType<typeof cms.siteTexts.list>
    >["items"][number]["meta"];
    expectTypeOf<TextListMeta["key"]>().toEqualTypeOf<string>();
  });

  it("logger: syncEntry を debug ログに出し、logLevel でレベルを絞れる", async () => {
    const post = () =>
      notionPage({
        id: "p1",
        dataSourceId: "ds-posts",
        slug: "hello",
        title: "Hello",
        status: "published",
      });

    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const cms = createCMS({
      schema,
      notion: { client: makeFakeClient({ "ds-posts": [post()] }) },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
      logger,
    });
    await cms.sync.kick();
    expect(logger.debug).toHaveBeenCalledWith(
      "entry を materialize しました",
      expect.objectContaining({ operation: "syncEntry", slug: "hello" }),
    );

    // logLevel: "warn" は debug を抑制する。
    const logger2 = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const cms2 = createCMS({
      schema,
      notion: { client: makeFakeClient({ "ds-posts": [post()] }) },
      stores: makeStores(),
      scheduler: createNodeSyncScheduler(),
      logger: logger2,
      logLevel: "warn",
    });
    await cms2.sync.kick();
    expect(logger2.debug).not.toHaveBeenCalled();
  });

  it("syncDelegate 未指定で scheduler も無ければ CMSError(schema/scheduler_missing) を投げる", () => {
    const client = makeFakeClient({});
    expect(() =>
      createCMS({
        schema,
        notion: { client },
        stores: makeStores(),
      }),
    ).toThrowError(
      expect.objectContaining({ code: "schema/scheduler_missing" }),
    );
  });

  it("syncDelegate 指定時は notion/scheduler 無しでも動作し、sync.* が委譲先を呼ぶ", async () => {
    const stores = makeStores();
    // find/list が読めることを確認するため、事前にストアへ直接書き込んでおく
    // (syncDelegate 使用時はローカルの SyncCoordinatorCore を持たないため kick() 経由の同期はできない)。
    await stores.docs.put(
      "list-index:posts",
      JSON.stringify([
        {
          slug: "hello",
          version: "v1",
          listed: true,
          meta: { title: "Hello" },
        },
      ]),
    );

    const delegate = {
      kick: vi.fn().mockResolvedValue(undefined),
      onWebhook: vi.fn().mockResolvedValue(undefined),
      reconcile: vi.fn().mockResolvedValue({ removed: ["gone"] }),
      getState: vi.fn().mockResolvedValue({
        cursor: null,
        lastSyncAt: "2026-01-01T00:00:00.000Z",
        lastReconcileAt: null,
        failures: [],
      }),
      stats: vi.fn().mockResolvedValue({
        lastSyncAt: "2026-01-01T00:00:00.000Z",
        lastReconcileAt: null,
        failureCount: 0,
        recentFailures: [],
      }),
    };

    const cms = createCMS({ schema, stores, syncDelegate: delegate });

    await cms.sync.kick();
    expect(delegate.kick).toHaveBeenCalledTimes(1);

    await cms.sync.onWebhook();
    expect(delegate.onWebhook).toHaveBeenCalledTimes(1);

    const reconcileResult = await cms.sync.reconcile();
    expect(reconcileResult).toEqual({ removed: ["gone"] });

    const state = await cms.sync.getState();
    expect(state.lastSyncAt).toBe("2026-01-01T00:00:00.000Z");

    const stats = await cms.sync.stats();
    expect(stats.lastSyncAt).toBe("2026-01-01T00:00:00.000Z");

    await cms.scheduled();
    expect(delegate.reconcile).toHaveBeenCalledTimes(2);

    const list = await cms.posts.list();
    expect(list.items.map((i) => i.slug)).toEqual(["hello"]);
  });
});
