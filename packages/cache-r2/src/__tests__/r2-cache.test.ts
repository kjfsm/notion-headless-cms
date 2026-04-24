import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
} from "@notion-headless-cms/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { r2Cache } from "../r2-cache";
import type { R2BucketLike, R2ObjectLike } from "../types";

const makeItem = (slug: string): BaseContentItem => ({
	id: `id-${slug}`,
	slug,
	updatedAt: "2024-01-01T00:00:00.000Z",
});

function makeR2Object(data: unknown): R2ObjectLike {
	return {
		json: vi.fn().mockResolvedValue(data),
		arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
		httpMetadata: { contentType: "application/json" },
	};
}

function makeMockBucket(): R2BucketLike & {
	store: Map<string, unknown>;
} {
	const store = new Map<string, unknown>();
	return {
		store,
		get: vi.fn().mockImplementation(async (key: string) => {
			const val = store.get(key);
			if (!val) return null;
			return makeR2Object(val);
		}),
		put: vi
			.fn()
			.mockImplementation(async (key: string, value: string | ArrayBuffer) => {
				const parsed = typeof value === "string" ? JSON.parse(value) : value;
				store.set(key, parsed);
			}),
	};
}

describe("r2Cache", () => {
	describe("ファクトリ", () => {
		it("bucket が undefined なら undefined を返す", () => {
			const result = r2Cache({ bucket: undefined });
			expect(result).toBeUndefined();
		});

		it("bucket が定義されていれば R2Cache インスタンスを返す", () => {
			const bucket = makeMockBucket();
			const cache = r2Cache({ bucket });
			expect(cache).toBeDefined();
		});
	});

	describe("DocumentCacheAdapter", () => {
		let bucket: ReturnType<typeof makeMockBucket>;
		let cache: NonNullable<ReturnType<typeof r2Cache>>;

		beforeEach(() => {
			bucket = makeMockBucket();
			const c = r2Cache({ bucket });
			if (!c) throw new Error("unexpected undefined");
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
			const prefixedCache = r2Cache({ bucket, prefix: "blog/" });
			if (!prefixedCache) throw new Error("unexpected undefined");
			const list: CachedItemList = {
				items: [makeItem("post-x")],
				cachedAt: Date.now(),
			};
			await prefixedCache.setList(list);
			expect(bucket.put).toHaveBeenCalledWith(
				"blog/content.json",
				expect.any(String),
				expect.anything(),
			);
		});
	});

	describe("ImageCacheAdapter", () => {
		let bucket: ReturnType<typeof makeMockBucket>;
		let cache: NonNullable<ReturnType<typeof r2Cache>>;

		beforeEach(() => {
			bucket = makeMockBucket();
			const c = r2Cache({ bucket });
			if (!c) throw new Error("unexpected undefined");
			cache = c;
		});

		it("set → get で画像を取得できる", async () => {
			const data = new ArrayBuffer(8);
			await cache.set("abc123", data, "image/png");
			expect(bucket.put).toHaveBeenCalledWith(
				"images/abc123",
				data,
				expect.objectContaining({
					httpMetadata: { contentType: "image/png" },
				}),
			);
			const result = await cache.get("abc123");
			expect(result).not.toBeNull();
		});

		it("存在しないハッシュでは get が null を返す", async () => {
			const result = await cache.get("nonexistent");
			expect(result).toBeNull();
		});
	});
});
