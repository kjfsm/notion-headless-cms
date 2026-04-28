import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
	posts: {
		list: vi.fn(),
		get: vi.fn(),
		check: vi.fn(),
		cache: {
			warm: vi.fn(),
		},
	},
};

vi.mock("../lib/cms.js", () => ({
	makeCms: vi.fn().mockReturnValue(fakeCms),
}));

const { loader: homeLoader } = await import("../routes/home.js");
const { loader: postLoader } = await import("../routes/post.js");
const { loader: checkLoader } = await import("../routes/check.js");
const { action: warmAction } = await import("../routes/warm.js");

const fakeContext = {
	cloudflare: { env: { NOTION_TOKEN: "test-token" } },
};

describe("home loader()", () => {
	beforeEach(() => vi.clearAllMocks());

	it("ページリストを返す", async () => {
		fakeCms.posts.list.mockResolvedValue([
			{ slug: "hello", title: "Hello World" },
		]);
		const result = await homeLoader({ context: fakeContext } as never);
		expect((result as { items: { slug: string }[] }).items).toHaveLength(1);
		expect((result as { items: { slug: string }[] }).items[0].slug).toBe(
			"hello",
		);
	});
});

describe("post loader()", () => {
	beforeEach(() => vi.clearAllMocks());

	it("ページ詳細と HTML を返す", async () => {
		fakeCms.posts.get.mockResolvedValue({
			id: "id-1",
			slug: "hello",
			render: vi.fn().mockResolvedValue("<p>内容</p>"),
		});
		const result = await postLoader({
			params: { slug: "hello" },
			context: fakeContext,
		} as never);
		expect((result as { html: string }).html).toBe("<p>内容</p>");
	});

	it("存在しないスラグは例外を投げる", async () => {
		fakeCms.posts.get.mockResolvedValue(null);
		await expect(
			postLoader({
				params: { slug: "not-found" },
				context: fakeContext,
			} as never),
		).rejects.toBeDefined();
	});
});

describe("check loader()", () => {
	beforeEach(() => vi.clearAllMocks());

	it("バージョンが一致するときは stale: false を返す", async () => {
		fakeCms.posts.check.mockResolvedValue({ stale: false });
		const req = new Request(
			"http://localhost/api/posts/hello/check?v=2024-01-01T00%3A00%3A00Z",
		);
		const result = await checkLoader({
			params: { slug: "hello" },
			request: req,
			context: fakeContext,
		} as never);
		const json = await (result as Response).json();
		expect(json).toEqual({ stale: false });
	});

	it("バージョンが異なるときは stale: true と html を返す", async () => {
		fakeCms.posts.check.mockResolvedValue({
			stale: true,
			item: {
				updatedAt: "2024-01-02T00:00:00Z",
				render: vi.fn().mockResolvedValue("<p>新しい内容</p>"),
			},
		});
		const req = new Request(
			"http://localhost/api/posts/hello/check?v=2024-01-01T00%3A00%3A00Z",
		);
		const result = await checkLoader({
			params: { slug: "hello" },
			request: req,
			context: fakeContext,
		} as never);
		const json = await (result as Response).json();
		expect(json.stale).toBe(true);
		expect(json.html).toBe("<p>新しい内容</p>");
		expect(json.version).toBe("2024-01-02T00:00:00Z");
	});

	it("存在しないスラグは 404 を返す", async () => {
		fakeCms.posts.check.mockResolvedValue(null);
		const req = new Request(
			"http://localhost/api/posts/not-found/check?v=2024-01-01T00%3A00%3A00Z",
		);
		const result = await checkLoader({
			params: { slug: "not-found" },
			request: req,
			context: fakeContext,
		} as never);
		expect((result as Response).status).toBe(404);
	});
});

describe("warm action()", () => {
	beforeEach(() => vi.clearAllMocks());

	it("ウォームアップ結果を JSON で返す", async () => {
		fakeCms.posts.cache.warm.mockResolvedValue({ ok: 3, failed: 0 });
		const result = await warmAction({ context: fakeContext } as never);
		const json = await (result as Response).json();
		expect(json).toEqual({ ok: 3, failed: 0 });
	});

	it("失敗があっても結果を返す", async () => {
		fakeCms.posts.cache.warm.mockResolvedValue({ ok: 2, failed: 1 });
		const result = await warmAction({ context: fakeContext } as never);
		const json = await (result as Response).json();
		expect(json.failed).toBe(1);
	});
});
