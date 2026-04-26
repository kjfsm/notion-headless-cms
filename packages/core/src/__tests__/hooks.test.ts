import { describe, expect, it, vi } from "vitest";
import { mergeHooks, mergeLoggers } from "../hooks";
import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemMeta,
} from "../types/index";
import type { CMSPlugin } from "../types/plugin";

const makeItem = (slug: string): BaseContentItem => ({
	id: `id-${slug}`,
	slug,
	status: "公開",
	publishedAt: "2024-01-01",
	updatedAt: "2024-01-01T00:00:00.000Z",
});

const makeMeta = (slug: string): CachedItemMeta => ({
	item: makeItem(slug),
	notionUpdatedAt: "2024-01-01T00:00:00.000Z",
	cachedAt: Date.now(),
});

const makeContent = (): CachedItemContent => ({
	html: "<p>test</p>",
	markdown: "# test",
	blocks: [],
	notionUpdatedAt: "2024-01-01T00:00:00.000Z",
	cachedAt: Date.now(),
});

describe("mergeHooks", () => {
	it("フックがない場合は空オブジェクトを返す", () => {
		const merged = mergeHooks([], undefined);
		expect(merged).toEqual({});
	});

	it("beforeCacheMeta はパイプラインとして連鎖する", async () => {
		const order: number[] = [];
		const p1: CMSPlugin = {
			name: "p1",
			hooks: {
				beforeCacheMeta: async (meta) => {
					order.push(1);
					return {
						...meta,
						notionUpdatedAt: `${meta.notionUpdatedAt}-p1`,
					};
				},
			},
		};
		const merged = mergeHooks([p1], {
			beforeCacheMeta: async (meta) => {
				order.push(2);
				return {
					...meta,
					notionUpdatedAt: `${meta.notionUpdatedAt}-direct`,
				};
			},
		});

		const result = await merged.beforeCacheMeta?.(makeMeta("test"));
		expect(result?.notionUpdatedAt).toBe("2024-01-01T00:00:00.000Z-p1-direct");
		expect(order).toEqual([1, 2]);
	});

	it("beforeCacheContent はパイプラインとして連鎖する", async () => {
		const merged = mergeHooks(
			[
				{
					name: "p1",
					hooks: {
						beforeCacheContent: async (content) => ({
							...content,
							html: `${content.html}-p1`,
						}),
					},
				},
			],
			{
				beforeCacheContent: async (content) => ({
					...content,
					html: `${content.html}-direct`,
				}),
			},
		);
		const result = await merged.beforeCacheContent?.(
			makeContent(),
			makeItem("slug"),
		);
		expect(result?.html).toBe("<p>test</p>-p1-direct");
	});

	it("afterRender はパイプラインとして連鎖する", async () => {
		const merged = mergeHooks(
			[
				{
					name: "p1",
					hooks: { afterRender: async (html) => `${html}-p1` },
				},
			],
			{ afterRender: async (html) => `${html}-direct` },
		);
		const result = await merged.afterRender?.("<p>hello</p>", makeItem("slug"));
		expect(result).toBe("<p>hello</p>-p1-direct");
	});

	it("onCacheHit は全プラグインに同じ値を渡す", () => {
		const calls: string[] = [];
		const merged = mergeHooks([
			{
				name: "p1",
				hooks: { onCacheHit: (slug) => calls.push(`p1:${slug}`) },
			},
			{
				name: "p2",
				hooks: { onCacheHit: (slug) => calls.push(`p2:${slug}`) },
			},
		]);
		merged.onCacheHit?.("my-slug", makeMeta("my-slug"));
		expect(calls).toEqual(["p1:my-slug", "p2:my-slug"]);
	});

	it("onCacheMiss が呼ばれる", () => {
		const fn = vi.fn();
		const merged = mergeHooks([{ name: "p", hooks: { onCacheMiss: fn } }]);
		merged.onCacheMiss?.("slug");
		expect(fn).toHaveBeenCalledWith("slug");
	});

	it("観測フックで例外が投げられても後続フックは実行される", () => {
		const logger = { error: vi.fn() };
		const calls: string[] = [];
		const merged = mergeHooks(
			[
				{
					name: "p1",
					hooks: {
						onCacheHit: () => {
							throw new Error("boom");
						},
					},
				},
				{
					name: "p2",
					hooks: { onCacheHit: (slug) => calls.push(slug) },
				},
			],
			undefined,
			logger,
		);
		expect(() =>
			merged.onCacheHit?.("my-slug", makeMeta("my-slug")),
		).not.toThrow();
		expect(calls).toEqual(["my-slug"]);
		expect(logger.error).toHaveBeenCalled();
	});

	it("onRenderStart / onRenderEnd が観測フックとして機能する", () => {
		const start = vi.fn();
		const end = vi.fn();
		const merged = mergeHooks([
			{ name: "p", hooks: { onRenderStart: start, onRenderEnd: end } },
		]);
		merged.onRenderStart?.("slug-a");
		merged.onRenderEnd?.("slug-a", 42);
		expect(start).toHaveBeenCalledWith("slug-a");
		expect(end).toHaveBeenCalledWith("slug-a", 42);
	});

	it("onCacheRevalidated が mergeHooks で全プラグインに同じ値を渡す", () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();
		const merged = mergeHooks(
			[{ name: "p1", hooks: { onCacheRevalidated: fn1 } }],
			{ onCacheRevalidated: fn2 },
		);
		const meta = makeMeta("updated-slug");
		merged.onCacheRevalidated?.("updated-slug", meta);
		expect(fn1).toHaveBeenCalledWith("updated-slug", meta);
		expect(fn2).toHaveBeenCalledWith("updated-slug", meta);
	});

	it("onContentRevalidated が全プラグインに同じ値を渡す", () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();
		const merged = mergeHooks(
			[{ name: "p1", hooks: { onContentRevalidated: fn1 } }],
			{ onContentRevalidated: fn2 },
		);
		const content = makeContent();
		merged.onContentRevalidated?.("updated-slug", content);
		expect(fn1).toHaveBeenCalledWith("updated-slug", content);
		expect(fn2).toHaveBeenCalledWith("updated-slug", content);
	});

	it("onListCacheRevalidated が mergeHooks で全プラグインに同じ値を渡す", () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();
		const merged = mergeHooks(
			[{ name: "p1", hooks: { onListCacheRevalidated: fn1 } }],
			{ onListCacheRevalidated: fn2 },
		);
		const list = {
			items: [makeItem("a"), makeItem("b")],
			cachedAt: Date.now(),
		};
		merged.onListCacheRevalidated?.(list);
		expect(fn1).toHaveBeenCalledWith(list);
		expect(fn2).toHaveBeenCalledWith(list);
	});
});

