import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNotionCollection } from "../notion-adapter";

vi.mock("../internal/fetcher/index", () => ({
	createClient: vi.fn().mockReturnValue({}),
	queryAllPages: vi.fn(),
	queryPageByProp: vi.fn(),
}));

vi.mock("@notion-headless-cms/renderer", () => {
	const transform = vi.fn().mockResolvedValue("# Hello");
	class MockTransformer {
		transform = transform;
	}
	return {
		Transformer: MockTransformer,
		markdownToBlocks: vi.fn().mockReturnValue([]),
	};
});

import { isCMSError } from "@notion-headless-cms/core";
import { Transformer } from "@notion-headless-cms/renderer";
import {
	createClient,
	queryAllPages,
	queryPageByProp,
} from "../internal/fetcher/index";

const makePage = (slug: string, status: string) => ({
	id: `id-${slug}`,
	last_edited_time: "2024-01-01T00:00:00.000Z",
	created_time: "2024-01-01T00:00:00.000Z",
	properties: {
		Name: { type: "title", title: [{ plain_text: slug }] },
		Slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
		Status: {
			type: "status",
			status: { id: "s1", name: status, color: "green" },
		},
		CreatedAt: { type: "date", date: { start: "2024-01-01" } },
	},
});

describe("createNotionCollection", () => {
	const adapter = createNotionCollection({
		token: "test-token",
		dataSourceId: "test-db-id",
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list()", () => {
		it("全ページを返す（フィルタなし）", async () => {
			vi.mocked(queryAllPages).mockResolvedValue([
				makePage("slug-a", "公開") as never,
				makePage("slug-b", "下書き") as never,
			]);

			const items = await adapter.list();
			expect(items).toHaveLength(2);
			expect(queryAllPages).toHaveBeenCalledWith(
				expect.anything(),
				"test-db-id",
			);
		});

		it("publishedStatuses でフィルタリングする", async () => {
			vi.mocked(queryAllPages).mockResolvedValue([
				makePage("slug-a", "公開") as never,
				makePage("slug-b", "下書き") as never,
			]);

			const items = await adapter.list({ publishedStatuses: ["公開"] });
			expect(items).toHaveLength(1);
			expect(items[0].slug).toBe("slug-a");
		});

		it("ページ名を title として返す", async () => {
			vi.mocked(queryAllPages).mockResolvedValue([
				makePage("my-post", "公開") as never,
			]);

			const items = await adapter.list();
			expect(items[0].title).toBe("my-post");
		});

		it("title 型プロパティがない場合は title が null になる", async () => {
			vi.mocked(queryAllPages).mockResolvedValue([
				{
					id: "id-no-title",
					last_edited_time: "2024-01-01T00:00:00.000Z",
					created_time: "2024-01-01T00:00:00.000Z",
					properties: {
						Slug: {
							type: "rich_text",
							rich_text: [{ plain_text: "no-title" }],
						},
						Status: {
							type: "status",
							status: { id: "s1", name: "公開", color: "green" },
						},
						CreatedAt: { type: "date", date: { start: "2024-01-01" } },
					},
				} as never,
			]);

			const items = await adapter.list();
			expect(items[0].title).toBeNull();
		});

		it("publishedAt の降順でソートする", async () => {
			vi.mocked(queryAllPages).mockResolvedValue([
				{
					...makePage("old", "公開"),
					properties: {
						...makePage("old", "公開").properties,
						CreatedAt: { type: "date", date: { start: "2023-01-01" } },
					},
				} as never,
				{
					...makePage("new", "公開"),
					properties: {
						...makePage("new", "公開").properties,
						CreatedAt: { type: "date", date: { start: "2024-06-01" } },
					},
				} as never,
			]);

			const items = await adapter.list();
			expect(items[0].slug).toBe("new");
		});
	});

	describe("loadMarkdown()", () => {
		it("Transformer.transform の結果を返す", async () => {
			const item = {
				id: "page-id",
				slug: "my-post",
				status: "公開",
				publishedAt: "2024-01-01",
				updatedAt: "2024-01-01",
			};
			const md = await adapter.loadMarkdown(item);
			expect(md).toBe("# Hello");
		});
	});
});

