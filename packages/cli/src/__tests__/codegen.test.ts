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
				// title → string (slugField なので null 非許容)
				Slug: makeProp("title"),
				// rich_text → string | null
				Body: makeProp("rich_text"),
				// select → string | null (literal union にしない)
				Category: makeProp("select", {
					select: {
						options: [
							{ id: "1", name: "Tech", color: "blue", description: null },
						],
					},
				}),
				// status → literal union + | null
				Status: makeProp("status", {
					status: {
						options: [
							{ id: "1", name: "公開済み", color: "green", description: null },
							{ id: "2", name: "下書き", color: "gray", description: null },
						],
						groups: [],
					},
				}),
				// multi_select → string[]
				Tags: makeProp("multi_select", {
					multi_select: { options: [] },
				}),
				// date → string | null
				"Published At": makeProp("date"),
				// number → number | null
				Views: makeProp("number", { number: { format: "number" } }),
				// checkbox → boolean
				Featured: makeProp("checkbox"),
				// url → string | null
				"Source URL": makeProp("url"),
			},
		});
		const code = generateSchemaFile([collection]);

		// title (slugField) は null 非許容の string
		expect(code).toContain("\tslug: string;");
		expect(code).not.toContain("\tslug: string | null;");
		// rich_text
		expect(code).toContain("\tbody: string | null;");
		// select は literal union にせず string | null
		expect(code).toContain("\tcategory: string | null;");
		expect(code).not.toContain('"Tech"');
		// status は literal union
		expect(code).toContain('"公開済み" | "下書き" | null');
		// multi_select
		expect(code).toContain("\ttags: string[];");
		// date (camelCase: "Published At" → publishedAt)
		expect(code).toContain("\tpublishedAt: string | null;");
		// number
		expect(code).toContain("\tviews: number | null;");
		// checkbox
		expect(code).toContain("\tfeatured: boolean;");
		// url (camelCase: "Source URL" → sourceURL)
		expect(code).toContain("\tsourceURL: string | null;");
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
		// status は PropertyMap でも type: "status"
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

		// 各未サポート型のスキップコメントが出力される
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

		// 未サポート型のフィールドは TypeScript インターフェースに含まれない
		expect(code).not.toContain("\tformula:");
		expect(code).not.toContain("\trelated:");
		expect(code).not.toContain("\trollup:");
		expect(code).not.toContain("\tuniqueId:");
		expect(code).not.toContain("\tpeople:");
		expect(code).not.toContain("\tfiles:");
		expect(code).not.toContain("\temail:");
		expect(code).not.toContain("\tphone:");
		expect(code).not.toContain("\tcreatedBy:");
		expect(code).not.toContain("\tcreatedTime:");
		expect(code).not.toContain("\tlastEditedBy:");
		expect(code).not.toContain("\tlastEditedTime:");
	});
});

describe("generateSchemaFile", () => {
	it("コレクション 1 件分の properties / 型 / createCMS を出力する", () => {
		const code = generateSchemaFile([makeCollection()]);
		expect(code).toContain('export const postsDataSourceId = "abc-123"');
		expect(code).toContain("export const postsProperties");
		expect(code).toContain("export interface Post");
		expect(code).toContain("export function createCMS(config: NhcConfig)");
		// status 型の literal union が出力される
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
		expect(code).toContain("\tmySlug: string;");
		expect(code).not.toContain("\tmySlug: string | null;");
	});

	it("公開ステータス値を createCMS 内に埋め込む", () => {
		const code = generateSchemaFile([makeCollection()]);
		expect(code).toContain('publishedStatuses: ["公開済み"] as const');
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
