import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createNotionCollection, notionAdapter } from "../notion-adapter";
import { defineMapping, defineSchema } from "../schema";

vi.mock("../internal/fetcher/index", () => ({
	createClient: vi.fn().mockReturnValue({}),
	queryAllPages: vi.fn(),
	queryPageBySlug: vi.fn(),
	queryPageByProp: vi.fn(),
}));

vi.mock("../internal/transformer/transformer", () => {
	const transform = vi.fn().mockResolvedValue("# Hello");
	class MockTransformer {
		transform = transform;
	}
	return { Transformer: MockTransformer };
});

import {
	queryAllPages,
	queryPageByProp,
	queryPageBySlug,
} from "../internal/fetcher/index";

const makePage = (slug: string, status: string) => ({
	id: `id-${slug}`,
	last_edited_time: "2024-01-01T00:00:00.000Z",
	created_time: "2024-01-01T00:00:00.000Z",
	properties: {
		Name: { type: "title", title: [{ plain_text: slug }] },
		Slug: { type: "rich_text", rich_text: [{ plain_text: slug }] },
		Status: { status: { name: status } },
		CreatedAt: { date: { start: "2024-01-01" } },
	},
});

describe("notionAdapter", () => {
	const adapter = notionAdapter({
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
						Slug: { rich_text: [{ plain_text: "no-title" }] },
						Status: { status: { name: "公開" } },
						CreatedAt: { date: { start: "2024-01-01" } },
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
						CreatedAt: { date: { start: "2023-01-01" } },
					},
				} as never,
				{
					...makePage("new", "公開"),
					properties: {
						...makePage("new", "公開").properties,
						CreatedAt: { date: { start: "2024-06-01" } },
					},
				} as never,
			]);

			const items = await adapter.list();
			expect(items[0].slug).toBe("new");
		});
	});

	describe("findBySlug()", () => {
		it("スラッグに一致するアイテムを返す", async () => {
			vi.mocked(queryPageBySlug).mockResolvedValue(
				makePage("my-post", "公開") as never,
			);

			const item = await adapter.findBySlug?.("my-post");
			expect(item?.slug).toBe("my-post");
			expect(queryPageBySlug).toHaveBeenCalledWith(
				expect.anything(),
				"test-db-id",
				"my-post",
				"Slug",
			);
		});

		it("見つからない場合は null を返す", async () => {
			vi.mocked(queryPageBySlug).mockResolvedValue(null);

			const item = await adapter.findBySlug?.("nonexistent");
			expect(item).toBeNull();
		});

		it("schema で slug プロパティ名を指定した場合、そのプロパティ名で rich_text 検索する", async () => {
			const SlugSchema = z.object({
				id: z.string(),
				updatedAt: z.string(),
				slug: z.string(),
				title: z.string().nullable().optional(),
			});
			const slugMapping = defineMapping<z.infer<typeof SlugSchema>>({
				slug: { type: "richText", notion: "Slug" },
			});
			const schemaAdapter = notionAdapter({
				token: "test-token",
				dataSourceId: "test-db-id",
				schema: defineSchema(SlugSchema, slugMapping),
			});

			vi.mocked(queryPageBySlug).mockResolvedValue(
				makePage("my-post", "公開") as never,
			);

			await schemaAdapter.findBySlug?.("my-post");
			expect(queryPageBySlug).toHaveBeenCalledWith(
				expect.anything(),
				"test-db-id",
				"my-post",
				"Slug",
			);
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

describe("createNotionCollection - properties オプション（新形式）", () => {
	const propertiesAdapter = createNotionCollection({
		token: "test-token",
		dataSourceId: "test-db-id",
		properties: {
			name: { type: "title", notion: "Name" },
			slug: { type: "richText", notion: "Slug" },
			status: { type: "select", notion: "Status" },
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
