import { describe, expect, it } from "vitest";
import type { ResolvedCollection } from "../codegen";
import { generateSchemaFile } from "../codegen";

// biome-ignore lint/suspicious/noExplicitAny: Notion property mocks
function makeProp(type: string, extras: Record<string, unknown> = {}): any {
	return { type, id: "_", name: "_", description: "", ...extras };
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
			Status: makeProp("select", {
				select: {
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
		// select の literal union が出力される
		expect(code).toContain('"公開済み" | "下書き" | null');
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
