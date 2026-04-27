import { describe, expect, it, vi } from "vitest";
import { MemoryDocumentCache } from "../cache/memory";
import { createCMS } from "../cms";
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
		await cache.setItemMeta("posts:my-post", {
			item: staleItem,
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
		await cache.setItemMeta("posts:my-post", {
			item: cachedItem,
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
		const updated = await cache.getItemMeta("posts:my-post");
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

		const { items } = await cms.posts.getList();

		// キャッシュが即時返される
		expect(items).toHaveLength(1);
		expect(items[0].updatedAt).toBe("2024-01-01T00:00:00Z");

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

		const { items } = await cms.posts.getList();

		// TTL 期限切れ → ブロッキングで最新リストが返される
		expect(items).toHaveLength(2);

		// ブロッキングフェッチなのでバックグラウンド Promise は渡されない
		expect(waitUntil).not.toHaveBeenCalled();
	});

	it("キャッシュミス時に logger.debug が呼ばれる", async () => {
		const debugFn = vi.fn();
		const source = makeMockSource({
			async list() {
				return [
					{ id: "p1", slug: "post-1", updatedAt: "2024-01-01T00:00:00Z" },
				];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: new MemoryDocumentCache() },
			logger: { debug: debugFn },
		});

		await cms.posts.getItem("post-1");

		expect(debugFn).toHaveBeenCalledWith(
			"キャッシュミス、フェッチ",
			expect.objectContaining({
				operation: "getItem",
				slug: "post-1",
				collection: "posts",
			}),
		);
	});

	it("キャッシュヒット時に logger.debug が呼ばれる", async () => {
		const debugFn = vi.fn();
		const item: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item,
			notionUpdatedAt: item.updatedAt,
			cachedAt: Date.now(),
		});

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			logger: { debug: debugFn },
		});

		await cms.posts.getItem("post-1");

		expect(debugFn).toHaveBeenCalledWith(
			"キャッシュヒット",
			expect.objectContaining({
				operation: "getItem",
				slug: "post-1",
				collection: "posts",
			}),
		);
	});

	it("TTL 期限切れ時に logger.debug が呼ばれる", async () => {
		const debugFn = vi.fn();
		const item: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item,
			notionUpdatedAt: item.updatedAt,
			cachedAt: 0, // 必ず TTL 期限切れ
		});

		const source = makeMockSource({
			async list() {
				return [item];
			},
		});
		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
			logger: { debug: debugFn },
		});

		await cms.posts.getItem("post-1");

		expect(debugFn).toHaveBeenCalledWith(
			"キャッシュ期限切れ（TTL）、フェッチ",
			expect.objectContaining({
				operation: "getItem",
				slug: "post-1",
				collection: "posts",
			}),
		);
	});

	it("SWR が差分を検出したとき logger.debug と onCacheRevalidated が呼ばれる", async () => {
		const debugFn = vi.fn();
		const onCacheRevalidated = vi.fn();

		const cachedItem: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item: cachedItem,
			notionUpdatedAt: cachedItem.updatedAt,
			cachedAt: Date.now(),
		});

		const capturedPromises: Promise<unknown>[] = [];
		const source = makeMockSource({
			async list() {
				return [freshItem];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache },
			logger: { debug: debugFn },
			hooks: { onCacheRevalidated },
			waitUntil: (p) => capturedPromises.push(p),
		});

		await cms.posts.getItem("post-1");
		await Promise.all(capturedPromises);

		expect(debugFn).toHaveBeenCalledWith(
			"SWR: 差分を検出、メタを差し替え",
			expect.objectContaining({
				operation: "getItem:bg",
				slug: "post-1",
				collection: "posts",
			}),
		);
		expect(onCacheRevalidated).toHaveBeenCalledOnce();
		expect(onCacheRevalidated).toHaveBeenCalledWith(
			"post-1",
			expect.any(Object),
		);
	});

	it("SWR が差分なしのとき logger.debug が呼ばれ onCacheRevalidated は呼ばれない", async () => {
		const debugFn = vi.fn();
		const onCacheRevalidated = vi.fn();

		const item: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item,
			notionUpdatedAt: item.updatedAt,
			cachedAt: Date.now(),
		});

		const capturedPromises: Promise<unknown>[] = [];
		const source = makeMockSource({
			async list() {
				return [item];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 60_000 },
			logger: { debug: debugFn },
			hooks: { onCacheRevalidated },
			waitUntil: (p) => capturedPromises.push(p),
		});

		await cms.posts.getItem("post-1");
		await Promise.all(capturedPromises);

		expect(debugFn).toHaveBeenCalledWith(
			"SWR: 差分なし、TTL をリセット",
			expect.objectContaining({ operation: "getItem:bg", slug: "post-1" }),
		);
		expect(onCacheRevalidated).not.toHaveBeenCalled();
	});

	it("SWR がリスト差分を検出したとき onListCacheRevalidated が呼ばれる", async () => {
		const onListCacheRevalidated = vi.fn();

		const oldItem: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const newItem: BaseContentItem = {
			id: "p2",
			slug: "post-2",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		await cache.setList({ items: [oldItem], cachedAt: Date.now() });

		const capturedPromises: Promise<unknown>[] = [];
		const source = makeMockSource({
			async list() {
				return [oldItem, newItem];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache },
			hooks: { onListCacheRevalidated },
			waitUntil: (p) => capturedPromises.push(p),
		});

		await cms.posts.getList();
		await Promise.all(capturedPromises);

		expect(onListCacheRevalidated).toHaveBeenCalledOnce();
		expect(onListCacheRevalidated).toHaveBeenCalledWith(
			expect.objectContaining({
				items: expect.arrayContaining([oldItem, newItem]),
				cachedAt: expect.any(Number),
			}),
		);
	});

	it("TTL 設定あり・期限内の getItem はキャッシュを即時返却してバックグラウンド差分チェックする", async () => {
		const freshItem: BaseContentItem = {
			id: "page-1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		// cachedAt: Date.now()、ttlMs: 60_000 → 期限内
		await cache.setItemMeta("posts:my-post", {
			item: freshItem,
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

	it("リスト SWR が差分なし + TTL あり のとき cachedAt をリセットする", async () => {
		const item: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const cache = new MemoryDocumentCache();
		await cache.setList({ items: [item], cachedAt: Date.now() });

		const capturedPromises: Promise<unknown>[] = [];
		const source = makeMockSource({
			async list() {
				return [item];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			// ttlMs を設定するとリスト差分なし時に cachedAt がリセットされる
			cache: { document: cache, ttlMs: 60_000 },
			waitUntil: (p) => capturedPromises.push(p),
		});

		await cms.posts.getList();
		await Promise.all(capturedPromises);
		// エラーなく完了することを確認
		expect(capturedPromises.length).toBeGreaterThan(0);
	});
});

describe("metadata と content の分離", () => {
	it("getItem は content を読まない（content アクセス時に初めて読む）", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "lazy-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const loadMarkdown = vi.fn().mockResolvedValue("# hi");
		const cache = new MemoryDocumentCache();
		const getItemContentSpy = vi.spyOn(cache, "getItemContent");

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
					loadMarkdown,
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
		});

		const result = await cms.posts.getItem("lazy-post");
		expect(getItemContentSpy).not.toHaveBeenCalled();
		expect(loadMarkdown).not.toHaveBeenCalled();

		await result?.content.html();
		expect(getItemContentSpy).toHaveBeenCalledWith("posts:lazy-post");
		expect(loadMarkdown).toHaveBeenCalled();
	});

	it("checkForUpdate 差分なし: content cache を破棄しない", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "stable-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemContent("posts:stable-post", {
			html: "<p>existing</p>",
			markdown: "# existing",
			blocks: [],
			notionUpdatedAt: item.updatedAt,
			cachedAt: Date.now(),
		});

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
		});

		const result = await cms.posts.checkForUpdate({
			slug: "stable-post",
			since: item.updatedAt,
		});
		expect(result.changed).toBe(false);
		const content = await cache.getItemContent("posts:stable-post");
		expect(content?.html).toBe("<p>existing</p>");
	});

	it("checkForUpdate 差分あり: content cache を失効 + waitUntil で再生成", async () => {
		const oldItem: BaseContentItem = {
			id: "1",
			slug: "updated-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "1",
			slug: "updated-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemContent("posts:updated-post", {
			html: "<p>old</p>",
			markdown: "old",
			blocks: [],
			notionUpdatedAt: oldItem.updatedAt,
			cachedAt: Date.now(),
		});

		const captured: Promise<unknown>[] = [];
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [freshItem];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			waitUntil: (p) => captured.push(p),
		});

		const result = await cms.posts.checkForUpdate({
			slug: "updated-post",
			since: oldItem.updatedAt,
		});
		expect(result.changed).toBe(true);
		if (result.changed) {
			expect(result.meta.updatedAt).toBe(freshItem.updatedAt);
		}

		await Promise.all(captured);
		const content = await cache.getItemContent("posts:updated-post");
		expect(content?.notionUpdatedAt).toBe(freshItem.updatedAt);
	});

	it("getItemMeta / getItemContent / checkForUpdate の戻り値が JSON ラウンドトリップ可能", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "json-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
					loadMarkdown: vi.fn().mockResolvedValue("# hello"),
				}),
			},
			renderer: mockRenderer,
			preset: "disabled",
		});

		const meta = await cms.posts.getItemMeta("json-post");
		expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);

		const content = await cms.posts.getItemContent("json-post");
		expect(content).not.toBeNull();
		expect(JSON.parse(JSON.stringify(content))).toEqual(content);

		const checkResult = await cms.posts.checkForUpdate({
			slug: "json-post",
			since: "2023-01-01T00:00:00Z",
		});
		expect(JSON.parse(JSON.stringify(checkResult))).toEqual(checkResult);
	});
});

