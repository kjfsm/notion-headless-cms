import { describe, expect, it, vi } from "vitest";
import { createClient } from "../cms";
import { CMSError, isCMSError } from "../errors";
import type { RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

// マルチソース構成 (sources: { notion: { posts, authors } } 等) で、片方の
// コレクションの DataSource が失敗しても他コレクションが影響を受けないこと、
// および失敗側のエラーが CMSError として正しく伝搬することを保証する。
// Issue #309 (S5) で要求された明示テスト。

const mockRenderer: RendererFn = vi.fn().mockResolvedValue("<p>x</p>");

function makeSource(
  name: string,
  items: BaseContentItem[],
  overrides: Partial<DataSource<BaseContentItem>> = {},
): DataSource<BaseContentItem> {
  return {
    name,
    list: vi.fn().mockResolvedValue(items),
    loadBlocks: vi.fn().mockResolvedValue([]),
    loadMarkdown: vi.fn().mockResolvedValue("# Hello"),
    getLastModified: (item) => item.lastEditedTime,
    getListVersion: () => "",
    ...overrides,
  };
}

function makeItem(slug: string, id = `id-${slug}`): BaseContentItem {
  return {
    id,
    slug,
    title: slug,
    lastEditedTime: "2026-01-01T00:00:00.000Z",
  };
}

describe("マルチソースのフェイルオーバー / 独立性 (Issue #309 / S5)", () => {
  it("posts.list が失敗しても authors.list は通る (コレクション間で分離)", async () => {
    // notion-source / notion-orm は source/fetch_items_failed CMSError を投げる契約。
    // それを模してマルチソース構成で片方だけ失敗させる。
    const failingSource = makeSource("notion-posts", [], {
      list: vi.fn().mockRejectedValue(
        new CMSError({
          code: "source/fetch_items_failed",
          message: "notion DB unavailable",
          context: { operation: "list" },
        }),
      ),
    });
    const healthySource = makeSource("notion-authors", [makeItem("alice")]);

    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        // Notion の posts と authors を別ソースで構成する想定。
        // 1 つのコレクションがエラーで止まっても他コレクションは独立に動く。
        mock: {
          collections: {
            posts: { source: failingSource, slugField: "slug" },
            authors: { source: healthySource, slugField: "slug" },
          },
        },
      },
    });

    await expect(cms.posts.list()).rejects.toSatisfy(
      (err: unknown) =>
        isCMSError(err) && err.code === "source/fetch_items_failed",
    );

    const authors = await cms.authors.list();
    expect(authors).toHaveLength(1);
    expect(authors[0]?.slug).toBe("alice");
  });

  it("posts.find が失敗しても再呼び出しは独立に試行され、回復時に成功する", async () => {
    let callCount = 0;
    const flakySource = makeSource("notion-posts", [makeItem("hello")], {
      // 1 回目だけ失敗、2 回目以降は成功するシナリオ。
      list: vi.fn().mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) {
          throw new CMSError({
            code: "source/fetch_items_failed",
            message: "transient notion 502",
            context: { operation: "list" },
          });
        }
        return [makeItem("hello")];
      }),
    });

    const cms = createClient({
      renderer: mockRenderer,
      sources: {
        mock: {
          collections: {
            posts: { source: flakySource, slugField: "slug" },
          },
        },
      },
    });

    await expect(cms.posts.find("hello")).rejects.toSatisfy(
      (err: unknown) =>
        isCMSError(err) && err.code === "source/fetch_items_failed",
    );

    const item = await cms.posts.find("hello");
    expect(item?.slug).toBe("hello");
  });
});