describe("createNotionCollection - コンストラクタバリデーション", () => {
	it("dataSourceId と dbName が両方未指定の場合は CMSError をスローする", () => {
		expect(() =>
			createNotionCollection({
				token: "test-token",
			} as never),
		).toThrow();
	});

	it("schema オプションを使用してアイテムをマップできる", async () => {
		vi.mocked(queryAllPages).mockResolvedValue([
			makePage("schema-post", "公開") as never,
		]);
		const schemaAdapter = createNotionCollection({
			token: "test-token",
			dataSourceId: "test-db-id",
			schema: {
				mapping: {
					id: { type: "title" as const, notion: "ID" },
					slug: { type: "richText" as const, notion: "Slug" },
					updatedAt: { type: "date" as const, notion: "Updated" },
				},
				mapItem: (page: { id: string; last_edited_time: string }) => ({
					id: page.id,
					slug: "schema-post",
					updatedAt: page.last_edited_time,
				}),
			},
		});
		const items = await schemaAdapter.list();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("schema-post");
	});

	it("mapItem オプションを使用してカスタムマッパーを利用できる", async () => {
		vi.mocked(queryAllPages).mockResolvedValue([
			makePage("custom-post", "公開") as never,
		]);
		const customMapper = vi.fn().mockReturnValue({
			id: "custom-id",
			slug: "custom-post",
			updatedAt: "2024-01-01",
		});
		const mapItemAdapter = createNotionCollection({
			token: "test-token",
			dataSourceId: "test-db-id",
			mapItem: customMapper,
		});
		await mapItemAdapter.list();
		expect(customMapper).toHaveBeenCalled();
	});
});

describe("createNotionCollection - dbName 解決", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("dbName でデータベースを検索して正確なタイトル一致で ID を解決する", async () => {
		const mockSearch = vi.fn().mockResolvedValue({
			results: [
				{
					object: "data_source",
					id: "resolved-db-id",
					title: [{ plain_text: "MyDB" }],
				},
			],
		});
		vi.mocked(createClient).mockReturnValue({ search: mockSearch } as never);

		const dbNameAdapter = createNotionCollection({
			token: "test-token",
			dbName: "MyDB",
		});
		vi.mocked(queryAllPages).mockResolvedValue([
			makePage("post-a", "公開") as never,
		]);
		const items = await dbNameAdapter.list();
		expect(items).toHaveLength(1);
		expect(queryAllPages).toHaveBeenCalledWith(
			expect.anything(),
			"resolved-db-id",
		);
	});

	it("タイトル完全一致がない場合は最初の data_source を使う", async () => {
		const mockSearch = vi.fn().mockResolvedValue({
			results: [
				{
					object: "data_source",
					id: "fallback-db-id",
					title: [{ plain_text: "OtherDB" }],
				},
			],
		});
		vi.mocked(createClient).mockReturnValue({ search: mockSearch } as never);

		const dbNameAdapter = createNotionCollection({
			token: "test-token",
			dbName: "MyDB",
		});
		vi.mocked(queryAllPages).mockResolvedValue([]);
		await dbNameAdapter.list();
		expect(queryAllPages).toHaveBeenCalledWith(
			expect.anything(),
			"fallback-db-id",
		);
	});

	it("データベースが見つからない場合は CMSError をスローする", async () => {
		const mockSearch = vi.fn().mockResolvedValue({ results: [] });
		vi.mocked(createClient).mockReturnValue({ search: mockSearch } as never);

		const dbNameAdapter = createNotionCollection({
			token: "test-token",
			dbName: "NotFound",
		});
		await expect(dbNameAdapter.list()).rejects.toSatisfy(
			(err: unknown) =>
				isCMSError(err) && err.code === "source/fetch_items_failed",
		);
	});

	it("同時に2回呼ばれても resolvingDataSourceId を再利用してセカンドコールは待機する", async () => {
		const mockSearch = vi.fn().mockResolvedValue({
			results: [
				{ object: "data_source", id: "db-id", title: [{ plain_text: "MyDB" }] },
			],
		});
		vi.mocked(createClient).mockReturnValue({ search: mockSearch } as never);

		const dbNameAdapter = createNotionCollection({
			token: "test-token",
			dbName: "MyDB",
		});
		vi.mocked(queryAllPages).mockResolvedValue([]);

		// 2 回を同時実行 → 2 回目は resolvingDataSourceId を再利用
		await Promise.all([dbNameAdapter.list(), dbNameAdapter.list()]);

		// search は 1 回だけ呼ばれるはず
		expect(mockSearch).toHaveBeenCalledTimes(1);
	});

	it("title が未定義の data_source はタイトル一致から除外され最初の data_source を使う", async () => {
		const mockSearch = vi.fn().mockResolvedValue({
			results: [
				// title なし data_source → title = "" → マッチしない
				{ object: "data_source", id: "no-title-db-id" },
				{
					object: "data_source",
					id: "titled-db-id",
					title: [{ plain_text: "TargetDB" }],
				},
			],
		});
		vi.mocked(createClient).mockReturnValue({ search: mockSearch } as never);

		const dbNameAdapter = createNotionCollection({
			token: "test-token",
			dbName: "TargetDB",
		});
		vi.mocked(queryAllPages).mockResolvedValue([]);
		await dbNameAdapter.list();
		// タイトル一致する "titled-db-id" が使われる
		expect(queryAllPages).toHaveBeenCalledWith(
			expect.anything(),
			"titled-db-id",
		);
	});

	it("data_source でないオブジェクトをスキップしてタイトル一致を検索する", async () => {
		const mockSearch = vi.fn().mockResolvedValue({
			results: [
				{ object: "page", id: "page-id" },
				{
					object: "data_source",
					id: "correct-db-id",
					title: [{ plain_text: "TargetDB" }],
				},
			],
		});
		vi.mocked(createClient).mockReturnValue({ search: mockSearch } as never);

		const dbNameAdapter = createNotionCollection({
			token: "test-token",
			dbName: "TargetDB",
		});
		vi.mocked(queryAllPages).mockResolvedValue([]);
		await dbNameAdapter.list();
		expect(queryAllPages).toHaveBeenCalledWith(
			expect.anything(),
			"correct-db-id",
		);
	});
});

