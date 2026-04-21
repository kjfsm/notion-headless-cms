import { describe, expect, it } from "vitest";
import {
	memoryCache,
	memoryDocumentCache,
	memoryImageCache,
} from "../cache/memory";

const makeItem = (slug: string) => ({
	id: `id-${slug}`,
	slug,
	status: "公開",
	publishedAt: "2024-01-01",
	updatedAt: "2024-01-01",
});

const makeCachedItem = (slug: string) => ({
	html: `<p>${slug}</p>`,
	item: makeItem(slug),
	notionUpdatedAt: "2024-01-01T00:00:00.000Z",
	cachedAt: Date.now(),
});

describe("MemoryDocumentCache", () => {
	it("初期状態で getList は null を返す", async () => {
		const cache = memoryDocumentCache();
		expect(await cache.getList()).toBeNull();
	});

	it("setList → getList でデータを保持する", async () => {
		const cache = memoryDocumentCache();
		const items = [makeItem("a"), makeItem("b")];
		await cache.setList({ items, cachedAt: 1234 });
		const result = await cache.getList();
		expect(result?.items).toHaveLength(2);
		expect(result?.cachedAt).toBe(1234);
	});

	it("初期状態で getItem は null を返す", async () => {
		const cache = memoryDocumentCache();
		expect(await cache.getItem("nonexistent")).toBeNull();
	});

	it("setItem → getItem でデータを保持する", async () => {
		const cache = memoryCache();
		const data = makeCachedItem("my-post");
		await cache.setItem("my-post", data);
		const result = await cache.getItem("my-post");
		expect(result?.html).toBe("<p>my-post</p>");
	});

	it("invalidate('all') で全データをクリアする", async () => {
		const cache = memoryDocumentCache();
		await cache.setList({ items: [makeItem("a")], cachedAt: 0 });
		await cache.setItem("a", makeCachedItem("a"));
		await cache.invalidate?.("all");
		expect(await cache.getList()).toBeNull();
		expect(await cache.getItem("a")).toBeNull();
	});

	it("invalidate({ slug }) で対象スラッグのみクリアする", async () => {
		const cache = memoryDocumentCache();
		await cache.setItem("a", makeCachedItem("a"));
		await cache.setItem("b", makeCachedItem("b"));
		await cache.invalidate?.({ slug: "a" });
		expect(await cache.getItem("a")).toBeNull();
		expect(await cache.getItem("b")).not.toBeNull();
	});

	it("maxItems 指定時に LRU で古いエントリが退避される", async () => {
		const cache = memoryDocumentCache({ maxItems: 2 });
		await cache.setItem("a", makeCachedItem("a"));
		await cache.setItem("b", makeCachedItem("b"));
		await cache.setItem("c", makeCachedItem("c"));
		expect(await cache.getItem("a")).toBeNull();
		expect(await cache.getItem("b")).not.toBeNull();
		expect(await cache.getItem("c")).not.toBeNull();
	});

	it("getItem でアクセスされたエントリは LRU の末尾に移動する", async () => {
		const cache = memoryDocumentCache({ maxItems: 2 });
		await cache.setItem("a", makeCachedItem("a"));
		await cache.setItem("b", makeCachedItem("b"));
		await cache.getItem("a");
		await cache.setItem("c", makeCachedItem("c"));
		expect(await cache.getItem("a")).not.toBeNull();
		expect(await cache.getItem("b")).toBeNull();
		expect(await cache.getItem("c")).not.toBeNull();
	});
});

describe("MemoryImageCache", () => {
	it("初期状態で get は null を返す", async () => {
		const cache = memoryImageCache();
		expect(await cache.get("hash")).toBeNull();
	});

	it("set → get でデータを保持する", async () => {
		const cache = memoryImageCache();
		const data = new ArrayBuffer(4);
		await cache.set("hash123", data, "image/png");
		const result = await cache.get("hash123");
		expect(result?.contentType).toBe("image/png");
		expect(result?.data).toBe(data);
	});

	it("maxItems 指定時に LRU で古いエントリが退避される", async () => {
		const cache = memoryImageCache({ maxItems: 2 });
		await cache.set("a", new ArrayBuffer(8), "image/png");
		await cache.set("b", new ArrayBuffer(8), "image/png");
		await cache.set("c", new ArrayBuffer(8), "image/png");
		expect(await cache.get("a")).toBeNull();
		expect(await cache.get("b")).not.toBeNull();
		expect(await cache.get("c")).not.toBeNull();
	});

	it("maxSizeBytes 指定時に合計サイズを超えるエントリを退避する", async () => {
		const cache = memoryImageCache({ maxSizeBytes: 20 });
		await cache.set("a", new ArrayBuffer(10), "image/png");
		await cache.set("b", new ArrayBuffer(10), "image/png");
		await cache.set("c", new ArrayBuffer(10), "image/png");
		expect(await cache.get("a")).toBeNull();
		expect(await cache.get("b")).not.toBeNull();
		expect(await cache.get("c")).not.toBeNull();
	});
});
