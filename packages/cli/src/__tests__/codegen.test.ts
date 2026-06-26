import { describe, expect, it } from "vitest";
import type { ResolvedCollection } from "../codegen";
import { generateSchemaFile } from "../codegen";
import type { DataSourceObjectResponse } from "../notion-client.js";

function makeProp(
  type: string,
  extras: Record<string, object | string | number | boolean | null> = {},
): DataSourceObjectResponse["properties"][string] {
  return {
    type,
    id: "_",
    name: "_",
    description: "",
    ...extras,
  } as DataSourceObjectResponse["properties"][string];
}

function makeCollection(
  overrides: Partial<ResolvedCollection> = {},
): ResolvedCollection {
  return {
    name: "posts",
    config: {
      dbName: "ブログ記事DB",
      publishedStatuses: ["公開済み"],
    },
    id: "abc-123",
    dbName: "ブログ記事DB",
    properties: {
      Slug: makeProp("title"),
      Status: makeProp("status", {
        status: {
          options: [
            { id: "1", name: "公開済み", color: "green" },
            { id: "2", name: "下書き", color: "gray" },
          ],
        },
      }),
    },
    ...overrides,
  };
}

describe("Notion API datasource プロパティ型マッピング", () => {
  /**
   * Notion API の DataSourceObjectResponse が返す全プロパティ型に対して、
   * generateSchemaFile が正しい TypeScript 型・PropertyMap type 値・スキップ挙動を
   * 生成するかを網羅的に検証する。
   */
  it("サポート済みプロパティ型がそれぞれ正しい TypeScript 型にマップされる", () => {
    const collection = makeCollection({
      config: { dbName: "テストDB", publishedStatuses: ["公開済み"] },
      properties: {
        Slug: makeProp("title"),
        Body: makeProp("rich_text"),
        Category: makeProp("select", {
          select: {
            options: [
              { id: "1", name: "Tech", color: "blue", description: null },
            ],
          },
        }),
        Status: makeProp("status", {
          status: {
            options: [
              { id: "1", name: "公開済み", color: "green", description: null },
              { id: "2", name: "下書き", color: "gray", description: null },
            ],
            groups: [],
          },
        }),
        Tags: makeProp("multi_select", {
          multi_select: { options: [] },
        }),
        "Published At": makeProp("date"),
        Views: makeProp("number", { number: { format: "number" } }),
        Featured: makeProp("checkbox"),
        "Source URL": makeProp("url"),
      },
    });
    const code = generateSchemaFile([collection]);

    expect(code).toContain("  slug: string;");
    expect(code).not.toContain("  slug: string | null;");
    expect(code).toContain("  body: string | null;");
    expect(code).toContain("  category: string | null;");
    expect(code).not.toContain('"Tech"');
    expect(code).toContain('"公開済み" | "下書き" | null');
    expect(code).toContain("  tags: string[];");
    expect(code).toContain("  publishedAt: string | null;");
    expect(code).toContain("  views: number | null;");
    expect(code).toContain("  featured: boolean;");
    expect(code).toContain("  sourceURL: string | null;");
  });

  it("サポート済みプロパティ型が PropertyMap の type 値に正しく変換される", () => {
    const collection = makeCollection({
      config: { dbName: "テストDB", publishedStatuses: [] },
      properties: {
        Slug: makeProp("title"),
        Body: makeProp("rich_text"),
        Category: makeProp("select"),
        Status: makeProp("status", {
          status: { options: [], groups: [] },
        }),
        Tags: makeProp("multi_select"),
        Published: makeProp("date"),
        Views: makeProp("number"),
        Featured: makeProp("checkbox"),
        Website: makeProp("url"),
      },
    });
    const code = generateSchemaFile([collection]);

    // PropertyMap の type 値（runtime で使われる）
    expect(code).toContain('slug: { type: "title" as const, notion: "Slug" }');
    expect(code).toContain(
      'body: { type: "richText" as const, notion: "Body" }',
    );
    expect(code).toContain(
      'category: { type: "select" as const, notion: "Category" }',
    );
    expect(code).toContain(
      'status: { type: "status" as const, notion: "Status" }',
    );
    expect(code).toContain(
      'tags: { type: "multiSelect" as const, notion: "Tags" }',
    );
    expect(code).toContain(
      'published: { type: "date" as const, notion: "Published" }',
    );
    expect(code).toContain(
      'views: { type: "number" as const, notion: "Views" }',
    );
    expect(code).toContain(
      'featured: { type: "checkbox" as const, notion: "Featured" }',
    );
    expect(code).toContain(
      'website: { type: "url" as const, notion: "Website" }',
    );
  });

  it("Notion API が返す未サポートプロパティ型はすべてスキップコメント付きで除外される", () => {
    // Notion API の DatabasePropertyConfigResponse に存在するが NOTION_TYPE_MAP 未定義の型
    const collection = makeCollection({
      properties: {
        Slug: makeProp("title"),
        Formula: makeProp("formula", {
          formula: { expression: "prop('Views') * 2" },
        }),
        Related: makeProp("relation", {
          relation: {
            database_id: "x",
            data_source_id: "y",
            type: "single_property",
            single_property: {},
          },
        }),
        Rollup: makeProp("rollup", {
          rollup: {
            function: "count",
            rollup_property_name: "Name",
            relation_property_name: "Related",
            rollup_property_id: "r1",
            relation_property_id: "r2",
          },
        }),
        UniqueId: makeProp("unique_id", { unique_id: { prefix: null } }),
        People: makeProp("people"),
        Files: makeProp("files"),
        Email: makeProp("email"),
        Phone: makeProp("phone_number"),
        CreatedBy: makeProp("created_by"),
        CreatedTime: makeProp("created_time"),
        LastEditedBy: makeProp("last_edited_by"),
        LastEditedTime: makeProp("last_edited_time"),
      },
    });
    const code = generateSchemaFile([collection]);

    const unsupportedTypes = [
      ["Formula", "formula"],
      ["Related", "relation"],
      ["Rollup", "rollup"],
      ["UniqueId", "unique_id"],
      ["People", "people"],
      ["Files", "files"],
      ["Email", "email"],
      ["Phone", "phone_number"],
      ["CreatedBy", "created_by"],
      ["CreatedTime", "created_time"],
      ["LastEditedBy", "last_edited_by"],
      ["LastEditedTime", "last_edited_time"],
    ] as const;

    for (const [propName, notionType] of unsupportedTypes) {
      expect(
        code,
        `${notionType} 型のスキップコメントが存在すること`,
      ).toContain(`スキップ: ${propName}`);
      expect(
        code,
        `${notionType} 型の未対応メッセージが存在すること`,
      ).toContain(`未対応のプロパティ型: ${notionType}`);
    }

    expect(code).not.toContain("  formula:");
    expect(code).not.toContain("  related:");
    expect(code).not.toContain("  rollup:");
    expect(code).not.toContain("  uniqueId:");
    expect(code).not.toContain("  people:");
    expect(code).not.toContain("  files:");
    expect(code).not.toContain("  email:");
    expect(code).not.toContain("  phone:");
    expect(code).not.toContain("  createdBy:");
    expect(code).not.toContain("  createdTime:");
    expect(code).not.toContain("  lastEditedBy:");
  });
});

