import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
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
			cache = kvCache({ kv })!;
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

		it("setItem → getItem でアイテムを取得できる", async () => {
			const entry: CachedItem = {
				html: "<p>hello</p>",
				item: makeItem("post-a"),
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await cache.setItem("post-a", entry);
			const result = await cache.getItem("post-a");
			expect(result?.html).toBe("<p>hello</p>");
		});

		it("存在しないスラッグでは getItem が null を返す", async () => {
			const result = await cache.getItem("nonexistent");
			expect(result).toBeNull();
		});

		it("prefix オプションがキーに反映される", async () => {
			const prefixedCache = kvCache({ kv, prefix: "blog/" })!;
			const list: CachedItemList = {
				items: [makeItem("post-x")],
				cachedAt: Date.now(),
			};
			await prefixedCache.setList(list);
			expect(kv.put).toHaveBeenCalledWith("blog/content", expect.any(String));
		});

		it("getItem のキーが prefix + content: + slug になる", async () => {
			const entry: CachedItem = {
				html: "<p>test</p>",
				item: makeItem("my-post"),
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: Date.now(),
			};
			await cache.setItem("my-post", entry);
			expect(kv.put).toHaveBeenCalledWith(
				"content:my-post",
				expect.any(String),
			);
		});
	});
});
