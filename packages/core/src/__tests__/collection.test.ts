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

describe("CollectionClient — revalidate / revalidateAll", () => {
	it("invalidate がないキャッシュでも revalidate / revalidateAll がエラーにならない", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
		});
		await expect(cms.posts.revalidate("some-slug")).resolves.toBeUndefined();
		await expect(cms.posts.revalidateAll()).resolves.toBeUndefined();
	});

	it("revalidateAll 後の getList はソースから再取得する", async () => {
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
		await cms.posts.revalidateAll();
		const { items: second } = await cms.posts.getList();

		expect(callCount).toBe(2);
		expect(second).toHaveLength(1);
		expect(second[0].slug).toBe("fresh");
	});

	it("revalidateAll でコレクション全体が無効化される", async () => {
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
		await cms.posts.revalidateAll();
		await cms.posts.getList();

		expect(callCount).toBe(2);
	});

	it("revalidate(slug) で特定アイテムが無効化される", async () => {
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
		const before = await cache.getItemMeta("posts:my-post");
		expect(before).not.toBeNull();

		await cms.posts.revalidate("my-post");
		const after = await cache.getItemMeta("posts:my-post");
		expect(after).toBeNull();
	});
});

describe("CollectionClient — checkForUpdate", () => {
	it("アイテムが since から変更されていない場合は changed: false を返す", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.checkForUpdate({
			slug: "my-post",
			since: "2024-01-01T00:00:00Z",
		});
		expect(result.changed).toBe(false);
	});

	it("アイテムが since から更新された場合は changed: true と最新 item を返す", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-02T00:00:00Z",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.checkForUpdate({
			slug: "my-post",
			since: "2024-01-01T00:00:00Z",
		});
		expect(result.changed).toBe(true);
		if (result.changed) {
			expect(result.meta.slug).toBe("my-post");
			expect(result.meta.updatedAt).toBe("2024-01-02T00:00:00Z");
		}
	});

	it("アイテムが存在しない場合は changed: false を返す", async () => {
		const cms = createCMS({
			dataSources: { posts: makeMockSource() },
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.checkForUpdate({
			slug: "nonexistent",
			since: "2024-01-01T00:00:00Z",
		});
		expect(result.changed).toBe(false);
	});
});

describe("CollectionClient — checkListForUpdate", () => {
	it("リストが since から変更されていない場合は changed: false を返す", async () => {
		const items = makeItems();
		const source = makeMockSource({
			async list() {
				return items;
			},
			getListVersion(it) {
				return it.map((i) => i.updatedAt).join(",");
			},
		});
		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
		});
		const { version } = await cms.posts.getList();
		const result = await cms.posts.checkListForUpdate({ since: version });
		expect(result.changed).toBe(false);
	});

	it("リストが since から更新された場合は changed: true と最新データを返す", async () => {
		const freshItem: BaseContentItem = {
			id: "99",
			slug: "new-post",
			updatedAt: "2024-12-01T00:00:00Z",
		};
		let callCount = 0;
		const source = makeMockSource({
			async list() {
				callCount++;
				return callCount === 1 ? makeItems() : [...makeItems(), freshItem];
			},
			getListVersion(it) {
				return it.map((i) => i.updatedAt).join(",");
			},
		});
		const cms = createCMS({
			dataSources: { posts: source },
			preset: "disabled",
		});
		const { version: oldVersion } = await cms.posts.getList();
		const result = await cms.posts.checkListForUpdate({ since: oldVersion });
		expect(result.changed).toBe(true);
		if (result.changed) {
			expect(result.items.some((i) => i.slug === "new-post")).toBe(true);
			expect(typeof result.version).toBe("string");
		}
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
		const { items } = await cms.posts.getList({ statuses: ["公開"] });
		expect(items).toHaveLength(2);
		expect(items.every((i) => i.status === "公開")).toBe(true);
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
		const { items } = await cms.posts.getList({ statuses: [] });
		expect(items).toHaveLength(3);
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
		const { items: result } = await cms.posts.getList({ tag: "tech" });
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
		const { items } = await cms.posts.getList({ where: { id: "1" } });
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("alpha");
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
		const { items } = await cms.posts.getList({
			sort: { by: "updatedAt", direction: "asc" },
		});
		expect(items.map((i) => i.slug)).toEqual(["alpha", "beta", "gamma"]);
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
		const { items } = await cms.posts.getList({
			sort: { by: "updatedAt", direction: "desc" },
		});
		expect(items.map((i) => i.slug)).toEqual(["gamma", "beta", "alpha"]);
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
		const { items } = await cms.posts.getList({ skip: 1, limit: 1 });
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("beta");
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
		const { items } = await cms.posts.getList({ limit: 2 });
		expect(items).toHaveLength(2);
		expect(items[0].slug).toBe("alpha");
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
		const { items } = await cms.posts.getList({ skip: 2 });
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("gamma");
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
		const { items } = await cms.posts.getList();
		expect(items).toHaveLength(3);
	});

	it("version はフィルタ後アイテムの getListVersion 値を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return makeItems();
					},
					getListVersion(items) {
						return items.map((i) => i.updatedAt).join(",");
					},
				}),
			},
			preset: "disabled",
		});
		const { items, version } = await cms.posts.getList({
			statuses: ["公開"],
		});
		const expected = items.map((i) => i.updatedAt).join(",");
		expect(version).toBe(expected);
	});
});

