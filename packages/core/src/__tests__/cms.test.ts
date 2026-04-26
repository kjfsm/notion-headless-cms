import { describe, expect, it, vi } from "vitest";
import { createCMS } from "../cms";
import { isCMSError } from "../errors";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

// buildCachedItem が renderer を動的 import するため、明示的に注入する用のモック
// （preset: "disabled" では renderer が未解決になり getItem が失敗するため）
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
		async loadMarkdown() {
			return "";
		},
		getLastModified(item) {
			return item.updatedAt;
		},
		getListVersion() {
			return "";
		},
		...overrides,
	};
}

describe("createCMS - dataSources バリデーション", () => {
	it("dataSources が空の場合は CMSError をスローする", () => {
		let caught: unknown;
		try {
			createCMS({
				// biome-ignore lint/suspicious/noExplicitAny: テスト用に空オブジェクトを渡す
				dataSources: {} as any,
				preset: "disabled",
			});
		} catch (e) {
			caught = e;
		}
		expect(caught).toSatisfy(
			(err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
		);
	});

	it("dataSources が undefined の場合は CMSError をスローする", () => {
		let caught: unknown;
		try {
			createCMS({
				// biome-ignore lint/suspicious/noExplicitAny: テスト用に undefined を渡す
				dataSources: undefined as any,
				preset: "disabled",
			});
		} catch (e) {
			caught = e;
		}
		expect(caught).toSatisfy(
			(err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
		);
	});
});

describe("createCMS - Feature 1: collections.slug 検証", () => {
	it("collections を指定しない場合はバリデーションをスキップする", () => {
		expect(() =>
			createCMS({
				dataSources: { posts: makeMockSource() },
				preset: "disabled",
			}),
		).not.toThrow();
	});

	it("collections.slug を指定した場合は正常に動作する", () => {
		expect(() =>
			createCMS({
				dataSources: { posts: makeMockSource() },
				preset: "disabled",
				collections: {
					posts: { slug: "slug" },
				},
			}),
		).not.toThrow();
	});

	it("collections に slug を指定しない場合は CMSError をスローする", () => {
		let caught: unknown;
		try {
			createCMS({
				dataSources: { posts: makeMockSource() },
				preset: "disabled",
				collections: {
					// biome-ignore lint/suspicious/noExplicitAny: テスト用に意図的に slug を省略
					posts: {} as any,
				},
			});
		} catch (e) {
			caught = e;
		}
		expect(caught).toSatisfy(
			(err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
		);
	});
});

describe("createCMS - Feature 2: collections.publishedStatuses オーバーライド", () => {
	it("collections.publishedStatuses が DataSource の設定を上書きする", async () => {
		const publishedItems: BaseContentItem[] = [
			{
				id: "1",
				slug: "published-post",
				updatedAt: "2024-01-01T00:00:00Z",
				status: "公開済み",
			},
			{
				id: "2",
				slug: "draft-post",
				updatedAt: "2024-01-02T00:00:00Z",
				status: "下書き",
			},
		];

		const listMock = vi
			.fn()
			.mockImplementation(
				async (opts?: { publishedStatuses?: readonly string[] }) => {
					if (opts?.publishedStatuses?.length) {
						return publishedItems.filter(
							(i) => i.status && opts.publishedStatuses?.includes(i.status),
						);
					}
					return publishedItems;
				},
			);

		const source = makeMockSource({ list: listMock });

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			collections: {
				posts: {
					slug: "slug",
					status: "status",
					publishedStatuses: ["公開済み"],
				},
			},
		});

		const items = await cms.posts.getList();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("published-post");
		expect(listMock).toHaveBeenCalledWith(
			expect.objectContaining({ publishedStatuses: ["公開済み"] }),
		);
	});

	it("collections を指定しない場合は publishedStatuses なし（全アイテム返す）", async () => {
		const listMock = vi.fn().mockResolvedValue([]);

		const source = makeMockSource({ list: listMock });

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
		});

		await cms.posts.getList();
		// publishedStatuses なしで list() が呼ばれる
		expect(listMock).toHaveBeenCalledWith(
			expect.objectContaining({ publishedStatuses: undefined }),
		);
	});

	it("collections.accessibleStatuses でアクセス制御できる", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
			status: "限定公開",
		};

		const source = makeMockSource({
			async list() {
				return [item];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: {
					slug: "slug",
					accessibleStatuses: ["Published", "限定公開"],
				},
			},
		});

		// 限定公開は accessibleStatuses に含まれるのでアクセスできる
		const result = await cms.posts.getItem("my-post");
		expect(result).not.toBeNull();
		expect(result?.slug).toBe("my-post");
	});
});

