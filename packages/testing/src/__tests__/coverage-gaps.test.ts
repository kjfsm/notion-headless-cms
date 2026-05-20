/**
 * カバレッジ不足を埋めるためのテスト:
 * - `makeFakeDataSource` の `loadNotionBlocks` オプショナル経路
 * - `getListVersion(空配列)` の早期 return
 * - `findByProp` で slug 以外のプロパティ検索 (素朴走査)
 * - `createFakeCache.doc.invalidate(scope)` の細かい kind 分岐
 *   - 単一 slug + meta only / content only / all
 *   - collection 全体 + meta only / content only
 */
import type {
  BaseContentItem,
  CachedItemContent,
  CachedItemList,
  CachedItemMeta,
} from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import { createFakeCache, createFakeNotionSource } from "../index";

const meta = (slug: string): CachedItemMeta<BaseContentItem> => ({
  item: { id: slug, slug, lastEditedTime: "2024-01-01" },
  notionUpdatedAt: "2024-01-01",
  cachedAt: 0,
});
const content = (slug: string): CachedItemContent => ({
  bodyHtml: `<p>${slug}</p>`,
  bodyMd: `# ${slug}`,
  cachedAt: 0,
});
const list = (slugs: string[]): CachedItemList<BaseContentItem> => ({
  items: slugs.map((s) => ({
    id: s,
    slug: s,
    lastEditedTime: "2024-01-01",
  })),
  cachedAt: 0,
});

describe("createFakeNotionSource — オプショナル経路のカバレッジ", () => {
  it("loadNotionBlocks を指定すると DataSource が公開する", async () => {
    const adapter = createFakeNotionSource({
      collections: {
        posts: {
          items: [
            {
              id: "1",
              slug: "hello",
              lastEditedTime: "2024-01-01",
            },
          ],
          loadNotionBlocks: () => [{ type: "paragraph" }] as unknown[],
        },
      },
    });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    const loader = source.loadNotionBlocks;
    if (!loader) throw new Error("loadNotionBlocks should be defined");
    const blocks = await loader({
      id: "1",
      slug: "hello",
      lastEditedTime: "2024-01-01",
    });
    expect(blocks).toHaveLength(1);
  });

  it("getListVersion([]) は空文字を返す", async () => {
    const adapter = createFakeNotionSource({ items: [] });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    expect(source.getListVersion?.([])).toBe("");
  });

  it("findByProp で slug 以外のプロパティを走査する", async () => {
    const adapter = createFakeNotionSource({
      items: [
        {
          id: "1",
          slug: "a",
          lastEditedTime: "2024-01-01",
          // slug 以外のフィールドを検索対象にする
          extra: "match-me",
        } as BaseContentItem & { extra: string },
        {
          id: "2",
          slug: "b",
          lastEditedTime: "2024-01-02",
          extra: "no",
        } as BaseContentItem & { extra: string },
      ],
    });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    const hit = await source.findByProp?.("extra", "match-me");
    expect(hit?.id).toBe("1");
    const miss = await source.findByProp?.("extra", "nope");
    expect(miss).toBeNull();
  });

  it("loadMarkdown のオーバーライドが効く", async () => {
    const adapter = createFakeNotionSource({
      collections: {
        posts: {
          items: [{ id: "1", slug: "hello", lastEditedTime: "2024-01-01" }],
          loadMarkdown: () => "## override",
        },
      },
    });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    const md = await source.loadMarkdown({
      id: "1",
      slug: "hello",
      lastEditedTime: "2024-01-01",
    });
    expect(md).toBe("## override");
  });
});

describe("createFakeCache — invalidate(scope) の細かい分岐", () => {
  it("単一 slug + kind:meta のみ削除する", async () => {
    const adapter = createFakeCache();
    await adapter.doc?.setMeta("posts", "x", meta("x"));
    await adapter.doc?.setContent("posts", "x", content("x"));
    await adapter.doc?.invalidate({
      collection: "posts",
      slug: "x",
      kind: "meta",
    });
    expect(await adapter.doc?.getMeta("posts", "x")).toBeNull();
    expect(await adapter.doc?.getContent("posts", "x")).not.toBeNull();
  });

  it("単一 slug + kind:content のみ削除する", async () => {
    const adapter = createFakeCache();
    await adapter.doc?.setMeta("posts", "x", meta("x"));
    await adapter.doc?.setContent("posts", "x", content("x"));
    await adapter.doc?.invalidate({
      collection: "posts",
      slug: "x",
      kind: "content",
    });
    expect(await adapter.doc?.getMeta("posts", "x")).not.toBeNull();
    expect(await adapter.doc?.getContent("posts", "x")).toBeNull();
  });

  it("collection 全体 + kind:all で list/meta/content すべてクリア", async () => {
    const adapter = createFakeCache();
    await adapter.doc?.setList("posts", list(["x", "y"]));
    await adapter.doc?.setMeta("posts", "x", meta("x"));
    await adapter.doc?.setMeta("posts", "y", meta("y"));
    await adapter.doc?.setContent("posts", "x", content("x"));
    // 別 collection は影響を受けないことも確認
    await adapter.doc?.setMeta("news", "n1", meta("n1"));

    await adapter.doc?.invalidate({ collection: "posts" });

    expect(await adapter.doc?.getList("posts")).toBeNull();
    expect(await adapter.doc?.getMeta("posts", "x")).toBeNull();
    expect(await adapter.doc?.getMeta("posts", "y")).toBeNull();
    expect(await adapter.doc?.getContent("posts", "x")).toBeNull();
    expect(await adapter.doc?.getMeta("news", "n1")).not.toBeNull();
  });

  it("collection 全体 + kind:content のみで meta/list は残す", async () => {
    const adapter = createFakeCache();
    await adapter.doc?.setList("posts", list(["x"]));
    await adapter.doc?.setMeta("posts", "x", meta("x"));
    await adapter.doc?.setContent("posts", "x", content("x"));

    await adapter.doc?.invalidate({ collection: "posts", kind: "content" });

    expect(await adapter.doc?.getContent("posts", "x")).toBeNull();
    expect(await adapter.doc?.getMeta("posts", "x")).not.toBeNull();
    expect(await adapter.doc?.getList("posts")).not.toBeNull();
  });
});
