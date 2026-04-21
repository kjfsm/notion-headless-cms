import { describe, expect, it, vi } from "vitest";
import { QueryBuilder } from "../query";
import type { BaseContentItem, DataSourceAdapter } from "../types/index";

const makeItem = (
	slug: string,
	status = "公開",
	publishedAt = "2024-01-01",
	tags: string[] = [],
): BaseContentItem & { tags: string[] } => ({
	id: `id-${slug}`,
	slug,
	status,
	publishedAt,
	updatedAt: "2024-01-01T00:00:00.000Z",
	tags,
});

type Item = ReturnType<typeof makeItem>;

const items: Item[] = [
	makeItem("a", "公開", "2024-03-01", ["ts"]),
	makeItem("b", "公開", "2024-02-01", ["js"]),
	makeItem("c", "下書き", "2024-01-01", ["ts", "js"]),
];

const makeMockSource = (data: Item[] = items): DataSourceAdapter<Item> => ({
	name: "mock",
	list: vi.fn().mockImplementation(async (opts) => {
		if (opts?.publishedStatuses && opts.publishedStatuses.length > 0) {
			return data.filter(
				(i) =>
					i.status !== undefined &&
					(opts.publishedStatuses as string[]).includes(i.status),
			);
		}
		return data;
	}),
	findBySlug: vi.fn().mockImplementation(async (slug) => {
		return data.find((i) => i.slug === slug) ?? null;
	}),
	loadMarkdown: vi.fn().mockResolvedValue(""),
});

describe("QueryBuilder", () => {
	describe("execute()", () => {
		it("status フィルタでリストを絞る", async () => {
			const source = makeMockSource();
			const result = await new QueryBuilder(source, [])
				.status("下書き")
				.execute();
			expect(result.items.map((i) => i.slug)).toEqual(["c"]);
		});

		it("tag フィルタでリストを絞る", async () => {
			const source = makeMockSource();
			const result = await new QueryBuilder(source, []).tag("js").execute();
			const slugs = result.items.map((i) => i.slug);
			expect(slugs).toContain("b");
			expect(slugs).toContain("c");
		});

		it("where() でカスタムフィルタを適用する", async () => {
			const source = makeMockSource();
			const result = await new QueryBuilder(source, [])
				.where((i) => i.slug === "a")
				.execute();
			expect(result.items).toHaveLength(1);
		});

		it("sortBy() で昇順ソートする", async () => {
			const source = makeMockSource();
			const result = await new QueryBuilder(source, [])
				.sortBy("publishedAt", "asc")
				.execute();
			expect(result.items[0].publishedAt).toBe("2024-01-01");
		});

		it("paginate() で件数とページ情報を返す", async () => {
			const source = makeMockSource();
			const result = await new QueryBuilder(source, [])
				.paginate({ page: 1, perPage: 2 })
				.execute();
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(3);
			expect(result.hasNext).toBe(true);
			expect(result.hasPrev).toBe(false);
		});

		it("push-down: source.query が存在する場合に委譲する", async () => {
			const queryFn = vi
				.fn()
				.mockResolvedValue({ items: [makeItem("a")], hasMore: false });
			const source: DataSourceAdapter<Item> = {
				...makeMockSource(),
				query: queryFn,
			};
			const result = await new QueryBuilder(source, ["公開"])
				.status("公開")
				.execute();
			expect(queryFn).toHaveBeenCalled();
			expect(result.items[0].slug).toBe("a");
		});

		it("where() 使用時は push-down せずインメモリフィルタ", async () => {
			const queryFn = vi.fn();
			const source: DataSourceAdapter<Item> = {
				...makeMockSource(),
				query: queryFn,
			};
			await new QueryBuilder(source, []).where((i) => !!i).execute();
			expect(queryFn).not.toHaveBeenCalled();
		});
	});

	describe("executeOne()", () => {
		it("最初のアイテムを返す", async () => {
			const source = makeMockSource();
			const item = await new QueryBuilder(source, []).executeOne();
			expect(item?.slug).toBe("a");
		});

		it("0件の場合は null を返す", async () => {
			const source = makeMockSource([]);
			const item = await new QueryBuilder(source, []).executeOne();
			expect(item).toBeNull();
		});
	});

	describe("adjacent()", () => {
		it("前後のアイテムを返す", async () => {
			const source = makeMockSource();
			const adj = await new QueryBuilder(source, ["公開"]).adjacent("a");
			expect(adj.prev).toBeNull();
			expect(adj.next?.slug).toBe("b");
		});

		it("存在しないスラッグでは null/null を返す", async () => {
			const source = makeMockSource();
			const adj = await new QueryBuilder(source, []).adjacent("nonexistent");
			expect(adj.prev).toBeNull();
			expect(adj.next).toBeNull();
		});

		it("sortBy() のソート順を adjacent() に適用する", async () => {
			const source = makeMockSource();
			// publishedAt 昇順: c(2024-01-01) → b(2024-02-01) → a(2024-03-01)
			const adj = await new QueryBuilder(source, [])
				.sortBy("publishedAt", "asc")
				.adjacent("b");
			expect(adj.prev?.slug).toBe("c");
			expect(adj.next?.slug).toBe("a");
		});
	});

	describe("first()", () => {
		it("paginate(page:1, perPage:1) と同じ結果を返す", async () => {
			const source = makeMockSource();
			const item = await new QueryBuilder(source, ["公開"])
				.sortBy("publishedAt", "desc")
				.first();
			expect(item?.slug).toBe("a");
		});

		it("0件の場合は null を返す", async () => {
			const source = makeMockSource([]);
			const item = await new QueryBuilder(source, []).first();
			expect(item).toBeNull();
		});
	});
});
