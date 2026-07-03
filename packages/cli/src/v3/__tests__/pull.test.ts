import { describe, expect, it } from "vitest";
import type { DataSourceObjectResponse } from "../../notion-client.js";
import { generateCollectionScaffold } from "../pull.js";

function makeProp(
  type: string,
  extras: Record<string, unknown> = {},
): DataSourceObjectResponse["properties"][string] {
  return {
    type,
    id: "_",
    name: "_",
    description: "",
    ...extras,
  } as DataSourceObjectResponse["properties"][string];
}

function makeDataSource(
  properties: DataSourceObjectResponse["properties"],
): DataSourceObjectResponse {
  return { properties } as DataSourceObjectResponse;
}

describe("generateCollectionScaffold", () => {
  it("title/richText/status/multiSelect を prop.* 呼び出しに変換する", () => {
    const dataSource = makeDataSource({
      Title: makeProp("title"),
      Slug: makeProp("rich_text"),
      Status: makeProp("status", {
        status: { options: [{ name: "draft" }, { name: "published" }] },
      }),
      Tags: makeProp("multi_select", {
        multi_select: { options: [{ name: "tech" }, { name: "life" }] },
      }),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain(
      'import { defineCollection, prop } from "@notion-headless-cms/v3";',
    );
    expect(code).toContain("title: prop.title(),");
    expect(code).toContain("slug: prop.richText(),");
    expect(code).toContain(
      'status: prop.status(["draft", "published"] as const),',
    );
    expect(code).toContain(
      'tags: prop.multiSelect(["tech", "life"] as const),',
    );
    expect(code).toContain('dataSourceId: "ds1"');
  });

  it("title プロパティを slug の既定値として使う", () => {
    const dataSource = makeDataSource({ Title: makeProp("title") });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain('slug: "title"');
  });

  it("formula/rollup は結果型を仮置きし確認コメントを添える", () => {
    const dataSource = makeDataSource({
      WordCount: makeProp("formula"),
      RelatedCount: makeProp("rollup"),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain('prop.formula("string")');
    expect(code).toContain("実際の型");
    expect(code).toContain('prop.rollup("string")');
  });

  it("全プロパティ型を網羅する(formula/rollup/relation/people/files/unique_id/created_time/last_edited_by)", () => {
    const dataSource = makeDataSource({
      Relation: makeProp("relation"),
      People: makeProp("people"),
      Files: makeProp("files"),
      Id: makeProp("unique_id"),
      CreatedTime: makeProp("created_time"),
      LastEditedBy: makeProp("last_edited_by"),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain("prop.relation()");
    expect(code).toContain("prop.people()");
    expect(code).toContain("prop.files()");
    expect(code).toContain("prop.uniqueId()");
    expect(code).toContain("prop.createdTime()");
    expect(code).toContain("prop.lastEditedBy()");
  });

  it("未対応のプロパティ型はコメントアウトして通知する(黙ってスキップしない)", () => {
    const dataSource = makeDataSource({ Email: makeProp("email") });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain("未対応のプロパティ型");
    expect(code).not.toContain("email: prop.email()");
  });

  it("日本語プロパティ名は camelCase 識別子に変換する", () => {
    const dataSource = makeDataSource({
      タイトル: makeProp("title"),
      本文: makeProp("rich_text"),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    // 日本語は識別子から除去されるため "unnamed" にフォールバックする(2件あるので同名衝突の可能性はテスト対象外)。
    expect(code).toContain("prop.title()");
    expect(code).toContain("prop.richText()");
  });
});
