import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

const fakeCms = {
  posts: {
    list: vi.fn(),
    find: vi.fn(),
  },
};

vi.mock("../lib/cms", () => ({
  getCms: vi.fn().mockReturnValue(fakeCms),
  ensureSynced: vi.fn().mockResolvedValue(fakeCms),
}));

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
    await HomePage();
    expect(fakeCms.posts.list).toHaveBeenCalled();
  });
});

describe("generateStaticParams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() の slug から静的パラメータを組み立てる", async () => {
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
    expect(await generateStaticParams()).toEqual([{ slug: "hello" }]);
  });
});

describe("PostPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページ詳細を取得し、正規化ブロックを React 描画する", async () => {
    fakeCms.posts.find.mockResolvedValue({
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
    expect(fakeCms.posts.find).toHaveBeenCalledWith("hello");
  });

  it("存在しないスラグは notFound() を呼ぶ", async () => {
    fakeCms.posts.find.mockResolvedValue(null);
    const { notFound } = await import("next/navigation");
    await expect(
      PostPage({ params: Promise.resolve({ slug: "not-found" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