describe("getItemMeta（CollectionClient）", () => {
	it("キャッシュヒット時に SWR バックグラウンドチェックを起動する", async () => {
		const cachedItem: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item: cachedItem,
			notionUpdatedAt: cachedItem.updatedAt,
			cachedAt: Date.now(),
		});

		const captured: Promise<unknown>[] = [];
		const onCacheHit = vi.fn();
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [cachedItem];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			hooks: { onCacheHit },
			waitUntil: (p) => captured.push(p),
		});

		const meta = await cms.posts.getItemMeta("post-1");
		expect(meta?.slug).toBe("post-1");
		expect(onCacheHit).toHaveBeenCalled();
		expect(captured.length).toBeGreaterThan(0);
	});

	it("TTL 期限切れではブロッキングで再フェッチする", async () => {
		const stale: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const fresh: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-02T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item: stale,
			notionUpdatedAt: stale.updatedAt,
			cachedAt: 0,
		});

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [fresh];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
		});

		const meta = await cms.posts.getItemMeta("post-1");
		expect(meta?.updatedAt).toBe("2024-01-02T00:00:00Z");
	});

	it("TTL 期限切れで item が見つからない場合は null を返す", async () => {
		const stale: BaseContentItem = {
			id: "p1",
			slug: "missing-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:missing-post", {
			item: stale,
			notionUpdatedAt: stale.updatedAt,
			cachedAt: 0,
		});

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache, ttlMs: 1000 },
		});

		expect(await cms.posts.getItemMeta("missing-post")).toBeNull();
	});
});

