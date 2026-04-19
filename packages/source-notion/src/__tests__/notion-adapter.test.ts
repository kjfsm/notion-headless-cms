import { beforeEach, describe, expect, it, vi } from "vitest";
import { notionAdapter } from "../notion-adapter";

vi.mock("@notion-headless-cms/fetcher", () => ({
	createClient: vi.fn().mockReturnValue({}),
	queryAllPages: vi.fn(),
	queryPageBySlug: vi.fn(),
}));

vi.mock("@notion-headless-cms/transformer", () => {
	const transform = vi.fn().mockResolvedValue("# Hello");
	class MockTransformer {
		transform = transform;
	}
	return { Transformer: MockTransformer };
});

import { queryAllPages, queryPageBySlug } from "@notion-headless-cms/fetcher";

const makePage = (slug: string, status: string) => ({
	id: `id-${slug}`,
	last_edited_time: "2024-01-01T00:00:00.000Z",
	created_time: "2024-01-01T00:00:00.000Z",
	properties: {
		Slug: { rich_text: [{ plain_text: slug }] },
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

			const item = await adapter.findBySlug("my-post");
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

			const item = await adapter.findBySlug("nonexistent");
			expect(item).toBeNull();
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
