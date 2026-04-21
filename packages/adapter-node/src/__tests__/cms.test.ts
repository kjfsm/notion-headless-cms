import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNodeCMS } from "../cms";

vi.mock("@notion-headless-cms/source-notion", () => ({
	notionAdapter: vi.fn().mockReturnValue({
		name: "notion",
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
	}),
	defineMapping: vi.fn(),
	defineSchema: vi.fn(),
}));

vi.mock("@notion-headless-cms/renderer", () => ({
	renderMarkdown: vi.fn().mockResolvedValue("<p>rendered</p>"),
}));

describe("createNodeCMS", () => {
	const origEnv = { ...process.env };

	beforeEach(() => {
		process.env.NOTION_TOKEN = "test-token";
		process.env.NOTION_DATA_SOURCE_ID = "test-db-id";
	});

	afterEach(() => {
		process.env.NOTION_TOKEN = origEnv.NOTION_TOKEN;
		process.env.NOTION_DATA_SOURCE_ID = origEnv.NOTION_DATA_SOURCE_ID;
	});

	it("環境変数が設定されていれば CMS インスタンスを作成できる", () => {
		const cms = createNodeCMS();
		expect(cms).toBeDefined();
		expect(typeof cms.list).toBe("function");
		expect(typeof cms.find).toBe("function");
	});

	it("NOTION_TOKEN が未設定の場合はエラーをスローする", () => {
		delete process.env.NOTION_TOKEN;
		expect(() => createNodeCMS()).toThrow("NOTION_TOKEN");
	});

	it("NOTION_DATA_SOURCE_ID が未設定の場合はエラーをスローする", () => {
		delete process.env.NOTION_DATA_SOURCE_ID;
		expect(() => createNodeCMS()).toThrow("NOTION_DATA_SOURCE_ID");
	});

	it("list() がソースのアイテムを返す", async () => {
		const cms = createNodeCMS();
		const items = await cms.list();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("post-a");
	});

	it("cache: { document: 'memory' } でインメモリキャッシュ付き CMS を作成できる", () => {
		const cms = createNodeCMS({ cache: { document: "memory", ttlMs: 60_000 } });
		expect(cms).toBeDefined();
		expect(typeof cms.cache.getList).toBe("function");
		expect(typeof cms.cache.get).toBe("function");
	});

	it("cache: 'disabled' でキャッシュ無効で動作する", () => {
		const cms = createNodeCMS({ cache: "disabled" });
		expect(cms).toBeDefined();
	});
});
