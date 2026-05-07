import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  posts: {
    list: vi.fn(),
    find: vi.fn(),
  },
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

describe("GET /posts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページリストを返す", async () => {
    fakeCms.posts.list.mockResolvedValue([
      { slug: "hello", title: "Hello World" },
    ]);
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
      id: "id-1",
      slug: "hello",
      html: vi.fn().mockResolvedValue("<p>内容</p>"),
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
