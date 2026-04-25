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
