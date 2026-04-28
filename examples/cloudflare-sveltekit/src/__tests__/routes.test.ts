import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  posts: {
    list: vi.fn(),
    get: vi.fn(),
  },
};

vi.mock("$lib/cms", () => ({
  makeCms: vi.fn().mockReturnValue(fakeCms),
}));

const { load: loadIndex } = await import("../routes/+page.server.js");
const { load: loadPost } = await import(
  "../routes/posts/[slug]/+page.server.js"
);

const fakeEnv = { NOTION_TOKEN: "test-token" };
const fakePlatform = { env: fakeEnv };

describe("一覧ページ load()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページリストを返す", async () => {
    fakeCms.posts.list.mockResolvedValue([
      { slug: "hello", title: "Hello World" },
    ]);
    const result = await loadIndex({ platform: fakePlatform } as never);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].slug).toBe("hello");
  });
});

describe("詳細ページ load()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページ詳細と HTML を返す", async () => {
    fakeCms.posts.get.mockResolvedValue({
      id: "id-1",
      slug: "hello",
      render: vi.fn().mockResolvedValue("<p>内容</p>"),
    });
    const result = await loadPost({
      params: { slug: "hello" },
      platform: fakePlatform,
    } as never);
    expect(result.html).toBe("<p>内容</p>");
  });

  it("存在しないスラグは error() を投げる", async () => {
    fakeCms.posts.get.mockResolvedValue(null);
    await expect(
      loadPost({
        params: { slug: "not-found" },
        platform: fakePlatform,
      } as never),
    ).rejects.toBeDefined();
  });
});
