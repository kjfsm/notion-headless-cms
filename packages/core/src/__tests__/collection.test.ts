import { describe, expect, it, vi } from "vitest";
import { MemoryDocumentCache } from "../cache/memory";
import { createCMS } from "../cms";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

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

function makeItems(): BaseContentItem[] {
	return [
		{
			id: "1",
			slug: "alpha",
			updatedAt: "2024-01-01T00:00:00Z",
			status: "公開",
		},
		{
			id: "2",
			slug: "beta",
			updatedAt: "2024-01-02T00:00:00Z",
			status: "下書き",
		},
		{
			id: "3",
			slug: "gamma",
			updatedAt: "2024-01-03T00:00:00Z",
			status: "公開",
		},
	];
}

describe("CollectionClient — getStaticParams / getStaticPaths", () => {
	it("getStaticParams は { slug } オブジェクトの配列を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const params = await cms.posts.getStaticParams();
		expect(params).toEqual([
			{ slug: "alpha" },
			{ slug: "beta" },
			{ slug: "gamma" },
		]);
	});

	it("getStaticPaths は slug 文字列の配列を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const paths = await cms.posts.getStaticPaths();
		expect(paths).toEqual(["alpha", "beta", "gamma"]);
	});

	it("アイテムがない場合は空配列を返す", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		expect(await cms.posts.getStaticParams()).toEqual([]);
		expect(await cms.posts.getStaticPaths()).toEqual([]);
	});
});

describe("CollectionClient — adjacent", () => {
	it("中間要素の前後両方を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const adj = await cms.posts.adjacent("beta");
		expect(adj.prev?.slug).toBe("alpha");
		expect(adj.next?.slug).toBe("gamma");
	});

	it("先頭要素の prev は null", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const adj = await cms.posts.adjacent("alpha");
		expect(adj.prev).toBeNull();
		expect(adj.next?.slug).toBe("beta");
	});

	it("末尾要素の next は null", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const adj = await cms.posts.adjacent("gamma");
		expect(adj.prev?.slug).toBe("beta");
		expect(adj.next).toBeNull();
	});

	it("存在しない slug の場合は { prev: null, next: null } を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const adj = await cms.posts.adjacent("nonexistent");
		expect(adj.prev).toBeNull();
		expect(adj.next).toBeNull();
	});

	it("sort オプションで並び順を変えた結果で adjacent が返る", async () => {
		const items: BaseContentItem[] = [
			{ id: "1", slug: "a", updatedAt: "2024-01-03T00:00:00Z" },
			{ id: "2", slug: "b", updatedAt: "2024-01-01T00:00:00Z" },
			{ id: "3", slug: "c", updatedAt: "2024-01-02T00:00:00Z" },
		];
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return items;
					},
				}),
			},
			preset: "disabled",
		});
		// updatedAt 昇順: b → c → a
		const adj = await cms.posts.adjacent("c", {
			sort: { by: "updatedAt", direction: "asc" },
		});
		expect(adj.prev?.slug).toBe("b");
		expect(adj.next?.slug).toBe("a");
	});
});

describe("CollectionClient — revalidate", () => {
	it("invalidate がないキャッシュでもエラーにならない", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		await expect(cms.posts.revalidate()).resolves.toBeUndefined();
	});

	it("revalidate 後の getList はソースから再取得する", async () => {
		const freshItem: BaseContentItem = {
			id: "2",
			slug: "fresh",
			updatedAt: "2024-02-01T00:00:00Z",
		};
		let callCount = 0;
		const source = makeMockSource({
			async list() {
				callCount++;
				return callCount === 1 ? makeItems() : [freshItem];
			},
		});
		const cache = new MemoryDocumentCache();
		const cms = createCMS({
			dataSources: { posts: source },
			cache: { document: cache },
		});

		await cms.posts.getList();
		await cms.posts.revalidate();
		const second = await cms.posts.getList();

		expect(callCount).toBe(2);
		expect(second).toHaveLength(1);
		expect(second[0].slug).toBe("fresh");
	});

	it("revalidate('all') でコレクション全体が無効化される", async () => {
		let callCount = 0;
		const source = makeMockSource({
			async list() {
				callCount++;
				return makeItems();
			},
		});
		const cache = new MemoryDocumentCache();
		const cms = createCMS({
			dataSources: { posts: source },
			cache: { document: cache },
		});

		await cms.posts.getList();
		await cms.posts.revalidate("all");
		await cms.posts.getList();

		expect(callCount).toBe(2);
	});

	it("revalidate({ slug }) で特定アイテムが無効化される", async () => {
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
		const cache = new MemoryDocumentCache();
		const cms = createCMS({
			dataSources: { posts: source },
			renderer: mockRenderer,
			cache: { document: cache },
			collections: { posts: { slug: "slug" } },
		});

		await cms.posts.getItem("my-post");
		const before = await cache.getItem("posts:my-post");
		expect(before).not.toBeNull();

		await cms.posts.revalidate({ slug: "my-post" });
		const after = await cache.getItem("posts:my-post");
		expect(after).toBeNull();
	});
});

