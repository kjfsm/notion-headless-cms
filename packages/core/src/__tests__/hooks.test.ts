import { describe, expect, it, vi } from "vitest";
import { mergeHooks, mergeLoggers } from "../hooks";
import type { BaseContentItem, CachedItem } from "../types/content";
import type { CMSPlugin } from "../types/plugin";

const makeItem = (slug: string): BaseContentItem => ({
	id: `id-${slug}`,
	slug,
	status: "公開",
	publishedAt: "2024-01-01",
	updatedAt: "2024-01-01T00:00:00.000Z",
});

const makeCachedItem = (slug: string): CachedItem => ({
	html: "<p>test</p>",
	item: makeItem(slug),
	notionUpdatedAt: "2024-01-01T00:00:00.000Z",
	cachedAt: Date.now(),
});

describe("mergeHooks", () => {
	it("フックがない場合は空オブジェクトを返す", () => {
		const merged = mergeHooks([], undefined);
		expect(merged).toEqual({});
	});

	it("beforeCache はパイプラインとして連鎖する", async () => {
		const order: number[] = [];
		const p1: CMSPlugin = {
			name: "p1",
			hooks: {
				beforeCache: async (item) => {
					order.push(1);
					return { ...item, html: `${item.html}-p1` };
				},
			},
		};
		const merged = mergeHooks([p1], {
			beforeCache: async (item) => {
				order.push(2);
				return { ...item, html: `${item.html}-direct` };
			},
		});

		const result = await merged.beforeCache?.(makeCachedItem("test"));
		expect(result?.html).toBe("<p>test</p>-p1-direct");
		expect(order).toEqual([1, 2]);
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
		merged.onCacheHit?.("my-slug", makeCachedItem("my-slug"));
		expect(calls).toEqual(["p1:my-slug", "p2:my-slug"]);
	});

	it("onCacheMiss が呼ばれる", () => {
		const fn = vi.fn();
		const merged = mergeHooks([{ name: "p", hooks: { onCacheMiss: fn } }]);
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
});
