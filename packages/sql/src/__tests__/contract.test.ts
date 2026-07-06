import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";
import { runIndexStoreContract } from "@notion-headless-cms/cms/testing";
import Database from "better-sqlite3";
import { describe } from "vitest";

import { libsqlIndexStore } from "../libsql.js";
import { sqliteIndexStore } from "../sqlite.js";

const schema = defineSchema({
  posts: defineCollection({
    dataSourceId: "ds-posts",
    properties: {
      title: prop.richText(),
      order: prop.number(),
      status: prop.select(),
      category: prop.select(),
    },
  }),
  fixedPages: defineCollection({ dataSourceId: "ds-fixed", properties: {} }),
});

describe("IndexStore contract: sqlite (better-sqlite3)", () => {
  runIndexStoreContract({
    factory: () => sqliteIndexStore(new Database(":memory:"), schema),
  });
});

describe("IndexStore contract: libsql (in-memory)", () => {
  runIndexStoreContract({
    factory: () => libsqlIndexStore({ url: ":memory:" }, schema),
  });
});
