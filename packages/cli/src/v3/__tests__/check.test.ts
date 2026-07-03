import type { PropertyMap } from "@notion-headless-cms/cms";
import { prop } from "@notion-headless-cms/cms";
import { describe, expect, it } from "vitest";
import type { DataSourceObjectResponse } from "../../notion-client.js";
import { diffSchema } from "../check.js";

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

describe("diffSchema", () => {
  it("drift が無ければ hasDrift: false", () => {
    const dataSource = makeDataSource({ title: makeProp("title") });
    const properties: PropertyMap = { title: prop.title() };
    expect(diffSchema(dataSource, properties)).toEqual({
      hasDrift: false,
      changes: [],
    });
  });

  it("Notion 側に新規プロパティがあれば added を報告する", () => {
    const dataSource = makeDataSource({
      title: makeProp("title"),
      newProp: makeProp("rich_text"),
    });
    const properties: PropertyMap = { title: prop.title() };
    const result = diffSchema(dataSource, properties);
    expect(result.hasDrift).toBe(true);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ key: "newProp", kind: "added" }),
    );
  });

  it("コードにあるが Notion に無いプロパティは removed を報告する", () => {
    const dataSource = makeDataSource({ title: makeProp("title") });
    const properties: PropertyMap = {
      title: prop.title(),
      removedProp: prop.richText(),
    };
    const result = diffSchema(dataSource, properties);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ key: "removedProp", kind: "removed" }),
    );
  });

  it("型が変わっていれば type_changed を報告する", () => {
    const dataSource = makeDataSource({
      title: makeProp("title"),
      status: makeProp("select", { select: { options: [] } }),
    });
    const properties: PropertyMap = {
      title: prop.title(),
      status: prop.status(["draft"] as const),
    };
    const result = diffSchema(dataSource, properties);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ key: "status", kind: "type_changed" }),
    );
  });

  it("status の選択肢が変われば options_changed を報告する", () => {
    const dataSource = makeDataSource({
      title: makeProp("title"),
      status: makeProp("status", {
        status: { options: [{ name: "draft" }, { name: "archived" }] },
      }),
    });
    const properties: PropertyMap = {
      title: prop.title(),
      status: prop.status(["draft", "published"] as const),
    };
    const result = diffSchema(dataSource, properties);
    expect(result.changes).toContainEqual(
      expect.objectContaining({ key: "status", kind: "options_changed" }),
    );
  });

  it("multiSelect の選択肢一致は drift 無し", () => {
    const dataSource = makeDataSource({
      tags: makeProp("multi_select", {
        multi_select: { options: [{ name: "a" }, { name: "b" }] },
      }),
    });
    const properties: PropertyMap = {
      tags: prop.multiSelect(["a", "b"] as const),
    };
    expect(diffSchema(dataSource, properties).hasDrift).toBe(false);
  });

  it("日本語のみのプロパティ名は nhc pull と同じフォールバック識別子で照合する(衝突回避後の識別子と一致)", () => {
    const dataSource = makeDataSource({
      タイトル: makeProp("title"),
      ステータス: makeProp("status", {
        status: { options: [{ name: "draft" }, { name: "published" }] },
      }),
      公開状態: makeProp("status", {
        status: { options: [{ name: "yes" }, { name: "no" }] },
      }),
    });
    // nhc pull が生成する識別子(unnamedTitle/unnamedStatus/unnamedStatus2)と同じキーで定義した場合、drift なし
    const properties: PropertyMap = {
      unnamedTitle: prop.title(),
      unnamedStatus: prop.status(["draft", "published"] as const),
      unnamedStatus2: prop.status(["yes", "no"] as const),
    };
    expect(diffSchema(dataSource, properties).hasDrift).toBe(false);
  });
});