describe("createNotionCollection - list() エラー処理", () => {
	const adapter = createNotionCollection({
		token: "test-token",
		dataSourceId: "test-db-id",
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockReturnValue({} as never);
	});

	it("非 CMSError は source/fetch_items_failed でラップされる", async () => {
		vi.mocked(queryAllPages).mockRejectedValue(new Error("network error"));
		await expect(adapter.list()).rejects.toSatisfy(
			(err: unknown) =>
				isCMSError(err) && err.code === "source/fetch_items_failed",
		);
	});

	it("CMSError はそのままリスローされる", async () => {
		const { CMSError } = await import("@notion-headless-cms/core");
		const cmsErr = new CMSError({
			code: "source/fetch_items_failed",
			message: "original error",
			context: { operation: "test" },
		});
		vi.mocked(queryAllPages).mockRejectedValue(cmsErr);
		await expect(adapter.list()).rejects.toBe(cmsErr);
	});
});

describe("createNotionCollection - findByProp() エラー処理", () => {
	const adapter = createNotionCollection({
		token: "test-token",
		dataSourceId: "test-db-id",
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockReturnValue({} as never);
	});

	it("非 CMSError は source/fetch_item_failed でラップされる", async () => {
		vi.mocked(queryPageByProp).mockRejectedValue(new Error("network error"));
		await expect(adapter.findByProp?.("Slug", "test")).rejects.toSatisfy(
			(err: unknown) =>
				isCMSError(err) && err.code === "source/fetch_item_failed",
		);
	});

	it("CMSError はそのままリスローされる", async () => {
		const { CMSError } = await import("@notion-headless-cms/core");
		const cmsErr = new CMSError({
			code: "source/fetch_item_failed",
			message: "original error",
			context: { operation: "test" },
		});
		vi.mocked(queryPageByProp).mockRejectedValue(cmsErr);
		await expect(adapter.findByProp?.("Slug", "test")).rejects.toBe(cmsErr);
	});
});