describe("createCMS - findByProp の利用", () => {
	it("slugField が指定され findByProp が実装されている場合は findByProp を使う", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "hello",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const findByPropMock = vi.fn().mockResolvedValue(item);

		const source = makeMockSource({
			findByProp: findByPropMock,
			properties: {
				slug: { type: "richText", notion: "Slug" },
				status: { type: "select", notion: "Status" },
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: { slug: "slug" },
			},
		});

		await cms.posts.getItem("hello");

		// findByProp が Notion プロパティ名 "Slug" と値 "hello" で呼ばれることを確認
		expect(findByPropMock).toHaveBeenCalledWith("Slug", "hello");
	});

	it("slugField が設定されていても findByProp 未実装の場合は list() フォールバックを使う", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "hello",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const listMock = vi.fn().mockResolvedValue([item]);

		// findByProp を持たないが properties は定義されている DataSource
		const source = makeMockSource({
			list: listMock,
			properties: {
				slug: { type: "richText", notion: "Slug" },
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: { slug: "slug" },
			},
		});

		const result = await cms.posts.getItem("hello");

		// findByProp がないので list() で全件取得して線形探索する
		expect(listMock).toHaveBeenCalled();
		expect(result?.slug).toBe("hello");
	});
});

describe("createCMS - scopeDocumentCache リストスコープ分離", () => {
	it("posts と pages のリストキャッシュは互いに独立している", async () => {
		const postItem: BaseContentItem = {
			id: "p1",
			slug: "post-one",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const pageItem: BaseContentItem = {
			id: "pg1",
			slug: "page-one",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const postListMock = vi.fn().mockResolvedValue([postItem]);
		const pageListMock = vi.fn().mockResolvedValue([pageItem]);

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({ list: postListMock }),
				pages: makeMockSource({ list: pageListMock }),
			},
			preset: "disabled",
		});

		const posts = await cms.posts.getList();
		const pages = await cms.pages.getList();

		// 2 回目はキャッシュから返る（list は 1 度しか呼ばれない）
		const postsCached = await cms.posts.getList();
		const pagesCached = await cms.pages.getList();

		expect(posts).toHaveLength(1);
		expect(posts[0].slug).toBe("post-one");
		expect(pages).toHaveLength(1);
		expect(pages[0].slug).toBe("page-one");
		// キャッシュがスコープ別に独立しているので posts のリストが pages で上書きされない
		expect(postsCached[0].slug).toBe("post-one");
		expect(pagesCached[0].slug).toBe("page-one");
	});
});

describe("createCMS - $revalidate", () => {
	it("$revalidate 後に getList がキャッシュではなく新データを返す", async () => {
		const staleItem: BaseContentItem = {
			id: "1",
			slug: "post-stale",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const freshItem: BaseContentItem = {
			id: "2",
			slug: "post-fresh",
			updatedAt: "2024-01-02T00:00:00Z",
		};

		const listMock = vi
			.fn()
			.mockResolvedValueOnce([staleItem])
			.mockResolvedValueOnce([freshItem]);

		const cms = createCMS({
			dataSources: { posts: makeMockSource({ list: listMock }) },
			preset: "disabled",
		});

		const first = await cms.posts.getList();
		expect(first[0].slug).toBe("post-stale");

		await cms.$revalidate();

		const second = await cms.posts.getList();
		// $revalidate 後はキャッシュがクリアされ、新しいデータが返される
		expect(second[0].slug).toBe("post-fresh");
		expect(listMock).toHaveBeenCalledTimes(2);
	});
});

describe("createCMS - logLevel オプション", () => {
	it("logLevel: 'info' を設定すると debug ログが抑制される", async () => {
		const debugFn = vi.fn();
		const infoFn = vi.fn();

		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const source = makeMockSource({
			async list() {
				return [item];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			renderer: mockRenderer,
			logger: { debug: debugFn, info: infoFn },
			logLevel: "info",
		});

		// getItem でキャッシュミスの debug ログが出るはずだが抑制される
		await cms.posts.getItem("my-post");

		expect(debugFn).not.toHaveBeenCalled();
	});

	it("logLevel 未設定では debug ログが通常通り流れる", async () => {
		const debugFn = vi.fn();

		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const source = makeMockSource({
			async list() {
				return [item];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			renderer: mockRenderer,
			logger: { debug: debugFn },
		});

		await cms.posts.getItem("my-post");

		expect(debugFn).toHaveBeenCalled();
	});

	it("logger 未設定かつ logLevel を指定しても問題なく動作する", () => {
		expect(() =>
			createCMS({
				dataSources: { posts: makeMockSource() },
				preset: "disabled",
				logLevel: "warn",
			}),
		).not.toThrow();
	});
});

describe("createCMS - collections.hooks コレクション固有フック", () => {
	it("collections.hooks.onCacheHit がコレクション固有フックとして呼ばれる", async () => {
		const globalHook = vi.fn();
		const collectionHook = vi.fn();

		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const { MemoryDocumentCache } = await import("../cache/memory");
		const cache = new MemoryDocumentCache();
		await cache.setItem("posts:my-post", {
			item,
			html: "<p>test</p>",
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
			hooks: { onCacheHit: globalHook },
			collections: {
				posts: {
					slug: "slug",
					hooks: { onCacheHit: collectionHook },
				},
			},
		});

		await cms.posts.getItem("my-post");

		// グローバルフックとコレクション固有フックの両方が呼ばれる
		expect(globalHook).toHaveBeenCalledOnce();
		expect(collectionHook).toHaveBeenCalledOnce();
	});

	it("collections.hooks がないコレクションはグローバルフックのみ実行される", async () => {
		const globalHook = vi.fn();

		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const { MemoryDocumentCache } = await import("../cache/memory");
		const cache = new MemoryDocumentCache();
		await cache.setItem("posts:my-post", {
			item,
			html: "<p>test</p>",
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
			hooks: { onCacheHit: globalHook },
		});

		await cms.posts.getItem("my-post");

		expect(globalHook).toHaveBeenCalledOnce();
	});
});

describe("createCMS - beforeCache フック", () => {
	it("getItem でレンダリング後に beforeCache フックが呼ばれる", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "test-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};

		const beforeCacheMock = vi.fn().mockImplementation((cached) => cached);

		const source = makeMockSource({
			async list() {
				return [item];
			},
		});

		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: { slug: "slug" },
			},
			hooks: { beforeCache: beforeCacheMock },
		});

		await cms.posts.getItem("test-post");

		expect(beforeCacheMock).toHaveBeenCalledOnce();
	});
});

