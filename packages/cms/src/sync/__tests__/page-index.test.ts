import { describe, expect, it } from "vitest";

import { createIndexStore } from "../../store/index-store.js";
import { memoryDocStore } from "../../store/memory.js";
import { defineCollection, defineSchema } from "../../types/collection.js";
import { prop } from "../../types/property.js";
import { buildPageIndex } from "../page-index.js";

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
    const pageIndex = await buildPageIndex(defineSchema({ dataOnly }), indexStore);
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