describe("mergeHooks - エラー処理・エッジケース", () => {
	it("フックが例外を throw しても logger.error に流して握りつぶす", () => {
		const errorLogger = vi.fn();
		const badHook = vi.fn().mockImplementation(() => {
			throw new Error("hook error");
		});
		const merged = mergeHooks(
			[{ name: "bad-plugin", hooks: { onCacheMiss: badHook } }],
			undefined,
			{ error: errorLogger },
		);
		expect(() => merged.onCacheMiss?.("slug")).not.toThrow();
		expect(errorLogger).toHaveBeenCalledWith(
			"観測フックで例外が発生",
			expect.objectContaining({ hook: "onCacheMiss" }),
		);
	});

	it("フックが例外を throw して logger が未定義でも握りつぶす", () => {
		const badHook = vi.fn().mockImplementation(() => {
			throw new Error("hook error");
		});
		const merged = mergeHooks(
			[{ name: "bad-plugin", hooks: { onCacheMiss: badHook } }],
			undefined,
			undefined,
		);
		expect(() => merged.onCacheMiss?.("slug")).not.toThrow();
	});

	it("フックが Error 以外 (文字列) を throw した場合も String() で変換してログ出力する", () => {
		const errorLogger = vi.fn();
		const badHook = vi.fn().mockImplementation(() => {
			throw "string-error";
		});
		const merged = mergeHooks(
			[{ name: "bad-plugin", hooks: { onCacheMiss: badHook } }],
			undefined,
			{ error: errorLogger },
		);
		expect(() => merged.onCacheMiss?.("slug")).not.toThrow();
		expect(errorLogger).toHaveBeenCalledWith(
			"観測フックで例外が発生",
			expect.objectContaining({ error: "string-error" }),
		);
	});

	it("hooks を持たないプラグインは空オブジェクトとして扱われる", () => {
		const fn = vi.fn();
		const merged = mergeHooks(
			[
				// biome-ignore lint/suspicious/noExplicitAny: テスト用にフックなしプラグイン
				{ name: "no-hooks" } as any,
				{ name: "with-hooks", hooks: { onCacheMiss: fn } },
			],
			undefined,
		);
		merged.onCacheMiss?.("slug");
		expect(fn).toHaveBeenCalledWith("slug");
	});
});

describe("mergeLoggers", () => {
	it("ロガーがない場合は undefined を返す", () => {
		expect(mergeLoggers([], undefined)).toBeUndefined();
	});

	it("複数のロガーを合成する", () => {
		const calls: string[] = [];
		const merged = mergeLoggers(
			[{ logger: { info: (msg) => calls.push(`p1:${msg}`) } }],
			{ info: (msg) => calls.push(`direct:${msg}`) },
		);
		merged?.info?.("hello");
		expect(calls).toEqual(["p1:hello", "direct:hello"]);
	});

	it("warn のみ定義されたロガーで info は undefined", () => {
		const merged = mergeLoggers([{ logger: { warn: vi.fn() } }]);
		expect(merged?.info).toBeUndefined();
		expect(merged?.warn).toBeDefined();
	});

	it("logger を持たないプラグインは空オブジェクトとして扱われる", () => {
		const fn = vi.fn();
		const merged = mergeLoggers(
			// biome-ignore lint/suspicious/noExplicitAny: テスト用にloggerなしプラグイン
			[{} as any],
			{ info: fn },
		);
		merged?.info?.("hello");
		expect(fn).toHaveBeenCalledWith("hello", undefined);
	});
});
