import { isCMSError } from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import type { ResolvedSource } from "../codegen.js";
import { generateSchemaFile } from "../codegen.js";

// biome-ignore lint/suspicious/noExplicitAny: テスト用モックのため型アサーションを許容
function makeProp(type: string): any {
	return { type, id: "_", name: "_", description: "" };
}

function makeSource(overrides: Partial<ResolvedSource> = {}): ResolvedSource {
	return {
		config: { name: "posts", dbName: "ブログ記事DB" },
		id: "abc-123",
		dbName: "ブログ記事DB",
		properties: {
			Name: makeProp("title"),
			Slug: makeProp("rich_text"),
			Status: makeProp("status"),
		},
		...overrides,
	} as ResolvedSource;
}

describe("generateSchemaFile", () => {
	it("ヘッダーにインポート文が含まれる", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain("import type { PropertyMap }");
		expect(code).toContain("@notion-headless-cms/core");
	});

	it("自動生成コメントを含む", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain(
			"// このファイルは nhc generate により自動生成されました",
		);
	});

	it("DB 名と ID がコメントに出力される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain("// posts  (ブログ記事DB)");
		expect(code).toContain("// Notion DB ID: abc-123");
	});

	it("postsSourceId がエクスポートされる", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain('export const postsSourceId = "abc-123";');
	});

	it("postsProperties オブジェクトがエクスポートされる", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain("export const postsProperties = {");
		expect(code).toContain("} as const;");
	});

	it("PostsProperties 型がエクスポートされる", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain(
			"export type PostsProperties = typeof postsProperties;",
		);
	});

	it("rich_text プロパティが richText として出力される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain(
			'slug: { type: "richText" as const, notion: "Slug" }',
		);
	});

	it("status プロパティが select として出力される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain(
			'status: { type: "select" as const, notion: "Status" }',
		);
	});

	it("title プロパティが title として出力される", () => {
		const source = makeSource({
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain('name: { type: "title" as const, notion: "Name" }');
	});

	it("各プロパティ型が正しい type 値に変換される", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
				Category: makeProp("select"),
				Tags: makeProp("multi_select"),
				Views: makeProp("number"),
				Featured: makeProp("checkbox"),
				Link: makeProp("url"),
				PublishedAt: makeProp("date"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain('"richText"');
		expect(code).toContain('"select"');
		expect(code).toContain('"multiSelect"');
		expect(code).toContain('"number"');
		expect(code).toContain('"checkbox"');
		expect(code).toContain('"url"');
		expect(code).toContain('"date"');
	});

	it("サポート外のプロパティ型はスキップしてコメントを出力する", () => {
		const source = makeSource({
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
				Formula: makeProp("formula"),
				Relation: makeProp("relation"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain("// スキップ: Formula");
		expect(code).toContain("// スキップ: Relation");
	});

	it("スペース・ハイフン入りのプロパティ名を camelCase に変換する", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
				"Published At": makeProp("date"),
				"my-field": makeProp("number"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain("publishedAt:");
		expect(code).toContain("myField:");
	});

	it("columnMappings 未指定の日本語プロパティ名は CMSError を throw する", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
				あいうえお: makeProp("number"),
			},
		});
		expect(() => generateSchemaFile([source])).toThrow();
		try {
			generateSchemaFile([source]);
		} catch (err) {
			expect(isCMSError(err)).toBe(true);
			if (isCMSError(err)) {
				expect(err.code).toBe("cli/schema_invalid");
				expect(err.message).toContain("あいうえお");
				expect(err.message).toContain("columnMappings");
			}
		}
	});

	it("複数の非ASCII名がある場合は最初のプロパティで CMSError を throw する", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
				あいうえお: makeProp("number"),
				かきくけこ: makeProp("select"),
			},
		});
		expect(() => generateSchemaFile([source])).toThrow();
		try {
			generateSchemaFile([source]);
		} catch (err) {
			expect(isCMSError(err)).toBe(true);
			if (isCMSError(err)) {
				expect(err.code).toBe("cli/schema_invalid");
			}
		}
	});

	it("columnMappings で日本語プロパティ名を明示マッピングできる", () => {
		const source = makeSource({
			config: {
				name: "posts",
				dbName: "DB",
				columnMappings: { あいうえお: "japaneseField" },
			},
			properties: {
				Name: makeProp("title"),
				Slug: makeProp("rich_text"),
				あいうえお: makeProp("number"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain("japaneseField");
		expect(code).toContain('notion: "あいうえお"');
	});

	it("columnMappings に存在しないプロパティを指定するとエラーになる", () => {
		const source = makeSource({
			config: {
				name: "posts",
				dbName: "DB",
				columnMappings: { 存在しない: "missing" },
			},
		});
		expect(() => generateSchemaFile([source])).toThrow("存在しない");
	});

	it("複数ソースがそれぞれ出力される", () => {
		const sources: ResolvedSource[] = [
			makeSource(),
			{
				config: { name: "news", id: "xyz-999" },
				id: "xyz-999",
				dbName: "ニュースDB",
				properties: { Title: makeProp("title"), Slug: makeProp("rich_text") },
			} as ResolvedSource,
		];
		const code = generateSchemaFile(sources);
		expect(code).toContain("postsSourceId");
		expect(code).toContain("postsProperties");
		expect(code).toContain("newsSourceId");
		expect(code).toContain("newsProperties");
	});

	it("Zod や defineSchema は含まれない（新アーキテクチャ）", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).not.toContain("defineSchema");
		expect(code).not.toContain("defineMapping");
		expect(code).not.toContain('from "zod"');
		expect(code).not.toContain("cmsDataSources");
	});
});
