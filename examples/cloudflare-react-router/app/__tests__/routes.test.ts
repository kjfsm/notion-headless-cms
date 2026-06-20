import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  // buildPageLinkMap(cms) が走査するコレクション名一覧。
  collections: ["posts"],
  posts: {
    list: vi.fn(),
    find: vi.fn(),
    cache: {
      warm: vi.fn(),
    },
  },
};

vi.mock("../lib/cms.js", () => ({
  makeCms: vi.fn().mockReturnValue(fakeCms),
}));

// post loader は Notion クライアントとブロック木フェッチを直接使う。
// 実 HTTP は飛ばさず、固定のブロック配列を返すようにモック。
vi.mock("@notionhq/client", () => ({
  Client: class FakeClient {},
}));
vi.mock("@notion-headless-cms/notion-orm", () => ({
  fetchBlockTree: vi
    .fn()
    .mockResolvedValue([{ object: "block", id: "b1", type: "paragraph" }]),
}));

const { loader: homeLoader } = await import("../routes/home.js");
const { loader: postLoader } = await import("../routes/post.js");
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

  it("ページ詳細・ブロック木・内部リンク解決マップを返す", async () => {
    fakeCms.posts.find.mockResolvedValue({
      id: "id-1",
      slug: "hello",
      notionBlocks: async () => [
        { object: "block", id: "b1", type: "paragraph" },
      ],
    });
    // buildPageLinkMap(cms) は各コレクションの list() を走査して逆引きを作る。
    fakeCms.posts.list.mockResolvedValue([
      {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "hello",
        title: "Hello",
      },
    ]);
    const result = (await postLoader({
      params: { slug: "hello" },
      request: new Request("https://example.com/posts/hello"),
      context: fakeContext,
    } as never)) as {
      blocks: unknown[];
      pageLinks: Record<string, { href: string; title?: string | null }>;
    };
    expect(result.blocks).toHaveLength(1);
    // 正規化 pageId（ダッシュ除去）で /posts/hello に解決される。
    expect(result.pageLinks["11111111111111111111111111111111"]).toEqual({
      href: "/posts/hello",
      title: "Hello",
    });
  });

  it("存在しないスラグは例外を投げる", async () => {
    fakeCms.posts.find.mockResolvedValue(null);
    await expect(
      postLoader({
        params: { slug: "not-found" },
        request: new Request("https://example.com/posts/not-found"),
        context: fakeContext,
      } as never),
    ).rejects.toBeDefined();
  });
});

describe("warm action()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ウォームアップ結果を JSON で返す", async () => {
    fakeCms.posts.cache.warm.mockResolvedValue({ ok: 3, failed: [] });
    const result = await warmAction({ context: fakeContext } as never);
    const json = await (result as Response).json();
    expect(json).toEqual({ ok: 3, failed: [] });
  });

  it("失敗があっても結果を返す", async () => {
    fakeCms.posts.cache.warm.mockResolvedValue({
      ok: 2,
      failed: [{ slug: "bad-slug", error: new Error("fetch failed") }],
    });
    const result = await warmAction({ context: fakeContext } as never);
    const json = (await (result as Response).json()) as { failed: unknown[] };
    expect(json.failed).toHaveLength(1);
  });
});