describe("collectionKey", () => {
	it("slug 無しでは collection 名のみを返す", async () => {
		const { collectionKey } = await import("../collection");
		expect(collectionKey("posts")).toBe("posts");
	});

	it("slug 付きでは {collection}:{slug} を返す", async () => {
		const { collectionKey } = await import("../collection");
		expect(collectionKey("posts", "my-post")).toBe("posts:my-post");
	});
});

describe("バックグラウンドエラーパス", () => {
	it("リスト初回フェッチ + waitUntil 指定時に保存 Promise をバックグラウンドに乗せる", async () => {
		const item: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		const captured: Promise<unknown>[] = [];

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			waitUntil: (p) => captured.push(p),
		});

		// キャッシュ無し + waitUntil あり → fetchList の waitUntil 分岐を通る
		const { items } = await cms.posts.getList();
		expect(items).toHaveLength(1);
		expect(captured.length).toBeGreaterThan(0);
		await Promise.all(captured);
	});

	it("rebuildContentBg 失敗時に logger.warn が呼ばれる", async () => {
		const warnFn = vi.fn();
		const oldItem: BaseContentItem = {
			id: "1",
			slug: "broken-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "1",
			slug: "broken-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();

		// loadMarkdown が失敗 → buildCachedItemContent が throw → rebuildContentBg の catch
		const failingMarkdown = vi
			.fn()
			.mockRejectedValue(new Error("fetch failed"));
		const captured: Promise<unknown>[] = [];

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [freshItem];
					},
					loadMarkdown: failingMarkdown,
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			logger: { warn: warnFn },
			waitUntil: (p) => captured.push(p),
		});

		const result = await cms.posts.checkForUpdate({
			slug: "broken-post",
			since: oldItem.updatedAt,
		});
		expect(result.changed).toBe(true);
		await Promise.all(captured);

		expect(warnFn).toHaveBeenCalledWith(
			"本文のバックグラウンド再生成に失敗",
			expect.objectContaining({
				slug: "broken-post",
				collection: "posts",
				error: expect.any(String),
			}),
		);
	});

	it("checkAndUpdateItemBg が例外時に logger.warn を呼ぶ", async () => {
		const warnFn = vi.fn();
		const cachedItem: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setItemMeta("posts:post-1", {
			item: cachedItem,
			notionUpdatedAt: cachedItem.updatedAt,
			cachedAt: Date.now(),
		});

		const captured: Promise<unknown>[] = [];
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						throw new Error("upstream down");
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			logger: { warn: warnFn },
			rateLimiter: { maxRetries: 0, baseDelayMs: 0 },
			waitUntil: (p) => captured.push(p),
		});

		await cms.posts.getItem("post-1");
		await Promise.all(captured);

		expect(warnFn).toHaveBeenCalledWith(
			"SWR: アイテムのバックグラウンド差分チェックに失敗",
			expect.objectContaining({
				slug: "post-1",
				collection: "posts",
				error: "upstream down",
			}),
		);
	});

	it("checkAndUpdateListBg が例外時に logger.warn を呼ぶ", async () => {
		const warnFn = vi.fn();
		const cachedItem: BaseContentItem = {
			id: "p1",
			slug: "post-1",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cache = new MemoryDocumentCache();
		await cache.setList({ items: [cachedItem], cachedAt: Date.now() });

		const captured: Promise<unknown>[] = [];
		let listCallCount = 0;
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						listCallCount++;
						// 1回目（同期パスは cache hit で呼ばれない）→ bg で初回 throw
						throw new Error("list failed");
					},
				}),
			},
			renderer: mockRenderer,
			cache: { document: cache },
			logger: { warn: warnFn },
			rateLimiter: { maxRetries: 0, baseDelayMs: 0 },
			waitUntil: (p) => captured.push(p),
		});

		await cms.posts.getList();
		await Promise.all(captured);

		expect(listCallCount).toBeGreaterThan(0);
		expect(warnFn).toHaveBeenCalledWith(
			"SWR: リストのバックグラウンド差分チェックに失敗",
			expect.objectContaining({
				collection: "posts",
				error: "list failed",
			}),
		);
	});
});

