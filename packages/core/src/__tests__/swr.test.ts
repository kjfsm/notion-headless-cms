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
		getListVersion() {
			return "";
		},
		...overrides,
	};
}

describe("SWR（Stale-While-Revalidate）", () => {
	it("stale な getItem は即時 stale データを返す", async () => {
		const staleItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		// キャッシュに stale アイテムを事前セット（cachedAt: 0 → 必ず stale）
		const cache = new MemoryDocumentCache();
		await cache.setItem("posts:my-post", {
			item: staleItem,
			html: "<p>stale</p>",
			notionUpdatedAt: staleItem.updatedAt,
			cachedAt: 0,
		});

		const capturedPromises: Promise<unknown>[] = [];
		const waitUntil = (p: Promise<unknown>) => {
			capturedPromises.push(p);
		};

		const source = makeMockSource({
			async list() {
				return [staleItem];
			},
		});

		// preset なし + renderer 明示注入で cache オプションが正しく機能する
		// （preset: "disabled" は cache を undefined に上書きするため使わない）
		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
			waitUntil,
		});

		const result = await cms.posts.getItem("my-post");

		// stale データが即時返される
		expect(result).not.toBeNull();
		expect(result?.updatedAt).toBe("2024-01-01T00:00:00Z");

		// バックグラウンド再検証の Promise が waitUntil に渡されている
		expect(capturedPromises.length).toBeGreaterThan(0);
	});

	it("stale な getItem のバックグラウンド再検証でキャッシュが更新される", async () => {
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

		const cache = new MemoryDocumentCache();
		await cache.setItem("posts:my-post", {
			item: staleItem,
			html: "<p>stale</p>",
			notionUpdatedAt: staleItem.updatedAt,
			cachedAt: 0,
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
			cache: { document: cache, ttlMs: 1000 },
			waitUntil,
		});

		// stale データを即時返す
		await cms.posts.getItem("my-post");

		// バックグラウンド Promise をすべて待つ
		await Promise.all(capturedPromises);

		// キャッシュが新しいアイテムで更新されていることを確認
		const updated = await cache.getItem("posts:my-post");
		expect(updated).not.toBeNull();
		expect(updated?.item.updatedAt).toBe("2024-01-02T00:00:00Z");
	});

	it("stale な getList は即時 stale データを返す", async () => {
		const staleItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		// リストキャッシュに stale データを事前セット（cachedAt: 0 → 必ず stale）
		await cache.setList({
			items: [staleItem],
			cachedAt: 0,
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

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
			waitUntil,
		});

		const result = await cms.posts.getList();

		// stale リスト（1件）が即時返される
		expect(result).toHaveLength(1);
		expect(result[0].updatedAt).toBe("2024-01-01T00:00:00Z");

		// バックグラウンド再検証の Promise が waitUntil に渡されている
		expect(capturedPromises.length).toBeGreaterThan(0);
	});

	it("fresh なキャッシュはバックグラウンド再検証をしない", async () => {
		const freshItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		// cachedAt: Date.now()、ttlMs: 60_000 → fresh
		await cache.setItem("posts:my-post", {
			item: freshItem,
			html: "<p>fresh</p>",
			notionUpdatedAt: freshItem.updatedAt,
			cachedAt: Date.now(),
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
			cache: { document: cache, ttlMs: 60_000 },
			waitUntil,
		});

		await cms.posts.getItem("my-post");

		// fresh なので waitUntil は呼ばれない（バックグラウンド再検証なし）
		expect(waitUntil).not.toHaveBeenCalled();
	});
});
