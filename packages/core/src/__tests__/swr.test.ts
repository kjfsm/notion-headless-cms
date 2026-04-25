import { describe, expect, it, vi } from "vitest";
import { createCMS } from "../cms";
import { MemoryDocumentCache } from "../cache/memory";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

// buildCachedItem が renderer を動的 import するため、明示的に注入する
const mockRenderer: RendererFn = vi.fn().mockResolvedValue("<p>test</p>");

function makeMockSource(
	overrides: Partial<DataSource<BaseContentItem>> = {},
): DataSource<BaseContentItem> {
	return {
		name: "mock",
		async list() {
			return [];
		},
		async loadBlocks() {
			return [];
		},
		loadMarkdown: vi.fn().mockResolvedValue(""),
		getLastModified(item) {
			return item.updatedAt;
		},
		getListVersion(items) {
			return items.map((i) => i.updatedAt).join(",");
		},
		...overrides,
	};
}

describe("SWR（Stale-While-Revalidate）", () => {
	it("TTL 設定あり・期限切れの getItem はブロッキングで最新データを返す", async () => {
		const staleItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		// キャッシュに stale アイテムを事前セット（cachedAt: 0 → 必ず TTL 期限切れ）
		const cache = new MemoryDocumentCache();
		await cache.setItem("posts:my-post", {
			item: staleItem,
			html: "<p>stale</p>",
			notionUpdatedAt: staleItem.updatedAt,
			cachedAt: 0,
		});

		const waitUntil = vi.fn();

		const source = makeMockSource({
			async list() {
				return [freshItem];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
			waitUntil,
		});

		const result = await cms.posts.getItem("my-post");

		// TTL 期限切れ → ブロッキングで最新データが返される
		expect(result).not.toBeNull();
		expect(result?.updatedAt).toBe("2024-01-02T00:00:00Z");

		// ブロッキングフェッチなのでバックグラウンド Promise は渡されない
		expect(waitUntil).not.toHaveBeenCalled();
	});

	it("TTL 設定なしの getItem はキャッシュを即時返却してバックグラウンドで差分チェックする", async () => {
		const cachedItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		await cache.setItem("posts:my-post", {
			item: cachedItem,
			html: "<p>cached</p>",
			notionUpdatedAt: cachedItem.updatedAt,
			cachedAt: 0, // 古くてもTTLなしなので期限切れにならない
		});

		const capturedPromises: Promise<unknown>[] = [];
		const waitUntil = (p: Promise<unknown>) => {
			capturedPromises.push(p);
		};

		const source = makeMockSource({
			async list() {
				return [freshItem];
			},
		});

		// TTL 未設定（永続キャッシュ）
		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache },
			waitUntil,
		});

		const result = await cms.posts.getItem("my-post");

		// キャッシュが即時返される
		expect(result).not.toBeNull();
		expect(result?.updatedAt).toBe("2024-01-01T00:00:00Z");

		// バックグラウンド差分チェックの Promise が waitUntil に渡されている
		expect(capturedPromises.length).toBeGreaterThan(0);

		// バックグラウンド処理を待つ → 更新あり → キャッシュが新しいアイテムで更新される
		await Promise.all(capturedPromises);
		const updated = await cache.getItem("posts:my-post");
		expect(updated?.item.updatedAt).toBe("2024-01-02T00:00:00Z");
	});

	it("TTL 設定なしの getList はキャッシュを即時返却してバックグラウンドで差分チェックする", async () => {
		const cachedItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		await cache.setList({
			items: [cachedItem],
			cachedAt: 0, // 古くてもTTLなしなので期限切れにならない
		});

		const capturedPromises: Promise<unknown>[] = [];
		const waitUntil = (p: Promise<unknown>) => {
			capturedPromises.push(p);
		};

		const freshItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const source = makeMockSource({
			async list() {
				return [freshItem];
			},
		});

		// TTL 未設定（永続キャッシュ）
		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache },
			waitUntil,
		});

		const result = await cms.posts.getList();

		// キャッシュが即時返される
		expect(result).toHaveLength(1);
		expect(result[0].updatedAt).toBe("2024-01-01T00:00:00Z");

		// バックグラウンド差分チェックの Promise が waitUntil に渡されている
		expect(capturedPromises.length).toBeGreaterThan(0);
	});

	it("TTL 設定あり・期限切れの getList はブロッキングで最新リストを返す", async () => {
		const staleItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "page-2",
			slug: "new-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		await cache.setList({
			items: [staleItem],
			cachedAt: 0, // 必ず TTL 期限切れ
		});

		const waitUntil = vi.fn();

		const source = makeMockSource({
			async list() {
				return [staleItem, freshItem];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
			waitUntil,
		});

		const result = await cms.posts.getList();

		// TTL 期限切れ → ブロッキングで最新リストが返される
		expect(result).toHaveLength(2);

		// ブロッキングフェッチなのでバックグラウンド Promise は渡されない
		expect(waitUntil).not.toHaveBeenCalled();
	});

	it("TTL 設定あり・期限内の getItem はキャッシュを即時返却してバックグラウンド差分チェックする", async () => {
		const freshItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		// cachedAt: Date.now()、ttlMs: 60_000 → 期限内
		await cache.setItem("posts:my-post", {
			item: freshItem,
			html: "<p>fresh</p>",
			notionUpdatedAt: freshItem.updatedAt,
			cachedAt: Date.now(),
		});

		const capturedPromises: Promise<unknown>[] = [];
		const waitUntil = (p: Promise<unknown>) => {
			capturedPromises.push(p);
		};

		const source = makeMockSource({
			async list() {
				return [freshItem];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 60_000 },
			waitUntil,
		});

		await cms.posts.getItem("my-post");

		// 期限内でもバックグラウンド差分チェックは行われる
		expect(capturedPromises.length).toBeGreaterThan(0);
	});
});
