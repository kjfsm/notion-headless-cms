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
	isNotionSchema: vi.fn().mockReturnValue(false),
}));

vi.mock("@notion-headless-cms/renderer", () => ({
	renderMarkdown: vi.fn().mockResolvedValue("<p>rendered</p>"),
}));

const schema = {
	posts: { id: "test-db-id", dbName: "記事DB" },
} as const;

describe("createNodeCMS", () => {
	const origEnv = { ...process.env };

	beforeEach(() => {
		process.env.NOTION_TOKEN = "test-token";
	});

	afterEach(() => {
		process.env.NOTION_TOKEN = origEnv.NOTION_TOKEN;
	});

	it("NOTION_TOKEN があれば各ソースの CMS インスタンスを作成できる", () => {
		const client = createNodeCMS({ schema });
		expect(typeof client.posts.list).toBe("function");
		expect(typeof client.posts.find).toBe("function");
	});

	it("NOTION_TOKEN が未設定の場合はエラーをスローする", () => {
		delete process.env.NOTION_TOKEN;
		expect(() => createNodeCMS({ schema })).toThrow("NOTION_TOKEN");
	});

	it("token オプションで環境変数を上書きできる", () => {
		delete process.env.NOTION_TOKEN;
		const client = createNodeCMS({ schema, token: "custom-token" });
		expect(client.posts).toBeDefined();
	});

	it("list() がソースのアイテムを返す", async () => {
		const client = createNodeCMS({ schema });
		const items = await client.posts.list();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("post-a");
	});

	it("cache: { document: 'memory' } でインメモリキャッシュを有効化できる", () => {
		const client = createNodeCMS({
			schema,
			cache: { document: "memory", ttlMs: 60_000 },
		});
		expect(typeof client.posts.cache.getList).toBe("function");
		expect(typeof client.posts.cache.get).toBe("function");
	});

	it("cache: 'disabled' でキャッシュ無効で動作する", () => {
		const client = createNodeCMS({ schema, cache: "disabled" });
		expect(client.posts).toBeDefined();
	});

	it("sources でソースごとの publishedStatuses を上書きできる", () => {
		const client = createNodeCMS({
			schema,
			sources: {
				posts: { published: ["公開"], accessible: ["公開", "下書き"] },
			},
		});
		expect(client.posts).toBeDefined();
	});
});