describe("リトライ中のロガー", () => {
	it("getList() がリトライ中に logger.warn を呼ぶ", async () => {
		const warnFn = vi.fn();
		const retryableErr = Object.assign(new Error("rate limit"), {
			status: 503,
		});
		let callCount = 0;
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						callCount++;
						if (callCount === 1) throw retryableErr;
						return [];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
			logger: { warn: warnFn },
			rateLimiter: { maxRetries: 1, baseDelayMs: 0, retryOn: [503] },
		});
		await cms.posts.getList();
		expect(warnFn).toHaveBeenCalledWith(
			"getList() リトライ中",
			expect.objectContaining({ attempt: 1, status: 503 }),
		);
	});

	it("getItem() がリトライ中に logger.warn を呼ぶ", async () => {
		const warnFn = vi.fn();
		const retryableErr = Object.assign(new Error("service unavailable"), {
			status: 503,
		});
		const targetItem: BaseContentItem = {
			id: "1",
			slug: "retry-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		let callCount = 0;
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						callCount++;
						if (callCount === 1) throw retryableErr;
						return [targetItem];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
			logger: { warn: warnFn },
			rateLimiter: { maxRetries: 1, baseDelayMs: 0, retryOn: [503] },
		});
		await cms.posts.getItem("retry-post");
		expect(warnFn).toHaveBeenCalledWith(
			"getItem() リトライ中",
			expect.objectContaining({ attempt: 1, status: 503 }),
		);
	});
});
