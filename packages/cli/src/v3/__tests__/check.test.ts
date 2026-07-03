import type { PropertyMap } from "@notion-headless-cms/v3";
import { prop } from "@notion-headless-cms/v3";
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
});
