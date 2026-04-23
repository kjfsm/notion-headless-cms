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
			Status: makeProp("status"),
		},
		...overrides,
	} as ResolvedSource;
}

describe("generateSchemaFile", () => {
	it("ヘッダーにインポート文が含まれる", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain('import { z } from "zod"');
		expect(code).toContain("createNotionCollection");
		expect(code).toContain('from "@notion-headless-cms/notion-orm"');
		expect(code).toContain(
			'import type { BaseContentItem } from "@notion-headless-cms/core"',
		);
		expect(code).toContain('import { env } from "@notion-headless-cms/cli"');
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

	it("title プロパティが slug として自動検出される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain('slug: { type: "title", notion: "Name" }');
	});

	it("Status プロパティが status として自動検出される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain('status: { type: "select", notion: "Status" }');
		// published/accessible は生成しない（クライアント側で sources オプションで差し込む）
		expect(code).not.toContain("published:");
		expect(code).not.toContain("// TODO");
	});

	it("status フィールドは published/accessible なしで生成される（クライアント側で差し込む）", () => {
		const code = generateSchemaFile([makeSource()]);
		// published/accessible は生成ファイルに含まれない
		expect(code).not.toContain("published:");
		expect(code).not.toContain("accessible:");
		expect(code).not.toContain("// TODO");
		// status フィールドは notion プロパティ名だけ保持する
		expect(code).toContain('status: { type: "select", notion: "Status" }');
	});

	it("PublishedAt date プロパティが publishedAt として自動検出される", () => {
		const source = makeSource({
			properties: {
				Name: makeProp("title"),
				PublishedAt: makeProp("date"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain(
			'publishedAt: { type: "date", notion: "PublishedAt" }',
		);
		expect(code).toContain("publishedAt: z.string().nullable().transform(");
	});

	it("各プロパティ型が正しい Zod 式と TypeScript 型に変換される", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				Body: makeProp("rich_text"),
				Category: makeProp("select"),
				Tags: makeProp("multi_select"),
				Views: makeProp("number"),
				Featured: makeProp("checkbox"),
				Link: makeProp("url"),
				PublishedAt: makeProp("date"),
			},
		});
		const code = generateSchemaFile([source]);
		// rich_text → richText
		expect(code).toContain('type: "richText"');
		// select → select
		expect(code).toContain('type: "select"');
		// multi_select → multiSelect
		expect(code).toContain('type: "multiSelect"');
		// number
		expect(code).toContain("z.number().nullable()");
		// checkbox
		expect(code).toContain("z.boolean()");
		// url
		expect(code).toContain('type: "url"');
		// date (with transform)
		expect(code).toContain("publishedAt: z.string().nullable().transform(");
	});

	it("サポート外のプロパティ型はスキップしてコメントを出力する", () => {
		const source = makeSource({
			properties: {
				Name: makeProp("title"),
				Formula: makeProp("formula"),
				Relation: makeProp("relation"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain("// スキップ: Formula");
		expect(code).toContain("// スキップ: Relation");
	});

	it("interface に追加フィールドが含まれる", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				Tags: makeProp("multi_select"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain(
			"export interface PostsItem extends BaseContentItem",
		);
		expect(code).toContain("tags: string[];");
	});

	it("追加フィールドがない場合は type alias を出力する", () => {
		const source = makeSource({
			properties: {
				Name: makeProp("title"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain("export type PostsItem = BaseContentItem;");
	});

	it("status が検出された場合は interface に status: string が含まれる", () => {
		const source = makeSource({
			properties: {
				Name: makeProp("title"),
				Status: makeProp("status"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain(
			"export interface PostsItem extends BaseContentItem",
		);
		expect(code).toContain("status: string;");
	});

	it("defineSchema・defineMapping・エクスポート定数が出力される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain("const _postsZodSchema = z.object({");
		expect(code).toContain("const _postsMapping = defineMapping");
		expect(code).toContain(
			"export const postsSchema = defineSchema(_postsZodSchema, _postsMapping);",
		);
		expect(code).toContain('export const postsSourceId = "abc-123";');
	});

	it("cmsDataSources オブジェクトが出力される", () => {
		const code = generateSchemaFile([makeSource()]);
		expect(code).toContain("export const cmsDataSources = {");
		expect(code).toContain("posts: createNotionCollection({");
		expect(code).toContain('token: env("NOTION_TOKEN")');
		expect(code).toContain("dataSourceId: postsSourceId,");
		expect(code).toContain("schema: postsSchema,");
		expect(code).toContain("} as const;");
		expect(code).toContain(
			"export type CMSDataSources = typeof cmsDataSources;",
		);
	});

	it("複数ソースが cmsDataSources に含まれる", () => {
		const sources: ResolvedSource[] = [
			makeSource(),
			{
				config: { name: "news", id: "xyz-999" },
				id: "xyz-999",
				dbName: "ニュースDB",
				properties: { Title: makeProp("title") },
			} as ResolvedSource,
		];
		const code = generateSchemaFile(sources);
		expect(code).toContain("posts: createNotionCollection({");
		expect(code).toContain("news: createNotionCollection({");
		expect(code).toContain("dataSourceId: postsSourceId,");
		expect(code).toContain("dataSourceId: newsSourceId,");
	});

	it("日本語プロパティ名は fields.properties がないとエラーになる", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				あいうえお: makeProp("number"),
			},
		});
		expect(() => generateSchemaFile([source])).toThrow(
			"fields.properties に追加してください",
		);
	});

	it("fields.properties で日本語プロパティ名を明示マッピングできる", () => {
		const source = makeSource({
			config: {
				name: "posts",
				dbName: "DB",
				fields: { properties: { あいうえお: "japaneseField" } },
			},
			properties: {
				Name: makeProp("title"),
				あいうえお: makeProp("number"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain("japaneseField");
		expect(code).toContain('notion: "あいうえお"');
	});

	it("slug が見つからない場合はエラーになる", () => {
		const source = makeSource({
			properties: {
				Body: makeProp("rich_text"),
				Status: makeProp("status"),
			},
		});
		expect(() => generateSchemaFile([source])).toThrow(
			"slug フィールドが見つかりませんでした",
		);
	});

	it("fields.slug に存在しないプロパティを指定するとエラーになる", () => {
		const source = makeSource({
			config: {
				name: "posts",
				dbName: "DB",
				fields: { slug: "NoSuchProp" },
			},
		});
		expect(() => generateSchemaFile([source])).toThrow("NoSuchProp");
	});

	it("fields.properties に存在しないプロパティを指定するとエラーになる", () => {
		const source = makeSource({
			config: {
				name: "posts",
				dbName: "DB",
				fields: { properties: { 存在しない: "missing" } },
			},
		});
		expect(() => generateSchemaFile([source])).toThrow("存在しない");
	});

	it("スペースやハイフン入りのプロパティ名を camelCase に変換する", () => {
		const source = makeSource({
			config: { name: "posts", dbName: "DB" },
			properties: {
				Name: makeProp("title"),
				"published-at": makeProp("date"),
			},
		});
		const code = generateSchemaFile([source]);
		// published-at → publishedAt として date フィールドが検出される
		expect(code).toContain("publishedAt:");
	});

	it("fields.slug で slug フィールドを上書き指定できる", () => {
		const source = makeSource({
			config: {
				name: "posts",
				dbName: "DB",
				fields: { slug: "Body" },
			},
			properties: {
				Name: makeProp("title"),
				Body: makeProp("rich_text"),
			},
		});
		const code = generateSchemaFile([source]);
		expect(code).toContain('slug: { type: "richText", notion: "Body" }');
	});
});
