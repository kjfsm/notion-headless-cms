import type { R2BucketLike, R2ObjectLike } from "@notion-headless-cms/cache-r2";
import type { DataSource } from "@notion-headless-cms/core";
import { describe, expect, it, vi } from "vitest";
import { createCloudflareCMS } from "../cms";

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
	const baseEnv = { NOTION_TOKEN: "mock-token" };

	it("CACHE_BUCKET なしでコレクション別クライアントを作成できる", () => {
		const cms = createCloudflareCMS({
			dataSources: { posts: makeStubDataSource() },
			env: baseEnv,
		});
		expect(typeof cms.posts.getItem).toBe("function");
		expect(typeof cms.posts.getList).toBe("function");
	});

	it("CACHE_BUCKET ありでキャッシュ付きクライアントを作成できる", () => {
		const env = { ...baseEnv, CACHE_BUCKET: makeMockBucket() };
		const cms = createCloudflareCMS({
			dataSources: { posts: makeStubDataSource() },
			env,
		});
		expect(typeof cms.$revalidate).toBe("function");
		expect(typeof cms.$handler).toBe("function");
	});

	it("getList() が DataSource のアイテムを返す", async () => {
		const cms = createCloudflareCMS({
			dataSources: { posts: makeStubDataSource() },
			env: baseEnv,
		});
		const items = await cms.posts.getList();
		expect(items).toHaveLength(1);
		expect(items[0]?.slug).toBe("post-a");
	});

	it("ttlMs オプションを指定できる", () => {
		const env = { ...baseEnv, CACHE_BUCKET: makeMockBucket() };
		const cms = createCloudflareCMS({
			dataSources: { posts: makeStubDataSource() },
			env,
			ttlMs: 30_000,
		});
		expect(cms.posts).toBeDefined();
	});
});
