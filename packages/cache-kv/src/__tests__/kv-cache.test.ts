import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
} from "@notion-headless-cms/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { kvCache } from "../kv-cache";
import type { KVNamespaceLike } from "../types";

const makeItem = (slug: string): BaseContentItem => ({
	id: `id-${slug}`,
	slug,
	updatedAt: "2024-01-01T00:00:00.000Z",
});

function makeMockKV(): KVNamespaceLike & { store: Map<string, string> } {
	const store = new Map<string, string>();
	return {
		store,
		get: vi.fn().mockImplementation(async (key: string, _type: "text") => {
			return store.get(key) ?? null;
		}),
		put: vi.fn().mockImplementation(async (key: string, value: string) => {
			store.set(key, value);
		}),
		delete: vi.fn().mockImplementation(async (key: string) => {
			store.delete(key);
		}),
		list: vi
			.fn()
			.mockImplementation(
				async (opts?: { prefix?: string; cursor?: string }) => {
					const prefix = opts?.prefix ?? "";
					const keys = [...store.keys()]
						.filter((k) => k.startsWith(prefix))
						.map((name) => ({ name }));
					return { keys, list_complete: true, cursor: undefined };
				},
			),
	};
}

describe("kvCache", () => {
	describe("ファクトリ", () => {
		it("kv が undefined なら undefined を返す", () => {
			const result = kvCache({ kv: undefined });
			expect(result).toBeUndefined();
		});

		it("kv が定義されていれば KVDocumentCache インスタンスを返す", () => {
			const kv = makeMockKV();
			const cache = kvCache({ kv });
			expect(cache).toBeDefined();
		});
	});

	describe("DocumentCacheAdapter", () => {
		let kv: ReturnType<typeof makeMockKV>;
		let cache: NonNullable<ReturnType<typeof kvCache>>;

		beforeEach(() => {
			kv = makeMockKV();
			const c = kvCache({ kv });
			if (!c) throw new Error("kvCache returned undefined");
			cache = c;
		});

		it("setList → getList でリストを取得できる", async () => {
			const list: CachedItemList = {
				items: [makeItem("post-a")],
				cachedAt: Date.now(),
			};
			await cache.setList(list);
			const result = await cache.getList();
			expect(result?.items[0].slug).toBe("post-a");
		});

		it("存在しないキーでは getList が null を返す", async () => {
			const result = await cache.getList();
			expect(result).toBeNull();
		});

		it("setItemMeta → getItemMeta でメタを取得できる", async () => {
			const meta: CachedItemMeta = {
				item: makeItem("post-a"),
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await cache.setItemMeta("post-a", meta);
			const result = await cache.getItemMeta("post-a");
			expect(result?.item.slug).toBe("post-a");
		});

		it("setItemContent → getItemContent で本文を取得できる", async () => {
			const content: CachedItemContent = {
				html: "<p>hello</p>",
				markdown: "# hello",
				blocks: [],
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await cache.setItemContent("post-a", content);
			const result = await cache.getItemContent("post-a");
			expect(result?.html).toBe("<p>hello</p>");
		});

		it("存在しないスラッグでは getItemMeta / getItemContent が null を返す", async () => {
			expect(await cache.getItemMeta("nonexistent")).toBeNull();
			expect(await cache.getItemContent("nonexistent")).toBeNull();
		});

		it("prefix オプションがキーに反映される", async () => {
			const prefixedCache = kvCache({ kv, prefix: "blog/" });
			if (!prefixedCache) throw new Error("unexpected undefined");
			const list: CachedItemList = {
				items: [makeItem("post-x")],
				cachedAt: Date.now(),
			};
			await prefixedCache.setList(list);
			expect(kv.put).toHaveBeenCalledWith("blog/content", expect.any(String));
		});

		it("setItemMeta のキーが meta:{slug} になる", async () => {
			const meta: CachedItemMeta = {
				item: makeItem("my-post"),
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await cache.setItemMeta("my-post", meta);
			expect(kv.put).toHaveBeenCalledWith("meta:my-post", expect.any(String));
		});

		it("setItemContent のキーが content:{slug} になる", async () => {
			const content: CachedItemContent = {
				html: "<p>test</p>",
				markdown: "test",
				blocks: [],
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await cache.setItemContent("my-post", content);
			expect(kv.put).toHaveBeenCalledWith(
				"content:my-post",
				expect.any(String),
			);
		});

		it("invalidate({ slug, kind: 'content' }) で本文だけ消す", async () => {
			await cache.setItemMeta("a", {
				item: makeItem("a"),
				notionUpdatedAt: "2024-01-01",
				cachedAt: 0,
			});
			await cache.setItemContent("a", {
				html: "<p>x</p>",
				markdown: "x",
				blocks: [],
				notionUpdatedAt: "2024-01-01",
				cachedAt: 0,
			});
			await cache.invalidate?.({
				collection: "posts",
				slug: "a",
				kind: "content",
			});
			expect(await cache.getItemMeta("a")).not.toBeNull();
			expect(await cache.getItemContent("a")).toBeNull();
		});
	});
});
