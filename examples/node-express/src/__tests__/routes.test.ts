import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/cms.js", () => ({
  cms: {
    posts: {
      list: vi.fn(),
      find: vi.fn(),
    },
    $getCachedImage: vi.fn(),
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
      id: "id-1",
      slug: "hello",
      html: vi.fn().mockResolvedValue("<p>内容</p>"),
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
