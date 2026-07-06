import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { describe, expect, it } from "vitest";

import { ensureSchema } from "../schema.js";

describe("ensureSchema", () => {
  it("後から追加されたプロパティは ALTER TABLE ADD COLUMN で追従する（既存列は消えない）", async () => {
    const database = new Database(":memory:");
    // biome-ignore lint/suspicious/noExplicitAny: テストのみ生の Kysely インスタンスを直接操作する。
    const db = new Kysely<any>({ dialect: new SqliteDialect({ database }) });

    const v1 = defineSchema({
      posts: defineCollection({ dataSourceId: "ds", properties: { title: prop.richText() } }),
    });
    await ensureSchema(db, v1);
    await db
      .insertInto("cms_entry_posts")
      .values({ slug: "a", version: "v1", listed: 1, meta: "{}", prop_title: "Hello" })
      .execute();

    const v2 = defineSchema({
      posts: defineCollection({
        dataSourceId: "ds",
        properties: { title: prop.richText(), views: prop.number() },
      }),
    });
    await ensureSchema(db, v2); // 既存テーブルに prop_views を ALTER TABLE ADD COLUMN で追加する

    await db
      .insertInto("cms_entry_posts")
      .values({
        slug: "b",
        version: "v1",
        listed: 1,
        meta: "{}",
        prop_title: "World",
        prop_views: 5,
      })
      .execute();

    const rows = await db.selectFrom("cms_entry_posts").selectAll().orderBy("slug").execute();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ slug: "a", prop_title: "Hello", prop_views: null });
    expect(rows[1]).toMatchObject({ slug: "b", prop_title: "World", prop_views: 5 });
  });

  it("複数コレクション分のテーブル/FTS を用意する", async () => {
    const database = new Database(":memory:");
    // biome-ignore lint/suspicious/noExplicitAny: テストのみ生の Kysely インスタンスを直接操作する。
    const db = new Kysely<any>({ dialect: new SqliteDialect({ database }) });
    const schema = defineSchema({
      posts: defineCollection({ dataSourceId: "ds-posts", properties: { title: prop.richText() } }),
      pages: defineCollection({ dataSourceId: "ds-pages", properties: { title: prop.richText() } }),
    });
    await ensureSchema(db, schema);

    const tables = await db.introspection.getTables();
    const tableNames = tables.map((t: { name: string }) => t.name);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        "cms_entry_posts",
        "cms_entry_pages",
        "cms_fts_posts",
        "cms_fts_pages",
      ]),
    );
  });
});
