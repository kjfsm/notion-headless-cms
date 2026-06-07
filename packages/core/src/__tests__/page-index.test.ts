import { describe, expect, it } from "vitest";
import {
  buildPageIndex,
  createPageLinkResolver,
  normalizePageId,
  type PageIndexSource,
} from "../page-index";
import type { BaseContentItem } from "../types/content";

// list() だけを持つ最小のコレクションクライアントを偽装する。
// （逆引きは list() の id/slug/title しか参照しないため他メソッドは不要）
function fakeCollection(items: BaseContentItem[]) {
  return { list: async () => items };
}

function fakeItem(
  id: string,
  slug: string,
  title?: string | null,
): BaseContentItem {
  return { id, slug, title, lastEditedTime: "2024-01-01T00:00:00.000Z" };
}

/** collections と各コレクションクライアントを spread した CMS 風オブジェクトを作る。 */
function fakeSource(
  cols: Record<string, BaseContentItem[]>,
): PageIndexSource & Record<string, unknown> {
  const source: Record<string, unknown> = {
    collections: Object.keys(cols),
  };
  for (const [name, items] of Object.entries(cols)) {
    source[name] = fakeCollection(items);
  }
  return source as PageIndexSource & Record<string, unknown>;
}

describe("normalizePageId", () => {
  it("ダッシュ除去と小文字化で表記揺れを吸収する", () => {
    const dashed = "1A2B3C4D-5E6F-7081-9203-A4B5C6D7E8F9";
    const compact = "1a2b3c4d5e6f70819203a4b5c6d7e8f9";
    expect(normalizePageId(dashed)).toBe(compact);
    expect(normalizePageId(compact)).toBe(compact);
  });
});

describe("buildPageIndex", () => {
  it("複数コレクションを横断して pageId 逆引きマップを作る", async () => {
    const source = fakeSource({
      posts: [
        fakeItem("11111111-1111-1111-1111-111111111111", "hello", "Hello"),
      ],
      docs: [
        fakeItem("22222222-2222-2222-2222-222222222222", "intro", "Intro"),
      ],
    });

    const index = await buildPageIndex(source);

    expect(
      index.get(normalizePageId("11111111111111111111111111111111")),
    ).toEqual({ collection: "posts", slug: "hello", title: "Hello" });
    expect(
      index.get(normalizePageId("22222222222222222222222222222222")),
    ).toEqual({ collection: "docs", slug: "intro", title: "Intro" });
  });

  it("collections オプションで走査対象を限定できる", async () => {
    const source = fakeSource({
      posts: [fakeItem("aaaaaaaa-1111-1111-1111-111111111111", "a")],
      drafts: [fakeItem("bbbbbbbb-2222-2222-2222-222222222222", "b")],
    });

    const index = await buildPageIndex(source, { collections: ["posts"] });

    expect(index.size).toBe(1);
    expect(
      index.get(normalizePageId("aaaaaaaa111111111111111111111111")),
    ).toBeDefined();
  });
});

describe("createPageLinkResolver", () => {
  const source = fakeSource({
    posts: [
      fakeItem("33333333-3333-3333-3333-333333333333", "my-post", "My Post"),
    ],
  });
  const known = "33333333-3333-3333-3333-333333333333";

  it("既定 URL は /${collection}/${slug}、タイトルも解決する", async () => {
    const { resolvePageUrl, resolvePageTitle } =
      await createPageLinkResolver(source);
    // ダッシュ無し ID でも解決できる
    expect(resolvePageUrl("33333333333333333333333333333333")).toBe(
      "/posts/my-post",
    );
    expect(resolvePageTitle(known)).toBe("My Post");
  });

  it("url オプションで URL 規約を上書きできる", async () => {
    const { resolvePageUrl } = await createPageLinkResolver(source, {
      url: (entry) => `/${entry.slug}`,
    });
    expect(resolvePageUrl(known)).toBe("/my-post");
  });

  it("未登録 ID は undefined を返す（renderer のフォールバックに委ねる）", async () => {
    const { resolvePageUrl, resolvePageTitle } =
      await createPageLinkResolver(source);
    const unknown = "99999999-9999-9999-9999-999999999999";
    expect(resolvePageUrl(unknown)).toBeUndefined();
    expect(resolvePageTitle(unknown)).toBeUndefined();
  });

  it("事前構築済みインデックスを再利用できる", async () => {
    const index = await buildPageIndex(source);
    const { resolvePageUrl } = await createPageLinkResolver(source, { index });
    expect(resolvePageUrl(known)).toBe("/posts/my-post");
  });
});
