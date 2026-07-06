import { describe, expect, it } from "vitest";
import type { DataSourceObjectResponse } from "../notion-client.js";
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
  it("title/richText/status/multiSelect を prop.* 呼び出しに変換する(識別子と実名が違う場合は別名を渡す)", () => {
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
      'import { defineCollection, prop } from "@notion-headless-cms/cms";',
    );
    // 自動導出した識別子(先頭小文字化)は実プロパティ名と大文字小文字が異なるため、
    // raw[key] の完全一致lookupに合わせて notion 別名を渡す必要がある。
    expect(code).toContain('title: prop.title("Title"),');
    expect(code).toContain('slug: prop.richText("Slug"),');
    expect(code).toContain(
      'status: prop.status(["draft", "published"] as const, "Status"),',
    );
    expect(code).toContain(
      'tags: prop.multiSelect(["tech", "life"] as const, "Tags"),',
    );
    expect(code).toContain('dataSourceId: "ds1"');
  });

  it("識別子と実プロパティ名が完全一致する場合は notion 別名を省略する", () => {
    const dataSource = makeDataSource({ title: makeProp("title") });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain("title: prop.title(),");
    expect(code).not.toContain('prop.title("title")');
  });

  it("fieldMappings で明示した識別子を優先し、notion 別名として実名を埋め込む", () => {
    const dataSource = makeDataSource({
      名前: makeProp("title"),
      URL: makeProp("rich_text"),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
      fieldMappings: { 名前: "title", URL: "slug" },
    });
    expect(code).toContain('title: prop.title("名前"),');
    expect(code).toContain('slug: prop.richText("URL"),');
    expect(code).not.toContain("unnamedTitle");
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
    expect(code).toContain('prop.formula("string", "WordCount")');
    expect(code).toContain("実際の型");
    expect(code).toContain('prop.rollup("string", "RelatedCount")');
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
    expect(code).toContain('prop.relation(undefined, "Relation")');
    expect(code).toContain('prop.people("People")');
    expect(code).toContain('prop.files("Files")');
    expect(code).toContain('prop.uniqueId("Id")');
    expect(code).toContain('prop.createdTime("CreatedTime")');
    expect(code).toContain('prop.lastEditedBy("LastEditedBy")');
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

  it("日本語のみのプロパティ名はプロパティ種別ベースの識別子にフォールバックし、notion 別名で実名を保持する", () => {
    const dataSource = makeDataSource({
      タイトル: makeProp("title"),
      本文: makeProp("rich_text"),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain('unnamedTitle: prop.title("タイトル"),');
    expect(code).toContain('unnamedRichText: prop.richText("本文"),');
    expect(code).toContain('/** 元のプロパティ名: "タイトル" */');
    expect(code).toContain('/** 元のプロパティ名: "本文" */');
  });

  it("同じ種別の日本語プロパティ名が複数あっても連番で衝突を避ける", () => {
    const dataSource = makeDataSource({
      ステータス: makeProp("status", {
        status: { options: [{ name: "draft" }] },
      }),
      公開状態: makeProp("status", {
        status: { options: [{ name: "published" }] },
      }),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain("unnamedStatus:");
    expect(code).toContain("unnamedStatus2:");
    // 2つの識別子が別物であることを確認する(衝突していない)
    expect(code.match(/unnamedStatus2:/g)).toHaveLength(1);
    expect(code.match(/unnamedStatus:/g)).toHaveLength(1);
  });

  it("英数字の名前とプロパティ種別ベースの識別子は独立してカウントする", () => {
    const dataSource = makeDataSource({
      名前: makeProp("title"),
      Title: makeProp("title"),
    });
    const code = generateCollectionScaffold(dataSource, {
      collectionName: "posts",
      dataSourceId: "ds1",
    });
    expect(code).toContain('unnamedTitle: prop.title("名前"),');
    expect(code).toContain('title: prop.title("Title"),');
  });
});
