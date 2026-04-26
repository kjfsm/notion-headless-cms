import { describe, expect, it, vi } from "vitest";
import { isCMSError } from "../errors";
import type { RenderContext } from "../rendering";
import { buildCachedItemContent, buildCachedItemMeta } from "../rendering";
import type { BaseContentItem } from "../types/index";

function makeItem(overrides: Partial<BaseContentItem> = {}): BaseContentItem {
	return {
		id: "page-1",
		slug: "test-post",
		updatedAt: "2024-01-01T00:00:00Z",
		...overrides,
	};
}

function makeContext(
	overrides: Partial<RenderContext<BaseContentItem>> = {},
): RenderContext<BaseContentItem> {
	return {
		source: {
			name: "mock",
			async list() {
				return [];
			},
			async loadMarkdown() {
				return "# Hello";
			},
			async loadBlocks() {
				return [];
			},
			getLastModified(item) {
				return item.updatedAt;
			},
			getListVersion() {
				return "";
			},
		},
		rendererFn: vi.fn().mockResolvedValue("<p>rendered</p>"),
		imgCache: {
			name: "test",
			get: vi.fn().mockResolvedValue(null),
			set: vi.fn().mockResolvedValue(undefined),
		},
		hasImageCache: false,
		imageProxyBase: "/api/images",
		contentConfig: undefined,
		hooks: {},
		logger: undefined,
		...overrides,
	};
}

describe("buildCachedItemMeta", () => {
	it("item / notionUpdatedAt / cachedAt を含むメタを返す", () => {
		const item = makeItem();
		const meta = buildCachedItemMeta(item, makeContext().source);
		expect(meta.item).toBe(item);
		expect(meta.notionUpdatedAt).toBe("2024-01-01T00:00:00Z");
		expect(typeof meta.cachedAt).toBe("number");
	});
});

