import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/cms.js", () => ({
  cms: {
    posts: {
      list: vi.fn(),
      get: vi.fn(),
      cache: { adjacent: vi.fn() },
    },
    $handler: vi
      .fn()
      .mockReturnValue(() => new Response("{}", { status: 200 })),
    $collections: ["posts"],
  },
}));

const { cms } = await import("../lib/cms.js");
const { app } = await import("../app.js");

describe("GET /posts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページリストを返す", async () => {
    vi.mocked(cms.posts.list).mockResolvedValue([
      { slug: "hello", title: "Hello World" } as never,
    ]);
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
    vi.mocked(cms.posts.get).mockResolvedValue({
      id: "id-1",
      slug: "hello",
      status: "公開済み",
      render: vi.fn().mockResolvedValue("<p>内容</p>"),
    } as never);
    const res = await app.request("/posts/hello");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { html: string; item: { slug: string } };
    expect(body.html).toBe("<p>内容</p>");
    expect(body.item.slug).toBe("hello");
  });

  it("存在しないスラグは 404", async () => {
    vi.mocked(cms.posts.get).mockResolvedValue(null);
    const res = await app.request("/posts/not-found");
    expect(res.status).toBe(404);
  });
});
