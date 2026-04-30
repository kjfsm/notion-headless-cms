import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPost, getPosts } from "../lib/data.js";

function makeFakeCms() {
  return {
    posts: {
      list: vi.fn(),
      find: vi.fn(),
    },
  };
}

describe("getPosts()", () => {
  it("cms.posts.list() の結果をそのまま返す", async () => {
    const cms = makeFakeCms();
    cms.posts.list.mockResolvedValue([{ slug: "hello" }]);
    const result = await getPosts(cms as never);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("hello");
  });
});

describe("getPost()", () => {
  beforeEach(() => {});

  it("投稿が存在する場合は post と html を返す", async () => {
    const cms = makeFakeCms();
    cms.posts.find.mockResolvedValue({
      id: "id-1",
      slug: "hello",
      html: vi.fn().mockResolvedValue("<p>内容</p>"),
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