describe("CollectionClient — prefetch", () => {
	it("全アイテムをレンダリングしてキャッシュに保存する", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.prefetch();
		expect(result.ok).toBe(3);
		expect(result.failed).toBe(0);
	});

	it("レンダリングが一部失敗しても failed カウントが返る", async () => {
		const items = makeItems();
		const loadMarkdownMock = vi
			.fn()
			.mockResolvedValueOnce("")
			.mockRejectedValueOnce(new Error("fail"))
			.mockResolvedValueOnce("");

		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return items;
					},
					loadMarkdown: loadMarkdownMock,
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.prefetch();
		expect(result.ok).toBe(2);
		expect(result.failed).toBe(1);
	});

	it("onProgress コールバックが呼ばれる", async () => {
		const onProgress = vi.fn();
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		await cms.posts.prefetch({ concurrency: 1, onProgress });
		expect(onProgress).toHaveBeenCalled();
		// 最後の呼び出しは (total, total) になる
		const lastCall = onProgress.mock.calls.at(-1);
		expect(lastCall?.[0]).toBe(lastCall?.[1]);
	});

	it("アイテムがない場合は { ok: 0, failed: 0 } を返す", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.prefetch();
		expect(result).toEqual({ ok: 0, failed: 0 });
	});
});

describe("CollectionClient — getList フィルタ・ソート・ページング", () => {
	it("statuses フィルタで指定ステータスのみ返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ statuses: ["公開"] });
		expect(result).toHaveLength(2);
		expect(result.every((i) => i.status === "公開")).toBe(true);
	});

	it("statuses が空の場合はフィルタしない", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ statuses: [] });
		expect(result).toHaveLength(3);
	});

	it("tag フィルタで指定タグを持つアイテムのみ返す", async () => {
		type TaggedItem = BaseContentItem & { tags: string[] };
		const items: TaggedItem[] = [
			{ id: "1", slug: "a", updatedAt: "2024-01-01T00:00:00Z", tags: ["tech"] },
			{ id: "2", slug: "b", updatedAt: "2024-01-02T00:00:00Z", tags: ["life"] },
			{
				id: "3",
				slug: "c",
				updatedAt: "2024-01-03T00:00:00Z",
				tags: ["tech", "life"],
			},
		];
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return items;
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ tag: "tech" });
		expect(result).toHaveLength(2);
		expect(result.map((i) => i.slug)).toEqual(["a", "c"]);
	});

	it("where フィルタで id が一致するアイテムのみ返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ where: { id: "1" } });
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("alpha");
	});

	it("sort: asc で updatedAt 昇順になる", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({
			sort: { by: "updatedAt", direction: "asc" },
		});
		expect(result.map((i) => i.slug)).toEqual(["alpha", "beta", "gamma"]);
	});

	it("sort: desc で updatedAt 降順になる", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({
			sort: { by: "updatedAt", direction: "desc" },
		});
		expect(result.map((i) => i.slug)).toEqual(["gamma", "beta", "alpha"]);
	});

	it("skip と limit でページングできる", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ skip: 1, limit: 1 });
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("beta");
	});

	it("limit のみ指定すると先頭から N 件を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ limit: 2 });
		expect(result).toHaveLength(2);
		expect(result[0].slug).toBe("alpha");
	});

	it("skip のみ指定すると N 件スキップして残りを返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList({ skip: 2 });
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("gamma");
	});

	it("オプションなしで全件返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
				}),
			},
			preset: "disabled",
		});
		const result = await cms.posts.getList();
		expect(result).toHaveLength(3);
	});
});
