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
    },
  },
  ensureSynced: vi.fn().mockResolvedValue(undefined),
}));

const { cms } = await import("../lib/cms");
const HomePage = (await import("../page")).default;
const PostPage = (await import("../posts/[slug]/page")).default;
const { generateStaticParams } = await import("../posts/[slug]/page");

const PARAGRAPH_BLOCK = {
  id: "b1",
  type: "paragraph",
  data: {
    rich_text: [
      { type: "text", plain_text: "内容", annotations: {}, href: null },
    ],
  },
};

describe("HomePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cms.posts.list() を呼び出してページリストを取得する", async () => {
    vi.mocked(cms.posts.list).mockResolvedValue({
      items: [{ slug: "hello", version: "v1", listed: true, meta: {} }],
      nextCursor: null,
      hasMore: false,
    });
    await HomePage();
    expect(cms.posts.list).toHaveBeenCalled();
  });
});

describe("generateStaticParams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() の slug から静的パラメータを組み立てる", async () => {
    vi.mocked(cms.posts.list).mockResolvedValue({
      items: [{ slug: "hello", version: "v1", listed: true, meta: {} }],
      nextCursor: null,
      hasMore: false,
    });
    expect(await generateStaticParams()).toEqual([{ slug: "hello" }]);
  });
});

describe("PostPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページ詳細を取得し、正規化ブロックを React 描画する", async () => {
    vi.mocked(cms.posts.find).mockResolvedValue({
      collection: "posts",
      slug: "hello",
      version: "v1",
      meta: {
        id: "id-1",
        slug: "hello",
        lastEditedTime: "v1",
        publishedAt: "2024-01-01",
      },
      blocks: [PARAGRAPH_BLOCK],
      images: {},
      links: {},
    } as never);
    await PostPage({ params: Promise.resolve({ slug: "hello" }) });
    expect(cms.posts.find).toHaveBeenCalledWith("hello");
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