describe("createNotionCollection - loadMarkdown() エラー処理", () => {
	// vi.mock の transform は全インスタンスで共有される vi.fn()
	const getTransformMock = () =>
		(new Transformer() as unknown as { transform: ReturnType<typeof vi.fn> })
			.transform;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockReturnValue({} as never);
		getTransformMock().mockResolvedValue("# Hello");
	});

	it("非 CMSError は source/load_markdown_failed でラップされる", async () => {
		getTransformMock().mockRejectedValueOnce(new Error("transform failed"));
		const failAdapter = createNotionCollection({
			token: "test-token",
			dataSourceId: "test-db-id",
		});
		const item = { id: "page-id", slug: "my-post", updatedAt: "2024-01-01" };
		await expect(failAdapter.loadMarkdown(item)).rejects.toSatisfy(
			(err: unknown) =>
				isCMSError(err) && err.code === "source/load_markdown_failed",
		);
	});

	it("CMSError はそのままリスローされる", async () => {
		const { CMSError } = await import("@notion-headless-cms/core");
		const cmsErr = new CMSError({
			code: "source/load_markdown_failed",
			message: "original",
			context: { operation: "test" },
		});
		getTransformMock().mockRejectedValueOnce(cmsErr);
		const errorAdapter = createNotionCollection({
			token: "test-token",
			dataSourceId: "test-db-id",
		});
		const item = { id: "page-id", slug: "my-post", updatedAt: "2024-01-01" };
		await expect(errorAdapter.loadMarkdown(item)).rejects.toBe(cmsErr);
	});
});

describe("createNotionCollection - loadBlocks()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createClient).mockReturnValue({} as never);
		// transform の default 実装を確実にリセット
		const transformMock = (
			new Transformer() as unknown as { transform: ReturnType<typeof vi.fn> }
		).transform;
		transformMock.mockResolvedValue("# Hello");
	});

	it("loadBlocks() が loadMarkdown 結果からブロックを返す", async () => {
		const blocksAdapter = createNotionCollection({
			token: "test-token",
			dataSourceId: "test-db-id",
		});
		const item = { id: "page-id", slug: "my-post", updatedAt: "2024-01-01" };
		const blocks = await blocksAdapter.loadBlocks(item);
		expect(Array.isArray(blocks)).toBe(true);
	});
});

describe("createNotionCollection - getLastModified / getListVersion", () => {
	const adapter = createNotionCollection({
		token: "test-token",
		dataSourceId: "test-db-id",
	});

	it("getLastModified() はアイテムの updatedAt を返す", () => {
		const item = {
			id: "page-id",
			slug: "my-post",
			updatedAt: "2024-06-01T00:00:00Z",
		};
		expect(adapter.getLastModified(item)).toBe("2024-06-01T00:00:00Z");
	});

	it("getListVersion() はアイテムリストのバージョン文字列を返す", () => {
		const items = [
			{ id: "id-a", slug: "a", updatedAt: "2024-01-01" },
			{ id: "id-b", slug: "b", updatedAt: "2024-01-02" },
		];
		const version = adapter.getListVersion(items);
		expect(version).toContain("id-a");
		expect(version).toContain("id-b");
	});
});

describe("createNotionCollection - properties オプション（新形式）", () => {
	const propertiesAdapter = createNotionCollection({
		token: "test-token",
		dataSourceId: "test-db-id",
		properties: {
			name: { type: "title", notion: "Name" },
			slug: { type: "richText", notion: "Slug" },
			status: { type: "status", notion: "Status" },
		},
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("properties オプション使用時、source.properties が設定される", () => {
		expect(propertiesAdapter.properties).toBeDefined();
		expect(propertiesAdapter.properties?.slug).toEqual({
			type: "richText",
			notion: "Slug",
		});
	});

	it("list() が PropertyMap に従ってアイテムをマップする", async () => {
		vi.mocked(queryAllPages).mockResolvedValue([
			makePage("my-post", "公開") as never,
		]);

		const items = await propertiesAdapter.list();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("my-post");
	});

	it("findByProp() が queryPageByProp を呼ぶ", async () => {
		vi.mocked(queryPageByProp).mockResolvedValue(
			makePage("my-post", "公開") as never,
		);

		const item = await propertiesAdapter.findByProp?.("Slug", "my-post");
		expect(item).not.toBeNull();
		expect(queryPageByProp).toHaveBeenCalledWith(
			expect.anything(),
			"test-db-id",
			"Slug",
			"my-post",
		);
	});

	it("findByProp() でページが見つからない場合は null を返す", async () => {
		vi.mocked(queryPageByProp).mockResolvedValue(null);

		const item = await propertiesAdapter.findByProp?.("Slug", "nonexistent");
		expect(item).toBeNull();
	});
});
