import { describe, expect, it, vi } from "vitest";
import { CacheStore, isStale, sha256Hex } from "../cache";
import type { StorageAdapter } from "../types";

describe("sha256Hex", () => {
	it("空文字列のSHA-256ハッシュを返す", async () => {
		const result = await sha256Hex("");
		expect(result).toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});

	it("文字列のSHA-256ハッシュを返す", async () => {
		const result = await sha256Hex("hello");
		expect(result).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});

	it("同じ入力から同じハッシュを生成する", async () => {
		const a = await sha256Hex("test-url");
		const b = await sha256Hex("test-url");
		expect(a).toBe(b);
	});

	it("異なる入力から異なるハッシュを生成する", async () => {
		const a = await sha256Hex("url-1");
		const b = await sha256Hex("url-2");
		expect(a).not.toBe(b);
	});
});

describe("isStale", () => {
	it("ttlMs が未定義の場合は常に false を返す", () => {
		expect(isStale(0)).toBe(false);
		expect(isStale(Date.now() - 1_000_000)).toBe(false);
	});

	it("TTL 以内なら false を返す", () => {
		expect(isStale(Date.now() - 1_000, 5_000)).toBe(false);
	});

	it("TTL 超過なら true を返す", () => {
		expect(isStale(Date.now() - 10_000, 5_000)).toBe(true);
	});

	it("ちょうど TTL の境界値は true を返す", () => {
		expect(isStale(Date.now() - 5_001, 5_000)).toBe(true);
	});
});

describe("CacheStore", () => {
	const makeMockStorage = (): StorageAdapter => ({
		get: vi.fn().mockResolvedValue(null),
		put: vi.fn().mockResolvedValue(undefined),
		json: vi.fn().mockResolvedValue(null),
		binary: vi.fn().mockResolvedValue(null),
	});

	describe("ストレージなし", () => {
		const store = new CacheStore(undefined, "list.json", "content/", "images/");

		it("getItemList は null を返す", async () => {
			expect(await store.getItemList()).toBeNull();
		});

		it("getItem は null を返す", async () => {
			expect(await store.getItem("slug")).toBeNull();
		});

		it("getImage は null を返す", async () => {
			expect(await store.getImage("hash")).toBeNull();
		});

		it("setItemList は何もせず解決する", async () => {
			await expect(store.setItemList([])).resolves.toBeUndefined();
		});

		it("setItem は何もせず解決する", async () => {
			await expect(
				store.setItem("slug", {
					html: "",
					item: {
						id: "1",
						slug: "s",
						status: "p",
						publishedAt: "2024-01-01",
						updatedAt: "2024-01-01",
						title: "t",
						author: "a",
					},
					notionUpdatedAt: "",
					cachedAt: 0,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe("ストレージあり", () => {
		it("getItemList はリストキーで json() を呼ぶ", async () => {
			const storage = makeMockStorage();
			const store = new CacheStore(storage, "list.json", "content/", "images/");
			await store.getItemList();
			expect(storage.json).toHaveBeenCalledWith("list.json");
		});

		it("getItem はプレフィックス付きキーで json() を呼ぶ", async () => {
			const storage = makeMockStorage();
			const store = new CacheStore(storage, "list.json", "content/", "images/");
			await store.getItem("my-slug");
			expect(storage.json).toHaveBeenCalledWith("content/my-slug.json");
		});

		it("getImage はプレフィックス付きキーで binary() を呼ぶ", async () => {
			const storage = makeMockStorage();
			const store = new CacheStore(storage, "list.json", "content/", "images/");
			await store.getImage("abc123");
			expect(storage.binary).toHaveBeenCalledWith("images/abc123");
		});

		it("setItemList は JSON をシリアライズして put する", async () => {
			const storage = makeMockStorage();
			const store = new CacheStore(storage, "list.json", "content/", "images/");
			await store.setItemList([]);
			expect(storage.put).toHaveBeenCalledWith(
				"list.json",
				expect.stringContaining('"items":[]'),
				{ contentType: "application/json" },
			);
		});

		it("setItem はスラッグをキーに JSON を put する", async () => {
			const storage = makeMockStorage();
			const store = new CacheStore(storage, "list.json", "content/", "images/");
			await store.setItem("my-slug", {
				html: "<p>test</p>",
				item: {
					id: "1",
					slug: "my-slug",
					status: "published",
					publishedAt: "2024-01-01",
					updatedAt: "2024-01-01",
					title: "Test",
					author: "Author",
				},
				notionUpdatedAt: "2024-01-01T00:00:00.000Z",
				cachedAt: 0,
			});
			expect(storage.put).toHaveBeenCalledWith(
				"content/my-slug.json",
				expect.stringContaining('"html":"<p>test</p>"'),
				{ contentType: "application/json" },
			);
		});
	});
});