describe("createCMS - $getCachedImage", () => {
	it("$getCachedImage が imageCache.get を呼ぶ", async () => {
		const getCachedImage = vi.fn().mockResolvedValue(null);
		// preset: "disabled" は cache を undefined に上書きするため、preset を指定しない
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			cache: {
				image: {
					name: "test-image-cache",
					get: getCachedImage,
					set: vi.fn(),
				},
			},
		});
		const result = await cms.$getCachedImage("test-hash");
		expect(getCachedImage).toHaveBeenCalledWith("test-hash");
		expect(result).toBeNull();
	});
});

describe("createCMS - $revalidate", () => {
	it("$revalidate を呼んでもエラーが発生しない（noopCache の場合）", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		await expect(cms.$revalidate()).resolves.toBeUndefined();
	});

	it("$collections にコレクション名が含まれる", () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource(),
				pages: makeMockSource(),
			},
			preset: "disabled",
		});
		expect(cms.$collections).toContain("posts");
		expect(cms.$collections).toContain("pages");
	});

	it("invalidate を持たない DocumentCacheAdapter でも $revalidate が成功する", async () => {
		const cache = {
			name: "no-invalidate",
			getList: vi.fn().mockResolvedValue(null),
			setList: vi.fn().mockResolvedValue(undefined),
			getItem: vi.fn().mockResolvedValue(null),
			setItem: vi.fn().mockResolvedValue(undefined),
			// invalidate は意図的に未定義
		};
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			cache: { document: cache },
		});
		await expect(cms.$revalidate()).resolves.toBeUndefined();
	});
});

describe("createCMS - $handler", () => {
	it("$handler() がハンドラ関数を返す", () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		const handler = cms.$handler();
		expect(typeof handler).toBe("function");
	});

	it("slug と collection を含む JSON body で $revalidate が呼ばれる", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		const handler = cms.$handler();
		const req = new Request("http://localhost/api/cms/revalidate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ slug: "my-post", collection: "posts" }),
		});
		const res = await handler(req);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean };
		expect(body.ok).toBe(true);
	});

	it("collection のみの JSON body で $revalidate が呼ばれる", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		const handler = cms.$handler();
		const req = new Request("http://localhost/api/cms/revalidate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ collection: "posts" }),
		});
		const res = await handler(req);
		expect(res.status).toBe(200);
	});

	it("不正な JSON body の場合は 400 を返す", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		const handler = cms.$handler();
		const req = new Request("http://localhost/api/cms/revalidate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "not-json",
		});
		const res = await handler(req);
		expect(res.status).toBe(400);
	});

	it("DataSource に parseWebhook がある場合はそちらを優先する", async () => {
		const parseWebhook = vi.fn().mockResolvedValue({ collection: "posts" });
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({ parseWebhook }),
			},
			preset: "disabled",
		});
		const handler = cms.$handler();
		const req = new Request("http://localhost/api/cms/revalidate", {
			method: "POST",
			body: "{}",
		});
		await handler(req);
		expect(parseWebhook).toHaveBeenCalled();
	});

	it("DataSource の parseWebhook が失敗した場合は JSON フォールバックを使う", async () => {
		const parseWebhook = vi.fn().mockRejectedValue(new Error("webhook error"));
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({ parseWebhook }),
			},
			preset: "disabled",
		});
		const handler = cms.$handler();
		const req = new Request("http://localhost/api/cms/revalidate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ slug: "test", collection: "posts" }),
		});
		const res = await handler(req);
		// パースウェブフック失敗後にJSONフォールバックが動く
		expect(res.status).toBe(200);
	});

	it("slug も collection もない JSON body では 400 を返す", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		const handler = cms.$handler();
		const req = new Request("http://localhost/api/cms/revalidate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ other: "data" }),
		});
		const res = await handler(req);
		expect(res.status).toBe(400);
	});
});
