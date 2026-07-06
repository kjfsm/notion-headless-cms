import { defineCollection } from "@notion-headless-cms/cms";
import { prop } from "@notion-headless-cms/cms";
import { describe, expect, it } from "vitest";

import { queryableColumns } from "../schema.js";

describe("queryableColumns", () => {
  it("where 演算子を持つ型だけ実カラムを生成する", () => {
    const def = defineCollection({
      dataSourceId: "ds",
      properties: {
        title: prop.title(),
        body: prop.richText(),
        link: prop.url(),
        choice: prop.select(),
        state: prop.status(["draft", "published"] as const),
        tags: prop.multiSelect(),
        publishedAt: prop.date(),
        createdAt: prop.createdTime(),
        views: prop.number(),
        featured: prop.checkbox(),
        // where 演算子を持たない型は実カラム化されない(types/query.ts の OperatorsForProp が never を返す)。
        computed: prop.formula("string"),
        rolled: prop.rollup("string"),
        related: prop.relation(),
        owners: prop.people(),
        attachments: prop.files(),
        code: prop.uniqueId(),
        editor: prop.lastEditedBy(),
      },
    });
    const columns = queryableColumns(def.properties);
    const byKey = new Map(columns.map((c) => [c.propKey, c]));

    expect(byKey.get("title")?.type).toBe("text");
    expect(byKey.get("body")?.type).toBe("text");
    expect(byKey.get("link")?.type).toBe("text");
    expect(byKey.get("choice")?.type).toBe("text");
    expect(byKey.get("state")?.type).toBe("text");
    expect(byKey.get("tags")?.type).toBe("text");
    expect(byKey.get("publishedAt")?.type).toBe("text");
    expect(byKey.get("createdAt")?.type).toBe("text");
    expect(byKey.get("views")?.type).toBe("real");
    expect(byKey.get("featured")?.type).toBe("integer");

    for (const key of [
      "computed",
      "rolled",
      "related",
      "owners",
      "attachments",
      "code",
      "editor",
    ]) {
      expect(byKey.has(key)).toBe(false);
    }
  });

  it("列名には prop_ を前置し、slug 等の予約列名との衝突を避ける", () => {
    const def = defineCollection({
      dataSourceId: "ds",
      properties: { slug: prop.richText(), version: prop.richText(), listed: prop.checkbox() },
    });
    const columns = queryableColumns(def.properties);
    expect(columns.map((c) => c.column)).toEqual(["prop_slug", "prop_version", "prop_listed"]);
  });

  it("サニタイズ後に列名が衝突する場合は CMSError を投げる", () => {
    const def = defineCollection({
      dataSourceId: "ds",
      properties: { "a-b": prop.richText(), a_b: prop.richText() },
    });
    expect(() => queryableColumns(def.properties)).toThrow(/SQL 列名/);
  });
});