describe("buildCachedItemContent", () => {
	describe("正常系", () => {
		it("html / markdown / blocks / notionUpdatedAt / cachedAt を含む CachedItemContent を返す", async () => {
			const item = makeItem();
			const result = await buildCachedItemContent(item, makeContext());
			expect(result.html).toBe("<p>rendered</p>");
			expect(result.markdown).toBe("# Hello");
			expect(result.blocks).toEqual([]);
			expect(result.notionUpdatedAt).toBe("2024-01-01T00:00:00Z");
			expect(typeof result.cachedAt).toBe("number");
		});

		it("rendererFn に markdown と imageProxyBase が渡される", async () => {
			const item = makeItem();
			const rendererFn = vi.fn().mockResolvedValue("<p>ok</p>");
			await buildCachedItemContent(
				item,
				makeContext({ rendererFn, imageProxyBase: "/custom/images" }),
			);
			const [md, opts] = vi.mocked(rendererFn).mock.calls[0];
			expect(md).toBe("# Hello");
			expect(opts?.imageProxyBase).toBe("/custom/images");
		});

		it("hasImageCache が true の場合 cacheImage 関数が rendererFn に渡される", async () => {
			const item = makeItem();
			const rendererFn = vi.fn().mockResolvedValue("<p>ok</p>");
			await buildCachedItemContent(
				item,
				makeContext({ rendererFn, hasImageCache: true }),
			);
			const [, opts] = vi.mocked(rendererFn).mock.calls[0];
			expect(typeof opts?.cacheImage).toBe("function");
		});

		it("hasImageCache が false の場合 cacheImage は undefined で渡される", async () => {
			const item = makeItem();
			const rendererFn = vi.fn().mockResolvedValue("<p>ok</p>");
			await buildCachedItemContent(
				item,
				makeContext({ rendererFn, hasImageCache: false }),
			);
			const [, opts] = vi.mocked(rendererFn).mock.calls[0];
			expect(opts?.cacheImage).toBeUndefined();
		});
	});

	describe("エラー処理・フォールバック", () => {
		it("loadBlocks が失敗した場合は空配列にフォールバックする", async () => {
			const item = makeItem();
			const ctx = makeContext({
				source: {
					name: "mock",
					async list() {
						return [];
					},
					async loadMarkdown() {
						return "# Hello";
					},
					async loadBlocks() {
						throw new Error("blocks failed");
					},
					getLastModified(i) {
						return i.updatedAt;
					},
					getListVersion() {
						return "";
					},
				},
			});
			const result = await buildCachedItemContent(item, ctx);
			expect(result.blocks).toEqual([]);
		});

		it("loadMarkdown が失敗すると source/load_markdown_failed CMSError をスローする", async () => {
			const item = makeItem();
			const ctx = makeContext({
				source: {
					name: "mock",
					async list() {
						return [];
					},
					async loadMarkdown() {
						throw new Error("markdown failed");
					},
					async loadBlocks() {
						return [];
					},
					getLastModified(i) {
						return i.updatedAt;
					},
					getListVersion() {
						return "";
					},
				},
			});
			await expect(buildCachedItemContent(item, ctx)).rejects.toSatisfy(
				(err: unknown) =>
					isCMSError(err) && err.code === "source/load_markdown_failed",
			);
		});

		it("loadMarkdown が CMSError をスローする場合はそのままリスローする", async () => {
			const item = makeItem();
			const { CMSError } = await import("../errors");
			const originalError = new CMSError({
				code: "source/fetch_item_failed",
				message: "already CMS error",
				context: { operation: "test" },
			});
			const ctx = makeContext({
				source: {
					name: "mock",
					async list() {
						return [];
					},
					async loadMarkdown() {
						throw originalError;
					},
					async loadBlocks() {
						return [];
					},
					getLastModified(i) {
						return i.updatedAt;
					},
					getListVersion() {
						return "";
					},
				},
			});
			await expect(buildCachedItemContent(item, ctx)).rejects.toBe(
				originalError,
			);
		});

		it("renderer が失敗すると renderer/failed CMSError をスローする", async () => {
			const item = makeItem();
			const ctx = makeContext({
				rendererFn: vi.fn().mockRejectedValue(new Error("render failed")),
			});
			await expect(buildCachedItemContent(item, ctx)).rejects.toSatisfy(
				(err: unknown) => isCMSError(err) && err.code === "renderer/failed",
			);
		});

		it("renderer が CMSError をスローする場合はそのままリスローする", async () => {
			const item = makeItem();
			const { CMSError } = await import("../errors");
			const originalError = new CMSError({
				code: "renderer/failed",
				message: "already renderer error",
				context: { operation: "test" },
			});
			const ctx = makeContext({
				rendererFn: vi.fn().mockRejectedValue(originalError),
			});
			await expect(buildCachedItemContent(item, ctx)).rejects.toBe(
				originalError,
			);
		});
	});

	describe("フック", () => {
		it("onRenderStart と onRenderEnd が slug で呼ばれる", async () => {
			const item = makeItem({ slug: "my-post" });
			const onRenderStart = vi.fn();
			const onRenderEnd = vi.fn();
			await buildCachedItemContent(
				item,
				makeContext({ hooks: { onRenderStart, onRenderEnd } }),
			);
			expect(onRenderStart).toHaveBeenCalledWith("my-post");
			expect(onRenderEnd).toHaveBeenCalledWith("my-post", expect.any(Number));
		});

		it("afterRender フックが HTML を書き換える", async () => {
			const item = makeItem();
			const ctx = makeContext({
				hooks: {
					afterRender: async (html) => `<div>${html}</div>`,
				},
			});
			const result = await buildCachedItemContent(item, ctx);
			expect(result.html).toBe("<div><p>rendered</p></div>");
		});

		it("beforeCacheContent フックが CachedItemContent を書き換える", async () => {
			const item = makeItem();
			const ctx = makeContext({
				hooks: {
					beforeCacheContent: async (content) => ({
						...content,
						html: "<p>modified</p>",
					}),
				},
			});
			const result = await buildCachedItemContent(item, ctx);
			expect(result.html).toBe("<p>modified</p>");
		});
	});

	describe("ロガー", () => {
		it("logger.info がレンダリング開始・終了で呼ばれる", async () => {
			const item = makeItem({ slug: "my-post" });
			const infoFn = vi.fn();
			await buildCachedItemContent(
				item,
				makeContext({ logger: { info: infoFn } }),
			);
			expect(infoFn).toHaveBeenCalledWith(
				"コンテンツのレンダリング開始",
				expect.objectContaining({ slug: "my-post" }),
			);
			expect(infoFn).toHaveBeenCalledWith(
				"コンテンツのレンダリング完了",
				expect.objectContaining({
					slug: "my-post",
					durationMs: expect.any(Number),
				}),
			);
		});

		it("loadBlocks 失敗時に logger.warn が呼ばれる", async () => {
			const item = makeItem({ slug: "warn-test" });
			const warnFn = vi.fn();
			const ctx = makeContext({
				logger: { warn: warnFn },
				source: {
					name: "mock",
					async list() {
						return [];
					},
					async loadMarkdown() {
						return "# Hello";
					},
					async loadBlocks() {
						throw new Error("blocks err");
					},
					getLastModified(i) {
						return i.updatedAt;
					},
					getListVersion() {
						return "";
					},
				},
			});
			await buildCachedItemContent(item, ctx);
			expect(warnFn).toHaveBeenCalledWith(
				"loadBlocks に失敗したため raw フォールバック",
				expect.objectContaining({ slug: "warn-test" }),
			);
		});
	});

	describe("デフォルトレンダラー（rendererFn 未指定）", () => {
		it("rendererFn が undefined の場合、@notion-headless-cms/renderer をロードして使う", async () => {
			const item = makeItem({ slug: "default-renderer-test" });
			const ctx = makeContext({ rendererFn: undefined });
			const result = await buildCachedItemContent(item, ctx);
			expect(typeof result.html).toBe("string");
		});
	});
});
