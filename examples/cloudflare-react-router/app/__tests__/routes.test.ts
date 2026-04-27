import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
	posts: {
		list: vi.fn(),
		get: vi.fn(),
	},
};

vi.mock("../lib/cms.js", () => ({
	makeCms: vi.fn().mockReturnValue(fakeCms),
}));

const { loader: homeLoader } = await import("../routes/home.js");
const { loader: postLoader } = await import("../routes/post.js");

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
