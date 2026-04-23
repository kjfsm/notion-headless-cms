import type { DataSource } from "@notion-headless-cms/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNodeCMS } from "../cms";

vi.mock("@notion-headless-cms/renderer", () => ({
	renderMarkdown: vi.fn().mockResolvedValue("<p>rendered</p>"),
}));

function makeStubDataSource(): DataSource {
	return {
		name: "notion-stub",
		list: vi.fn().mockResolvedValue([
			{
				id: "id-1",
				slug: "post-a",
				updatedAt: "2024-01-01T00:00:00.000Z",
				status: "公開",
			},
		]),
		findBySlug: vi.fn().mockResolvedValue(null),
		loadMarkdown: vi.fn().mockResolvedValue("# Hello"),
		loadBlocks: vi.fn().mockResolvedValue([]),
		getLastModified: (item) => item.updatedAt,
		getListVersion: (items) =>
			items.map((i) => `${i.id}:${i.updatedAt}`).join("|"),
	};
}

describe("createNodeCMS", () => {
	const origEnv = { ...process.env };

	beforeEach(() => {
		process.env.NOTION_TOKEN = "test-token";
	});

	afterEach(() => {
		process.env.NOTION_TOKEN = origEnv.NOTION_TOKEN;
	});

	it("NOTION_TOKEN があればコレクション別クライアントを作成できる", () => {
		const cms = createNodeCMS({
			dataSources: { posts: makeStubDataSource() },
		});
		expect(typeof cms.posts.getItem).toBe("function");
		expect(typeof cms.posts.getList).toBe("function");
	});

	it("NOTION_TOKEN が未設定の場合はエラーをスローする", () => {
		delete process.env.NOTION_TOKEN;
		expect(() =>
			createNodeCMS({ dataSources: { posts: makeStubDataSource() } }),
		).toThrow("NOTION_TOKEN");
	});

	it("token オプションで環境変数を上書きできる", () => {
		delete process.env.NOTION_TOKEN;
		const cms = createNodeCMS({
			dataSources: { posts: makeStubDataSource() },
			token: "custom-token",
		});
		expect(cms.posts).toBeDefined();
	});

	it("getList() が DataSource のアイテムを返す", async () => {
		const cms = createNodeCMS({
			dataSources: { posts: makeStubDataSource() },
		});
		const items = await cms.posts.getList();
		expect(items).toHaveLength(1);
		expect(items[0]?.slug).toBe("post-a");
	});

	it("cache: { document: 'memory' } でインメモリキャッシュを有効化できる", () => {
		const cms = createNodeCMS({
			dataSources: { posts: makeStubDataSource() },
			cache: { document: "memory", ttlMs: 60_000 },
		});
		expect(cms.posts).toBeDefined();
		expect(typeof cms.$revalidate).toBe("function");
	});

	it("cache: 'disabled' でキャッシュ無効で動作する", () => {
		const cms = createNodeCMS({
			dataSources: { posts: makeStubDataSource() },
			cache: "disabled",
		});
		expect(cms.posts).toBeDefined();
	});

	it("$collections で登録されたコレクション名を取得できる", () => {
		const cms = createNodeCMS({
			dataSources: {
				posts: makeStubDataSource(),
				news: makeStubDataSource(),
			},
		});
		expect(cms.$collections).toEqual(["posts", "news"]);
	});
});
