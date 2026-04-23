import type { R2BucketLike, R2ObjectLike } from "@notion-headless-cms/cache-r2";
import { describe, expect, it, vi } from "vitest";
import { createCloudflareCMS } from "../cms";

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

function makeR2ObjectLike(data: unknown): R2ObjectLike {
	return {
		json: vi.fn().mockResolvedValue(data),
		arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
		httpMetadata: { contentType: "application/json" },
	};
}

function makeMockBucket(): R2BucketLike {
	const store = new Map<string, unknown>();
	return {
		get: vi.fn().mockImplementation(async (key: string) => {
			const val = store.get(key);
			return val ? makeR2ObjectLike(val) : null;
		}),
		put: vi
			.fn()
			.mockImplementation(async (key: string, value: string | ArrayBuffer) => {
				store.set(key, typeof value === "string" ? JSON.parse(value) : value);
			}),
	};
}

const schema = {
	posts: { id: "mock-db-id", dbName: "記事DB" },
} as const;

describe("createCloudflareCMS", () => {
	const baseEnv = { NOTION_TOKEN: "mock-token" };

	it("CACHE_BUCKET なしで各ソースの CMS インスタンスを作成できる", () => {
		const client = createCloudflareCMS({ schema, env: baseEnv });
		expect(typeof client.posts.list).toBe("function");
		expect(typeof client.posts.find).toBe("function");
		expect(typeof client.posts.render).toBe("function");
	});

	it("CACHE_BUCKET ありで CMS インスタンスを作成できる", () => {
		const env = { ...baseEnv, CACHE_BUCKET: makeMockBucket() };
		const client = createCloudflareCMS({ schema, env });
		expect(typeof client.posts.cache.getList).toBe("function");
		expect(typeof client.posts.cache.get).toBe("function");
	});

	it("list() がソースのアイテムを返す", async () => {
		const client = createCloudflareCMS({ schema, env: baseEnv });
		const items = await client.posts.list();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("post-a");
	});

	it("ttlMs オプションを指定できる", () => {
		const env = { ...baseEnv, CACHE_BUCKET: makeMockBucket() };
		const client = createCloudflareCMS({ schema, env, ttlMs: 30_000 });
		expect(client.posts).toBeDefined();
	});

	it("sources でソースごとの publishedStatuses を上書きできる", () => {
		const client = createCloudflareCMS({
			schema,
			env: baseEnv,
			sources: {
				posts: { published: ["公開"], accessible: ["公開", "下書き"] },
			},
		});
		expect(client.posts).toBeDefined();
	});
});
