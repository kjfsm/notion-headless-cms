import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { type CMS, createCMS } from "../cms";
import type {
	BaseContentItem,
	CachedItem,
	DataSourceAdapter,
} from "../types/index";

vi.mock("@notion-headless-cms/renderer", () => ({
	renderMarkdown: vi.fn().mockResolvedValue("<p>rendered</p>"),
}));

const makeItem = (
	slug: string,
	status = "公開",
	publishedAt = "2024-01-01",
): BaseContentItem => ({
	id: `id-${slug}`,
	slug,
	status,
	publishedAt,
	updatedAt: "2024-01-01T00:00:00.000Z",
});

const makeMockSource = (items: BaseContentItem[] = []): DataSourceAdapter => ({
	name: "mock",
	list: vi.fn().mockImplementation(async (opts) => {
		if (opts?.publishedStatuses && opts.publishedStatuses.length > 0) {
			return items.filter(
				(i) =>
					i.status && (opts.publishedStatuses as string[]).includes(i.status),
			);
		}
		return items;
	}),
	findBySlug: vi.fn().mockImplementation(async (slug) => {
		return items.find((i) => i.slug === slug) ?? null;
	}),
	loadMarkdown: vi.fn().mockResolvedValue("# Hello"),
});

describe("CMS", () => {
	const items = [
		makeItem("post-a", "公開", "2024-03-01"),
		makeItem("post-b", "公開", "2024-01-01"),
		makeItem("draft-c", "下書き", "2024-02-01"),
	];

	let source: DataSourceAdapter;
	let cms: CMS;

	beforeEach(() => {
		source = makeMockSource(items);
		cms = createCMS({
			source,
			schema: { publishedStatuses: ["公開"] },
		});
	});

	describe("list()", () => {
		it("publishedStatuses でフィルタしてソース list() を呼ぶ", async () => {
			const result = await cms.list();
			expect(source.list).toHaveBeenCalledWith({
				publishedStatuses: ["公開"],
			});
			expect(result).toHaveLength(2);
		});
	});

	describe("find()", () => {
		it("存在するスラッグのアイテムを返す", async () => {
			const item = await cms.find("post-a");
			expect(item?.slug).toBe("post-a");
		});

		it("存在しないスラッグでは null を返す", async () => {
			const item = await cms.find("nonexistent");
			expect(item).toBeNull();
		});

		it("accessibleStatuses 外のアイテムは null を返す", async () => {
			const restrictedCms = createCMS({
				source,
				schema: {
					publishedStatuses: ["公開"],
					accessibleStatuses: ["公開"],
				},
			});
			const item = await restrictedCms.find("draft-c");
			expect(item).toBeNull();
		});
	});

	describe("isPublished()", () => {
		it("publishedStatuses に含まれるなら true", () => {
			expect(cms.isPublished(makeItem("x", "公開"))).toBe(true);
		});

		it("publishedStatuses に含まれないなら false", () => {
			expect(cms.isPublished(makeItem("x", "下書き"))).toBe(false);
		});
	});

	describe("render()", () => {
		it("アイテムを CachedItem にレンダリングする", async () => {
			const item = makeItem("post-a");
			const result = await cms.render(item);
			expect(result.html).toBe("<p>rendered</p>");
			expect(result.item).toBe(item);
		});
	});

	describe("find() + render()", () => {
		it("スラッグからレンダリング済み CachedItem を返す", async () => {
			const item = await cms.find("post-a");
			expect(item).not.toBeNull();
			const result = await cms.render(item!);
			expect(result.html).toBe("<p>rendered</p>");
		});

		it("存在しないスラッグでは null を返す", async () => {
			const item = await cms.find("nonexistent");
			expect(item).toBeNull();
		});
	});

	describe("query().status()", () => {
		it("指定ステータスのアイテムだけ返す", async () => {
			const result = await cms.query().status("下書き").execute();
			expect(result.items).toHaveLength(1);
			expect(result.items[0].slug).toBe("draft-c");
		});

		it("複数ステータスを配列で指定できる", async () => {
			const result = await cms.query().status(["公開", "下書き"]).execute();
			expect(result.items).toHaveLength(3);
		});
	});

	describe("query().where()", () => {
		it("任意の述語でフィルタリングする", async () => {
			const result = await cms
				.query()
				.where((i) => i.slug.startsWith("post"))
				.execute();
			expect(result.items).toHaveLength(2);
		});
	});

	describe("query().paginate()", () => {
		it("ページネーションで正しく分割する", async () => {
			const result = await cms
				.query()
				.paginate({ page: 1, perPage: 1 })
				.execute();
			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(2);
			expect(result.hasNext).toBe(true);
		});

		it("最終ページは hasNext が false", async () => {
			const result = await cms
				.query()
				.paginate({ page: 2, perPage: 1 })
				.execute();
			expect(result.hasNext).toBe(false);
		});
	});

	describe("query().adjacent()", () => {
		it("前後のアイテムを返す", async () => {
			const adj = await cms.query().adjacent("post-a");
			expect(adj.prev).toBeNull();
			expect(adj.next?.slug).toBe("post-b");
		});

		it("最後のアイテムは next が null", async () => {
			const adj = await cms.query().adjacent("post-b");
			expect(adj.next).toBeNull();
		});
	});

	describe("getStaticSlugs()", () => {
		it("一覧のスラッグ配列を返す", async () => {
			const slugs = await cms.getStaticSlugs();
			expect(slugs).toContain("post-a");
			expect(slugs).toContain("post-b");
		});
	});

	describe("cached.list() - SWR", () => {
		it("キャッシュが新鮮なら source.list() を呼ばない", async () => {
			const docCache = memoryCache();
			const swrCms = createCMS({
				source,
				cache: {
					document: docCache,
					ttlMs: 60_000,
				},
			});

			await docCache.setList({
				items: [makeItem("cached")],
				cachedAt: Date.now(),
			});
			vi.clearAllMocks();

			const result = await swrCms.cached.list();
			expect(result.items[0].slug).toBe("cached");
			expect(source.list).not.toHaveBeenCalled();
		});

		it("TTL 切れなら source.list() を呼ぶ", async () => {
			const docCache = memoryCache();
			const swrCms = createCMS({
				source,
				cache: {
					document: docCache,
					ttlMs: 1,
				},
			});

			await docCache.setList({ items: [makeItem("stale")], cachedAt: 0 });
			const result = await swrCms.cached.list();
			expect(source.list).toHaveBeenCalled();
			expect(result.items).not.toEqual([{ slug: "stale" }]);
		});
	});

	describe("cached.get() - SWR", () => {
		it("キャッシュが新鮮なら source.findBySlug() を呼ばない", async () => {
			const docCache = memoryCache();
			const swrCms = createCMS({
				source,
				cache: {
					document: docCache,
					ttlMs: 60_000,
				},
			});
			const cachedEntry: CachedItem = {
				html: "<p>cached</p>",
				item: makeItem("post-a"),
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await docCache.setItem("post-a", cachedEntry);
			vi.clearAllMocks();

			const result = await swrCms.cached.get("post-a");
			expect(result?.html).toBe("<p>cached</p>");
			expect(source.findBySlug).not.toHaveBeenCalled();
		});
	});

	describe("waitUntil", () => {
		it("キャッシュ更新を waitUntil に渡す", async () => {
			const waitUntil = vi.fn();
			const docCache = memoryCache();
			const swrCms = createCMS({
				source,
				cache: { document: docCache, ttlMs: 1 },
				waitUntil,
			});

			await docCache.setList({ items: [], cachedAt: 0 });
			await swrCms.cached.list();

			expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
		});
	});

	describe("revalidate()", () => {
		it("invalidate を持つキャッシュを呼び出す", async () => {
			const docCache = memoryCache();
			const invalidateSpy = vi.spyOn(docCache, "invalidate");
			const swrCms = createCMS({
				source,
				cache: { document: docCache },
			});

			await swrCms.revalidate("all");
			expect(invalidateSpy).toHaveBeenCalledWith("all");
		});
	});
});
