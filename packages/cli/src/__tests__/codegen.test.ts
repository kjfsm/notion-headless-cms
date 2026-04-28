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
