import { describe, expect, it, vi } from "vitest";
import type { IndexStore } from "../../store/index-store.js";
import { createIndexStore } from "../../store/index-store.js";
import { memoryDocStore } from "../../store/memory.js";
import { defineCollection, defineSchema } from "../../types/collection.js";
import { prop } from "../../types/property.js";
import { buildPageIndex, createMemoizedPageIndex } from "../page-index.js";

const posts = defineCollection({
  dataSourceId: "ds-posts",
  slug: "slug",
  properties: { title: prop.title(), slug: prop.richText() },
});

const news = defineCollection({
  dataSourceId: "ds-news",
  slug: "slug",
  properties: { heading: prop.title(), slug: prop.richText() },
});

const schema = defineSchema({ posts, news });

describe("buildPageIndex", () => {
  it("各コレクションの title 型プロパティを検出して title を組み立てる", async () => {
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    await indexStore.upsertEntry("posts", {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: { id: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", title: "Hello" },
    });
    await indexStore.upsertEntry("news", {
      slug: "flash",
      version: "v1",
      listed: true,
      meta: {
        id: "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB",
        heading: "Flash News",
      },
    });

    const pageIndex = await buildPageIndex(schema, indexStore);

    expect(pageIndex["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]).toEqual({
      collection: "posts",
      slug: "hello",
      title: "Hello",
    });
    expect(pageIndex["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]).toEqual({
      collection: "news",
      slug: "flash",
      title: "Flash News",
    });
  });

  it("id が meta に無いエントリはスキップする", async () => {
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    await indexStore.upsertEntry("posts", {
      slug: "no-id",
      version: "v1",
      listed: true,
      meta: { title: "No Id" },
    });
    const pageIndex = await buildPageIndex(schema, indexStore);
    expect(Object.keys(pageIndex)).toHaveLength(0);
  });

  it("title 型プロパティが無いコレクションは title: null にする", async () => {
    const dataOnly = defineCollection({
      dataSourceId: "ds-data",
      slug: "slug",
      properties: { slug: prop.richText(), value: prop.number() },
    });
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    await indexStore.upsertEntry("dataOnly", {
      slug: "d1",
      version: "v1",
      listed: true,
      meta: { id: "CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC", value: 1 },
    });
    const pageIndex = await buildPageIndex(
      defineSchema({ dataOnly }),
      indexStore,
    );
    expect(pageIndex["cccccccccccccccccccccccccccccccc"]).toEqual({
      collection: "dataOnly",
      slug: "d1",
      title: null,
    });
  });

  it("index が空のコレクションは何も追加しない", async () => {
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    const pageIndex = await buildPageIndex(schema, indexStore);
    expect(pageIndex).toEqual({});
  });
});

describe("createMemoizedPageIndex", () => {
  function spyListAllEntries(indexStore: IndexStore) {
    const spy = vi.spyOn(indexStore, "listAllEntries");
    return spy;
  }

  it("manifest への書き込みが無い限り buildPageIndex を再実行しない", async () => {
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    await indexStore.upsertEntry("posts", {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: { id: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", title: "Hello" },
    });
    const listAllEntries = spyListAllEntries(indexStore);

    const { pageIndex } = createMemoizedPageIndex(schema, indexStore);
    await pageIndex();
    await pageIndex();
    await pageIndex();

    // 3 回呼んでも実際の全件読み取りは 1 回だけ(コレクション数ぶん)。
    expect(listAllEntries).toHaveBeenCalledTimes(
      Object.keys(schema.collections).length,
    );
  });

  it("driverIndexStore 経由の書き込み(wrote:true)があればキャッシュを無効化する", async () => {
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    const listAllEntries = spyListAllEntries(indexStore);
    const { pageIndex, indexStore: driverIndexStore } = createMemoizedPageIndex(
      schema,
      indexStore,
    );

    await pageIndex();
    const firstCallCount = listAllEntries.mock.calls.length;

    await driverIndexStore.upsertEntry("posts", {
      slug: "new",
      version: "v1",
      listed: true,
      meta: { id: "DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD", title: "New" },
    });
    await pageIndex();

    // 書き込み後は再度 buildPageIndex が走る(キャッシュが無効化されている)。
    expect(listAllEntries.mock.calls.length).toBeGreaterThan(firstCallCount);
    const result = await pageIndex();
    expect(result["dddddddddddddddddddddddddddddddd"]).toEqual({
      collection: "posts",
      slug: "new",
      title: "New",
    });
  });

  it("差分が無い書き込み(wrote:false)はキャッシュを無効化しない", async () => {
    const docs = memoryDocStore();
    const indexStore = createIndexStore(docs);
    const entry = {
      slug: "hello",
      version: "v1",
      listed: true,
      meta: { id: "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", title: "Hello" },
    };
    await indexStore.upsertEntry("posts", entry);
    const listAllEntries = spyListAllEntries(indexStore);
    const { pageIndex, indexStore: driverIndexStore } = createMemoizedPageIndex(
      schema,
      indexStore,
    );

    await pageIndex();
    const firstCallCount = listAllEntries.mock.calls.length;

    // 同一 version の upsert は wrote:false(差分無し)になる。
    const result = await driverIndexStore.upsertEntry("posts", entry);
    expect(result.wrote).toBe(false);
    await pageIndex();

    expect(listAllEntries.mock.calls.length).toBe(firstCallCount);
  });
});
