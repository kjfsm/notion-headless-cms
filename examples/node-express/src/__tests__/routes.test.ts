import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/cms.js", () => ({
  cms: {
    posts: {
      list: vi.fn(),
      find: vi.fn(),
    },
    fetch: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
  },
  syncAll: vi.fn(),
}));

const { cms } = await import("../lib/cms.js");
const { app } = await import("../app.js");

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
    vi.mocked(cms.posts.list).mockResolvedValue({
      items: [{ slug: "hello", version: "v1", listed: true, meta: {} }],
      nextCursor: null,
      hasMore: false,
    });
    const res = await request(app).get("/posts");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe("hello");
  });
});

describe("GET /posts/:slug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページ詳細と HTML を返す", async () => {
    vi.mocked(cms.posts.find).mockResolvedValue({
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
    } as never);
    const res = await request(app).get("/posts/hello");
    expect(res.status).toBe(200);
    expect(res.body.html).toBe("<p>内容</p>");
    expect(res.body.item.slug).toBe("hello");
  });

  it("存在しないスラグは 404", async () => {
    vi.mocked(cms.posts.find).mockResolvedValue(null);
    const res = await request(app).get("/posts/not-found");
    expect(res.status).toBe(404);
  });
});