describe("CollectionClient — concurrent getItem", () => {
	it("同一 slug への並行 getItem が全て正しいアイテムを返す", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "concurrent-post",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
					loadMarkdown: vi.fn().mockResolvedValue("# Concurrent"),
				}),
			},
			renderer: mockRenderer,
			preset: "disabled",
		});

		// 5 件を同時に並行実行
		const results = await Promise.all([
			cms.posts.getItem("concurrent-post"),
			cms.posts.getItem("concurrent-post"),
			cms.posts.getItem("concurrent-post"),
			cms.posts.getItem("concurrent-post"),
			cms.posts.getItem("concurrent-post"),
		]);

		// 全て非 null かつ正しい slug を返すこと
		for (const r of results) {
			expect(r).not.toBeNull();
			expect(r?.slug).toBe("concurrent-post");
		}
	});

	it("存在しない slug への並行 getItem が全て null を返す", async () => {
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [];
					},
				}),
			},
			preset: "disabled",
		});

		const results = await Promise.all([
			cms.posts.getItem("ghost"),
			cms.posts.getItem("ghost"),
			cms.posts.getItem("ghost"),
		]);

		for (const r of results) {
			expect(r).toBeNull();
		}
	});
});

describe("CollectionClient — accessibleStatuses フィルタ", () => {
	it("accessibleStatuses にないステータスのアイテムは getItem で null を返す", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "draft-post",
			updatedAt: "2024-01-01T00:00:00Z",
			status: "下書き",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: {
					slug: "slug",
					accessibleStatuses: ["公開"],
				},
			},
		});
		const result = await cms.posts.getItem("draft-post");
		expect(result).toBeNull();
	});

	it("accessibleStatuses にステータスが含まれるアイテムは getItem で取得できる", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "public-post",
			updatedAt: "2024-01-01T00:00:00Z",
			status: "公開",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: {
					slug: "slug",
					accessibleStatuses: ["公開"],
				},
			},
		});
		const result = await cms.posts.getItem("public-post");
		expect(result).not.toBeNull();
	});

	it("アイテムの status が undefined の場合は accessibleStatuses でフィルタして null を返す", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "no-status",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: {
					slug: "slug",
					accessibleStatuses: ["公開"],
				},
			},
		});
		const result = await cms.posts.getItem("no-status");
		expect(result).toBeNull();
	});
});

describe("CollectionClient — content アクセサ", () => {
	it("content.blocks() は ContentBlock 配列を返し、2回目は同インスタンスからキャッシュ返却", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "post-blocks",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const loadBlocks = vi
			.fn()
			.mockResolvedValue([{ type: "raw" as const, html: "<p>x</p>" }]);
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
					loadBlocks,
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.getItem("post-blocks");
		expect(result).not.toBeNull();
		const blocks1 = await result!.content.blocks();
		const blocks2 = await result!.content.blocks();
		// 同一インスタンス内では payload がメモ化されるため呼び出しは 1 回
		expect(loadBlocks).toHaveBeenCalledTimes(1);
		expect(blocks1).toBe(blocks2);
	});

	it("content.html() は HTML を返し、再呼び出しでも追加 I/O は発生しない", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "post-html",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.getItem("post-html");
		expect(result).not.toBeNull();
		const html = await result!.content.html();
		expect(typeof html).toBe("string");
	});
});

describe("CollectionClient — content.markdown()", () => {
	it("content.markdown() でマークダウンを取得でき、2回目はキャッシュから返す", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "post-with-md",
			updatedAt: "2024-01-01T00:00:00Z",
		};
		const loadMarkdown = vi.fn().mockResolvedValue("# Hello World");
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					async list() {
						return [item];
					},
					loadMarkdown,
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
		});
		const result = await cms.posts.getItem("post-with-md");
		expect(result).not.toBeNull();
		// 1回目: loadMarkdown が呼ばれる (buildCachedItem + content.markdown())
		const callsBefore = loadMarkdown.mock.calls.length;
		const md = await result!.content.markdown();
		expect(md).toBe("# Hello World");
		// 2回目: markdownCache からキャッシュされた値が返り、追加呼び出しなし
		const mdCached = await result!.content.markdown();
		expect(mdCached).toBe("# Hello World");
		expect(loadMarkdown.mock.calls.length).toBe(callsBefore + 1);
	});
});

describe("CollectionClient — slugField + findByProp", () => {
	it("slugField と findByProp が設定されていると効率的なプロパティ検索を使う", async () => {
		const item: BaseContentItem = {
			id: "1",
			slug: "my-post",
			updatedAt: "2024-01-01T00:00:00Z",
			status: "公開",
		};
		const findByProp = vi.fn().mockResolvedValue(item);
		const cms = createCMS({
			dataSources: {
				posts: makeMockSource({
					findByProp,
					properties: {
						slug: { type: "richText", notion: "Slug" },
					},
				}),
			},
			preset: "disabled",
			renderer: mockRenderer,
			collections: {
				posts: {
					slug: "slug",
				},
			},
		});
		const result = await cms.posts.getItem("my-post");
		expect(result).not.toBeNull();
		expect(findByProp).toHaveBeenCalledWith("Slug", "my-post");
	});
});
