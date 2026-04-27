import { describe, expect, it } from "vitest";
import { memoryDocumentCache, memoryImageCache } from "../cache/memory";
import type { CachedItemContent, CachedItemMeta } from "../types/index";

const makeItem = (slug: string) => ({
	id: `id-${slug}`,
	slug,
	status: "公開",
	publishedAt: "2024-01-01",
	updatedAt: "2024-01-01",
});

const makeMeta = (slug: string): CachedItemMeta => ({
	item: makeItem(slug),
	notionUpdatedAt: "2024-01-01T00:00:00.000Z",
	cachedAt: Date.now(),
});

const makeContent = (slug: string): CachedItemContent => ({
	html: `<p>${slug}</p>`,
	markdown: `# ${slug}`,
	blocks: [],
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

	it("初期状態で getItemMeta は null を返す", async () => {
		const cache = memoryDocumentCache();
		expect(await cache.getItemMeta("nonexistent")).toBeNull();
	});

	it("setItemMeta → getItemMeta でデータを保持する", async () => {
		const cache = memoryDocumentCache();
		await cache.setItemMeta("my-post", makeMeta("my-post"));
		const result = await cache.getItemMeta("my-post");
		expect(result?.item.slug).toBe("my-post");
	});

	it("setItemContent → getItemContent でデータを保持する", async () => {
		const cache = memoryDocumentCache();
		await cache.setItemContent("my-post", makeContent("my-post"));
		const result = await cache.getItemContent("my-post");
		expect(result?.html).toBe("<p>my-post</p>");
	});

	it("メタと本文は独立に保持される（meta セットだけでは content は null）", async () => {
		const cache = memoryDocumentCache();
		await cache.setItemMeta("a", makeMeta("a"));
		expect(await cache.getItemMeta("a")).not.toBeNull();
		expect(await cache.getItemContent("a")).toBeNull();
	});

	it("invalidate('all') で全データをクリアする", async () => {
		const cache = memoryDocumentCache();
		await cache.setList({ items: [makeItem("a")], cachedAt: 0 });
		await cache.setItemMeta("a", makeMeta("a"));
		await cache.setItemContent("a", makeContent("a"));
		await cache.invalidate?.("all");
		expect(await cache.getList()).toBeNull();
		expect(await cache.getItemMeta("a")).toBeNull();
		expect(await cache.getItemContent("a")).toBeNull();
	});

	it("invalidate({ collection, slug }) で対象スラッグのみクリアする", async () => {
		const cache = memoryDocumentCache();
		await cache.setItemMeta("a", makeMeta("a"));
		await cache.setItemContent("a", makeContent("a"));
		await cache.setItemMeta("b", makeMeta("b"));
		await cache.invalidate?.({ collection: "posts", slug: "a" });
		expect(await cache.getItemMeta("a")).toBeNull();
		expect(await cache.getItemContent("a")).toBeNull();
		expect(await cache.getItemMeta("b")).not.toBeNull();
	});

	it("invalidate({ ..., kind: 'content' }) で本文のみクリアし meta は残す", async () => {
		const cache = memoryDocumentCache();
		await cache.setItemMeta("a", makeMeta("a"));
		await cache.setItemContent("a", makeContent("a"));
		await cache.invalidate?.({
			collection: "posts",
			slug: "a",
			kind: "content",
		});
		expect(await cache.getItemMeta("a")).not.toBeNull();
		expect(await cache.getItemContent("a")).toBeNull();
	});

	it("invalidate({ collection }) でコレクションプレフィックスのアイテムをクリアする", async () => {
		const cache = memoryDocumentCache();
		// scopeDocumentCache が "{collection}:{slug}" 形式でキーを設定する
		await cache.setItemMeta("posts:a", makeMeta("a"));
		await cache.setItemContent("posts:a", makeContent("a"));
		await cache.setItemMeta("posts:b", makeMeta("b"));
		await cache.setItemMeta("pages:c", makeMeta("c"));
		await cache.invalidate?.({ collection: "posts" });
		expect(await cache.getItemMeta("posts:a")).toBeNull();
		expect(await cache.getItemContent("posts:a")).toBeNull();
		expect(await cache.getItemMeta("posts:b")).toBeNull();
		// 別コレクションはクリアされない
		expect(await cache.getItemMeta("pages:c")).not.toBeNull();
	});

	it("maxItems 指定時に LRU で古いエントリが退避される", async () => {
		const cache = memoryDocumentCache({ maxItems: 2 });
		await cache.setItemMeta("a", makeMeta("a"));
		await cache.setItemMeta("b", makeMeta("b"));
		await cache.setItemMeta("c", makeMeta("c"));
		expect(await cache.getItemMeta("a")).toBeNull();
		expect(await cache.getItemMeta("b")).not.toBeNull();
		expect(await cache.getItemMeta("c")).not.toBeNull();
	});

	it("getItemMeta でアクセスされたエントリは LRU の末尾に移動する", async () => {
		const cache = memoryDocumentCache({ maxItems: 2 });
		await cache.setItemMeta("a", makeMeta("a"));
		await cache.setItemMeta("b", makeMeta("b"));
		await cache.getItemMeta("a");
		await cache.setItemMeta("c", makeMeta("c"));
		expect(await cache.getItemMeta("a")).not.toBeNull();
		expect(await cache.getItemMeta("b")).toBeNull();
		expect(await cache.getItemMeta("c")).not.toBeNull();
	});

	it("setItemContent でも maxItems 超過分が LRU で退避される", async () => {
		const cache = memoryDocumentCache({ maxItems: 2 });
		await cache.setItemContent("a", makeContent("a"));
		await cache.setItemContent("b", makeContent("b"));
		await cache.setItemContent("c", makeContent("c"));
		expect(await cache.getItemContent("a")).toBeNull();
		expect(await cache.getItemContent("b")).not.toBeNull();
		expect(await cache.getItemContent("c")).not.toBeNull();
	});

	it("getItemContent でアクセスされたエントリは LRU の末尾に移動する", async () => {
		const cache = memoryDocumentCache({ maxItems: 2 });
		await cache.setItemContent("a", makeContent("a"));
		await cache.setItemContent("b", makeContent("b"));
		await cache.getItemContent("a");
		await cache.setItemContent("c", makeContent("c"));
		expect(await cache.getItemContent("a")).not.toBeNull();
		expect(await cache.getItemContent("b")).toBeNull();
		expect(await cache.getItemContent("c")).not.toBeNull();
	});

	it("同じスラッグで上書き setItemMeta すると最新値が保持される", async () => {
		const cache = memoryDocumentCache();
		const first = makeMeta("a");
		const second = { ...first, cachedAt: first.cachedAt + 1000 };
		await cache.setItemMeta("a", first);
		await cache.setItemMeta("a", second);
		const result = await cache.getItemMeta("a");
		expect(result?.cachedAt).toBe(second.cachedAt);
	});

	it("同じスラッグで上書き setItemContent すると最新値が保持される", async () => {
		const cache = memoryDocumentCache();
		const first = makeContent("a");
		const second = { ...first, html: "<p>updated</p>" };
		await cache.setItemContent("a", first);
		await cache.setItemContent("a", second);
		const result = await cache.getItemContent("a");
		expect(result?.html).toBe("<p>updated</p>");
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

	it("同じハッシュで上書きセットすると古いデータが置き換わる", async () => {
		const cache = memoryImageCache();
		const data1 = new ArrayBuffer(8);
		const data2 = new ArrayBuffer(16);
		await cache.set("hash-abc", data1, "image/png");
		await cache.set("hash-abc", data2, "image/jpeg");
		const result = await cache.get("hash-abc");
		expect(result?.contentType).toBe("image/jpeg");
		expect(result?.data).toBe(data2);
	});
});
