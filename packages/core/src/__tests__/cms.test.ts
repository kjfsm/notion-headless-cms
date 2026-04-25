import { describe, expect, it, vi } from "vitest";
import { createCMS } from "../cms";
import { isCMSError } from "../errors";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

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
			collections: {
				posts: { slug: "slug" },
			},
		});

		await cms.posts.getItem("hello");

		// findByProp が Notion プロパティ名 "Slug" と値 "hello" で呼ばれることを確認
		expect(findByPropMock).toHaveBeenCalledWith("Slug", "hello");
	});
});
