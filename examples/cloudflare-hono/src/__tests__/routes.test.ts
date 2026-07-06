import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  posts: {
    list: vi.fn(),
    find: vi.fn(),
  },
  sync: { kick: vi.fn().mockResolvedValue(undefined) },
  fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
};

vi.mock("../lib/cms.js", () => ({
  makeCms: vi.fn().mockReturnValue(fakeCms),
}));

const app = (await import("../index.js")).default;

const fakeEnv = { NOTION_TOKEN: "test-token" };
// `c.executionCtx` を読んでも throw しないよう、ダミーの ExecutionContext を渡す。
// 実環境では Workers ランタイムが本物を注入する。
const fakeCtx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

const PARAGRAPH_BLOCK = {
  id: "b1",
  type: "paragraph",
  data: {
    rich_text: [
      { type: "text", plain_text: "内容", annotations: {}, href: null },
    ],
  },
};

describe("GET /posts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページリストを返す", async () => {
    fakeCms.posts.list.mockResolvedValue({
      items: [
        {
          slug: "hello",
          version: "v1",
          listed: true,
          meta: {
            id: "id-1",
            slug: "hello",
            lastEditedTime: "v1",
            title: "Hello",
            status: "公開済み",
            publishedAt: null,
            author: null,
          },
        },
      ],
      nextCursor: null,
      hasMore: false,
      total: 1,
    });
    const res = await app.request("/posts", {}, fakeEnv, fakeCtx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { slug: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe("hello");
  });
});

describe("GET /posts/:slug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページ詳細と HTML を返す", async () => {
    fakeCms.posts.find.mockResolvedValue({
      collection: "posts",
      slug: "hello",
      version: "v1",
      meta: {
        id: "id-1",
        slug: "hello",
        lastEditedTime: "v1",
        status: "公開済み",
      },
      blocks: [PARAGRAPH_BLOCK],
      images: {},
      links: {},
    });
    const res = await app.request("/posts/hello", {}, fakeEnv, fakeCtx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { html: string; item: { slug: string } };
    expect(body.html).toBe("<p>内容</p>");
    expect(body.item.slug).toBe("hello");
  });

  it("存在しないスラグは 404", async () => {
    fakeCms.posts.find.mockResolvedValue(null);
    const res = await app.request("/posts/not-found", {}, fakeEnv, fakeCtx);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sync/kick", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cms.sync.kick を呼ぶ", async () => {
    const res = await app.request(
      "/api/sync/kick",
      { method: "POST" },
      fakeEnv,
      fakeCtx,
    );
    expect(res.status).toBe(200);
    expect(fakeCms.sync.kick).toHaveBeenCalledTimes(1);
  });
});
