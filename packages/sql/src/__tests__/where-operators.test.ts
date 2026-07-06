import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { sqliteIndexStore } from "../sqlite.js";

const schema = defineSchema({
  posts: defineCollection({
    dataSourceId: "ds-posts",
    properties: {
      title: prop.richText(),
      category: prop.select(),
      tags: prop.multiSelect(),
      publishedAt: prop.date(),
      featured: prop.checkbox(),
      views: prop.number(),
    },
  }),
});

function makeStore() {
  return sqliteIndexStore(new Database(":memory:"), schema);
}

describe("where 演算子(sqlite)", () => {
  it("contains/startsWith はテキストを部分一致で絞り込む", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { title: "Hello World" },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { title: "Goodbye" },
    });

    const contains = await store.listEntries("posts", { where: { title: { contains: "World" } } });
    expect(contains.items.map((e) => e.slug)).toEqual(["a"]);

    const startsWith = await store.listEntries("posts", {
      where: { title: { startsWith: "Good" } },
    });
    expect(startsWith.items.map((e) => e.slug)).toEqual(["b"]);
  });

  it("isEmpty は空文字を判定する", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { title: "" },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { title: "filled" },
    });

    const empty = await store.listEntries("posts", { where: { title: { isEmpty: true } } });
    expect(empty.items.map((e) => e.slug)).toEqual(["a"]);

    const notEmpty = await store.listEntries("posts", { where: { title: { isEmpty: false } } });
    expect(notEmpty.items.map((e) => e.slug)).toEqual(["b"]);
  });

  it("in は select の値集合で絞り込む", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { category: "tech" },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { category: "life" },
    });

    const result = await store.listEntries("posts", {
      where: { category: { in: ["tech", "other"] } },
    });
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("has/hasAny/hasAll は multiSelect(JSON 配列)を評価する", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { tags: ["tech", "notion"] },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { tags: ["life"] },
    });

    const has = await store.listEntries("posts", { where: { tags: { has: "tech" } } });
    expect(has.items.map((e) => e.slug)).toEqual(["a"]);

    const hasAny = await store.listEntries("posts", {
      where: { tags: { hasAny: ["life", "missing"] } },
    });
    expect(hasAny.items.map((e) => e.slug)).toEqual(["b"]);

    const hasAll = await store.listEntries("posts", {
      where: { tags: { hasAll: ["tech", "notion"] } },
    });
    expect(hasAll.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("date の範囲演算子(before/after/onOrAfter)を評価する", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { publishedAt: "2026-01-01" },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { publishedAt: "2026-06-01" },
    });

    const before = await store.listEntries("posts", {
      where: { publishedAt: { before: "2026-03-01" } },
    });
    expect(before.items.map((e) => e.slug)).toEqual(["a"]);

    const after = await store.listEntries("posts", {
      where: { publishedAt: { after: "2026-03-01" } },
    });
    expect(after.items.map((e) => e.slug)).toEqual(["b"]);

    const onOrAfter = await store.listEntries("posts", {
      where: { publishedAt: { onOrAfter: "2026-01-01" } },
    });
    expect(onOrAfter.items.map((e) => e.slug)).toEqual(["a", "b"]);
  });

  it("checkbox(boolean)は 0/1 として比較する", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { featured: true },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { featured: false },
    });

    const result = await store.listEntries("posts", { where: { featured: { equals: true } } });
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("number の gt/gte/lt/lte を評価する", async () => {
    const store = makeStore();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { views: 10 },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { views: 20 },
    });

    const gt = await store.listEntries("posts", { where: { views: { gt: 10 } } });
    expect(gt.items.map((e) => e.slug)).toEqual(["b"]);

    const lte = await store.listEntries("posts", { where: { views: { lte: 10 } } });
    expect(lte.items.map((e) => e.slug)).toEqual(["a"]);
  });
});
