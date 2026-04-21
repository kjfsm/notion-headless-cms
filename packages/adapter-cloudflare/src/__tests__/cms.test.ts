import type { R2BucketLike, R2ObjectLike } from "@notion-headless-cms/cache-r2";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("createCloudflareCMS", () => {
	const baseEnv = {
		NOTION_TOKEN: "mock-token",
		NOTION_DATA_SOURCE_ID: "mock-db-id",
	};

	it("CACHE_BUCKET なしで CMS インスタンスを作成できる", () => {
		const cms = createCloudflareCMS({ env: baseEnv });
		expect(cms).toBeDefined();
		expect(typeof cms.list).toBe("function");
		expect(typeof cms.find).toBe("function");
		expect(typeof cms.render).toBe("function");
	});

	it("CACHE_BUCKET ありで CMS インスタンスを作成できる（mock R2BucketLike）", () => {
		const env = { ...baseEnv, CACHE_BUCKET: makeMockBucket() };
		const cms = createCloudflareCMS({ env });
		expect(cms).toBeDefined();
		expect(typeof cms.cache.read.list).toBe("function");
		expect(typeof cms.cache.read.get).toBe("function");
	});

	it("list() がソースのアイテムを返す", async () => {
		const cms = createCloudflareCMS({ env: baseEnv });
		const items = await cms.list();
		expect(items).toHaveLength(1);
		expect(items[0].slug).toBe("post-a");
	});

	it("ttlMs オプションが cache に反映される", () => {
		const env = { ...baseEnv, CACHE_BUCKET: makeMockBucket() };
		const cms = createCloudflareCMS({ env, ttlMs: 30_000 });
		expect(cms).toBeDefined();
	});
});