describe("generateSchemaFile", () => {
  it("コレクション 1 件分の properties / 型 / schema 集約を出力する", () => {
    const code = generateSchemaFile([makeCollection()]);
    expect(code).toContain('export const postsDataSourceId = "abc-123"');
    expect(code).toContain("export const postsProperties");
    expect(code).toContain("export interface Post");
    expect(code).toContain("export const schema =");
    expect(code).toContain("satisfies SchemaMap");
    expect(code).toContain("dataSourceId: postsDataSourceId");
    // dbName は schema に埋め込まず、実行時に cms.<collection>.dbName() で取得する。
    expect(code).not.toContain("dbName:");
    expect(code).toContain("properties: postsProperties");
    expect(code).not.toContain("export function createClient");
    expect(code).not.toContain("NhcConfig");
    expect(code).not.toContain("publishedStatuses");
    expect(code).toContain('"公開済み" | "下書き" | null');
  });

  it("Notion status 型は literal union、select 型は string | null で生成される", () => {
    const collection = makeCollection({
      properties: {
        Slug: makeProp("title"),
        Status: makeProp("status", {
          status: {
            options: [
              { id: "1", name: "公開済み", color: "green" },
              { id: "2", name: "下書き", color: "gray" },
            ],
          },
        }),
        // select はユーザーが自由に追加できるため literal union にしない
        Author: makeProp("select", {
          select: {
            options: [{ id: "1", name: "Alice", color: "blue" }],
          },
        }),
      },
    });
    const code = generateSchemaFile([collection]);
    expect(code).toContain('"公開済み" | "下書き" | null');
    expect(code).toContain("author: string | null");
    expect(code).not.toContain('"Alice"');
  });

  it("status カラムは PropertyMap に options を as const で出力する (型推論が literal union を導出する根拠)", () => {
    const collection = makeCollection({
      properties: {
        Slug: makeProp("title"),
        Status: makeProp("status", {
          status: {
            options: [
              { id: "1", name: "公開済み", color: "green" },
              { id: "2", name: "下書き", color: "gray" },
            ],
          },
        }),
        // select には options を出力しない（自由追加可能で陳腐化するため）
        Author: makeProp("select", {
          select: {
            options: [{ id: "1", name: "Alice", color: "blue" }],
          },
        }),
      },
    });
    const code = generateSchemaFile([collection]);
    expect(code).toContain(
      'status: { type: "status" as const, notion: "Status", options: ["公開済み", "下書き"] as const }',
    );
    expect(code).toContain(
      'author: { type: "select" as const, notion: "Author" }',
    );
  });

  it("slugField に指定されたフィールドは string（null 非許容）で生成される", () => {
    // richText 型は通常 string | null だが slugField は BaseContentItem.slug 制約を満たすため string
    const collection = makeCollection({
      config: { dbName: "DB", publishedStatuses: [], slugField: "mySlug" },
      properties: {
        "My Slug": makeProp("rich_text"),
        Status: makeProp("select"),
      },
    });
    const code = generateSchemaFile([collection]);
    expect(code).toContain("  mySlug: string;");
    expect(code).not.toContain("  mySlug: string | null;");
  });

  it("schema 集約に slugField / statusField のみが含まれる (publishedStatuses は notionSource() 側で指定)", () => {
    const code = generateSchemaFile([makeCollection()]);
    expect(code).toContain('slugField: "slug"');
    expect(code).toContain('statusField: "status"');
    expect(code).not.toContain("publishedStatuses:");
    expect(code).not.toContain("accessibleStatuses:");
  });

  it("DB に status / publishedAt プロパティが存在しない場合のフォールバック型は string | null", () => {
    const collection = makeCollection({
      properties: {
        Slug: makeProp("title"),
        // status / publishedAt なし
      },
    });
    const code = generateSchemaFile([collection]);
    expect(code).toContain("status?: string | null;");
    expect(code).not.toContain("status?: string;");
    expect(code).toContain("publishedAt?: string | null;");
    expect(code).not.toContain("publishedAt?: string;");
  });

  it("kind: data では slug プロパティを生成せず schema に kind: data を出力する", () => {
    const collection = makeCollection({
      name: "settings",
      dbName: "設定DB",
      config: { dbName: "設定DB", kind: "data", publishedStatuses: [] },
      properties: {
        Key: makeProp("title"),
        Value: makeProp("rich_text"),
      },
    });
    const code = generateSchemaFile([collection]);
    // 要素コレクションは URL を持たないため slug 列・slugField を出力しない。
    expect(code).not.toContain("slug: string;");
    expect(code).not.toContain("slugField:");
    expect(code).toContain('kind: "data"');
    // DB 名は schema に埋め込まず、実行時に cms.<collection>.dbName() で取得する。
    expect(code).not.toContain("dbName:");
  });

  it("notion-source / core から型を import する", () => {
    const code = generateSchemaFile([makeCollection()]);
    expect(code).toContain(
      'import type { PropertyMap } from "@notion-headless-cms/core"',
    );
    expect(code).toContain(
      'import type { SchemaMap } from "@notion-headless-cms/notion-source"',
    );
    expect(code).not.toContain("createNotionCollection");
    expect(code).not.toContain("FetchBlockTreeOgpOptions");
    expect(code).not.toContain("BlockHandler");
  });

  it("対応していないプロパティ型はコメント化される", () => {
    const collection = makeCollection({
      properties: {
        Slug: makeProp("title"),
        Files: makeProp("files"),
      },
    });
    const code = generateSchemaFile([collection]);
    expect(code).toContain("スキップ: Files");
  });
});
