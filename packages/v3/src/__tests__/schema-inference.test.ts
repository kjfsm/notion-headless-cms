import { describe, expectTypeOf, it } from "vitest";
import type { InferEntry, InferSchemaEntries } from "../types/collection.js";
import { defineCollection, defineSchema } from "../types/collection.js";
import { prop } from "../types/property.js";

const posts = defineCollection({
  dataSourceId: "ds_posts",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["draft", "published"] as const),
    tags: prop.multiSelect(["tech", "life"] as const),
    publishedAt: prop.date(),
    views: prop.number(),
    featured: prop.checkbox(),
    author: prop.people(),
    heroImage: prop.files(),
    order: prop.uniqueId(),
    related: prop.relation("posts"),
    wordCount: prop.formula("number"),
  },
  statusProperty: "status",
  published: ["published"],
  accessible: ["draft", "published"],
});

const schema = defineSchema({ posts });

describe("スキーマ定義からのエントリ型推論", () => {
  it("status プロパティが options のリテラル型に補完される", () => {
    type Post = InferEntry<typeof posts>;
    expectTypeOf<Post["status"]>().toEqualTypeOf<"draft" | "published">();
  });

  it("multiSelect が options のリテラル配列型になる", () => {
    type Post = InferEntry<typeof posts>;
    expectTypeOf<Post["tags"]>().toEqualTypeOf<readonly ("tech" | "life")[]>();
  });

  it("システムメタ (id/slug/lastEditedTime) が全エントリに付与される", () => {
    type Post = InferEntry<typeof posts>;
    expectTypeOf<Post["id"]>().toEqualTypeOf<string>();
    expectTypeOf<Post["slug"]>().toEqualTypeOf<string>();
    expectTypeOf<Post["lastEditedTime"]>().toEqualTypeOf<string>();
  });

  it("formula(number) が number|null になる", () => {
    type Post = InferEntry<typeof posts>;
    expectTypeOf<Post["wordCount"]>().toEqualTypeOf<number | null>();
  });

  it("defineSchema がコレクション名で全エントリ型をまとめる", () => {
    type Entries = InferSchemaEntries<typeof schema>;
    expectTypeOf<Entries["posts"]>().toEqualTypeOf<InferEntry<typeof posts>>();
  });
});
