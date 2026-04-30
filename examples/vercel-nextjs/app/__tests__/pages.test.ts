import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("../lib/cms", () => ({
  cms: {
    posts: {
      list: vi.fn(),
      find: vi.fn(),
      params: vi.fn(),
    },
  },
}));

const { cms } = await import("../lib/cms");
const HomePage = (await import("../page")).default;
const PostPage = (await import("../posts/[slug]/page")).default;

describe("HomePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cms.posts.list() を呼び出してページリストを取得する", async () => {
    vi.mocked(cms.posts.list).mockResolvedValue([
      { slug: "hello", title: "Hello World" } as never,
    ]);
    await HomePage();
    expect(cms.posts.list).toHaveBeenCalled();
  });
});

describe("PostPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページ詳細を取得して html() を呼ぶ", async () => {
    const mockHtml = vi.fn().mockResolvedValue("<p>内容</p>");
    vi.mocked(cms.posts.find).mockResolvedValue({
      id: "id-1",
      slug: "hello",
      publishedAt: "2024-01-01",
      html: mockHtml,
    } as never);
    await PostPage({ params: Promise.resolve({ slug: "hello" }) });
    expect(cms.posts.find).toHaveBeenCalledWith("hello");
    expect(mockHtml).toHaveBeenCalled();
  });

  it("存在しないスラグは notFound() を呼ぶ", async () => {
    vi.mocked(cms.posts.find).mockResolvedValue(null);
    const { notFound } = await import("next/navigation");
    await expect(
      PostPage({ params: Promise.resolve({ slug: "not-found" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
