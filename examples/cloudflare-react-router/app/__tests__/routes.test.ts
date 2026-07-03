import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  posts: {
    list: vi.fn(),
    find: vi.fn(),
  },
  sync: {
    kick: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue({
      cursor: null,
      lastSyncAt: null,
      lastReconcileAt: null,
      failures: [],
    }),
  },
  fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
};

vi.mock("../lib/cms.js", () => ({
  makeCms: vi.fn().mockReturnValue(fakeCms),
  ensureSynced: vi.fn().mockResolvedValue(undefined),
}));

const { ensureSynced } = await import("../lib/cms.js");
const { loader: homeLoader } = await import("../routes/home.js");
const { loader: postLoader } = await import("../routes/post.js");
const { loader: apiCmsLoader, action: apiCmsAction } = await import(
  "../routes/api.cms.js"
);
const { action: warmAction } = await import("../routes/warm.js");

const PARAGRAPH_BLOCK = {
  id: "b1",
  type: "paragraph",
  data: {
    rich_text: [
      { type: "text", plain_text: "内容", annotations: {}, href: null },
    ],
  },
};

const fakeContext = {
  cloudflare: { env: { NOTION_TOKEN: "test-token" }, ctx: { waitUntil() {} } },
};

describe("home loader()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cms.posts.list() のページリストを返す", async () => {
    fakeCms.posts.list.mockResolvedValue({
      items: [{ slug: "hello", version: "v1", listed: true, meta: {} }],
      nextCursor: null,
      hasMore: false,
    });
    const result = await homeLoader({ context: fakeContext } as never);
    expect(
      (result as { items: readonly { slug: string }[] }).items,
    ).toHaveLength(1);
    expect(
      (result as { items: readonly { slug: string }[] }).items[0]?.slug,
    ).toBe("hello");
  });
});

describe("post loader()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("正規化済みエントリを返す", async () => {
    fakeCms.posts.find.mockResolvedValue({
      collection: "posts",
      slug: "hello",
      version: "v1",
      meta: { title: "Hello", publishedAt: "2024-01-01" },
      blocks: [PARAGRAPH_BLOCK],
      images: {},
      links: {},
    });
    const result = (await postLoader({
      params: { slug: "hello" },
      request: new Request("https://example.com/posts/hello"),
      context: fakeContext,
    } as never)) as { post: { slug: string; blocks: readonly unknown[] } };
    expect(result.post.slug).toBe("hello");
    expect(result.post.blocks).toHaveLength(1);
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

describe("api.cms ルート", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET は cms.fetch() に委譲する", async () => {
    const request = new Request("https://example.com/api/cms/images/abc");
    await apiCmsLoader({ request, context: fakeContext } as never);
    expect(fakeCms.fetch).toHaveBeenCalledWith(request);
  });

  it("POST（webhook）も cms.fetch() に委譲する", async () => {
    const request = new Request("https://example.com/api/cms/webhook", {
      method: "POST",
    });
    await apiCmsAction({ request, context: fakeContext } as never);
    expect(fakeCms.fetch).toHaveBeenCalledWith(request);
  });
});

describe("warm action()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ensureSynced() で同期を進め、進捗状態を JSON で返す", async () => {
    const result = await warmAction({ context: fakeContext } as never);
    expect(ensureSynced).toHaveBeenCalledWith(fakeCms);
    const json = (await (result as Response).json()) as {
      state: { cursor: string | null };
    };
    expect(json.state.cursor).toBeNull();
  });
});
