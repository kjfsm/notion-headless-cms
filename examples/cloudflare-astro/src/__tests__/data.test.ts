import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPost, getPosts } from "../lib/data.js";

const PARAGRAPH_BLOCK = {
  id: "b1",
  type: "paragraph",
  data: {
    rich_text: [
      { type: "text", plain_text: "内容", annotations: {}, href: null },
    ],
  },
};

function makeFakeCms() {
  return {
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
  };
}

describe("getPosts()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("同期後に cms.posts.list() の結果をそのまま返す", async () => {
    const cms = makeFakeCms();
    cms.posts.list.mockResolvedValue({
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
    const result = await getPosts(cms as never);
    expect(cms.sync.kick).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.slug).toBe("hello");
  });
});

describe("getPost()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("投稿が存在する場合は post と html を返す", async () => {
    const cms = makeFakeCms();
    cms.posts.find.mockResolvedValue({
      collection: "posts",
      slug: "hello",
      version: "v1",
      meta: { id: "id-1", slug: "hello", lastEditedTime: "v1" },
      blocks: [PARAGRAPH_BLOCK],
      images: {},
      links: {},
    });
    const result = await getPost(cms as never, "hello");
    expect(result).not.toBeNull();
    expect(result?.html).toBe("<p>内容</p>");
    expect(result?.post.slug).toBe("hello");
  });

  it("投稿が存在しない場合は null を返す", async () => {
    const cms = makeFakeCms();
    cms.posts.find.mockResolvedValue(null);
    const result = await getPost(cms as never, "not-found");
    expect(result).toBeNull();
  });
});
