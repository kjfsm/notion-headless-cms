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
    });
    const res = await app.request("/posts");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { slug: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].slug).toBe("hello");
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
    const res = await app.request("/posts/hello");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { html: string; item: { slug: string } };
    expect(body.html).toBe("<p>内容</p>");
    expect(body.item.slug).toBe("hello");
  });

  it("存在しないスラグは 404", async () => {
    vi.mocked(cms.posts.find).mockResolvedValue(null);
    const res = await app.request("/posts/not-found");
    expect(res.status).toBe(404);
  });
});

describe("GET /ui/posts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("記事一覧を HTML で返す", async () => {
    vi.mocked(cms.posts.list).mockResolvedValue({
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
    });
    const res = await app.request("/ui/posts");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("/ui/posts/hello");
  });
});

describe("GET /ui/posts/:slug", () => {
  beforeEach(() => vi.clearAllMocks());

  it("記事詳細を HTML で返す", async () => {
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
    const res = await app.request("/ui/posts/hello");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<p>内容</p>");
    expect(body).toContain("hello");
  });

  it("存在しないスラグは HTML 404 を返す", async () => {
    vi.mocked(cms.posts.find).mockResolvedValue(null);
    const res = await app.request("/ui/posts/not-found");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

describe("GET /", () => {
  it("/ui へリダイレクトする", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/ui");
  });
});
