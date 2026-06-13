import type { BaseContentItem } from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import { createFakeNotionSource, createFixtureClient } from "../index";

interface Post extends BaseContentItem {
  title: string;
}

const samplePosts: Post[] = [
  {
    id: "1",
    slug: "hello",
    title: "Hello",
    lastEditedTime: "2024-01-01T00:00:00Z",
    status: "公開済み",
  },
  {
    id: "2",
    slug: "draft",
    title: "Draft",
    lastEditedTime: "2024-01-02T00:00:00Z",
    status: "下書き",
  },
  {
    id: "3",
    slug: "archived",
    title: "Archived",
    lastEditedTime: "2024-01-03T00:00:00Z",
    status: "公開済み",
    isArchived: true,
  },
];

describe("createFakeNotionSource", () => {
  it("items から単一 posts コレクションの CMSAdapter を返す", () => {
    const adapter = createFakeNotionSource({ items: samplePosts });
    expect(adapter.collections).toHaveProperty("posts");
    expect(adapter.collections.posts?.slugField).toBe("slug");
  });

  it("DataSource.list() が isArchived を除外して返す", async () => {
    const adapter = createFakeNotionSource({ items: samplePosts });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    const all = await source.list();
    expect(all.map((it) => it.slug)).toEqual(["hello", "draft"]);
  });

  it("publishedStatuses を渡すとフィルタされる", async () => {
    const adapter = createFakeNotionSource({ items: samplePosts });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    const published = await source.list({ publishedStatuses: ["公開済み"] });
    expect(published.map((it) => it.slug)).toEqual(["hello"]);
  });

  it("findByProp で slug 検索できる", async () => {
    const adapter = createFakeNotionSource({ items: samplePosts });
    const source = adapter.collections.posts?.source;
    if (!source) throw new Error("posts source missing");
    const found = await source.findByProp?.("slug", "hello");
    expect(found?.id).toBe("1");
  });

  it("collections 複数指定で名前ごとに source を作る", async () => {
    const adapter = createFakeNotionSource({
      collections: {
        posts: { items: samplePosts },
        news: { items: [] },
      },
    });
    expect(Object.keys(adapter.collections).sort()).toEqual(["news", "posts"]);
  });
});

describe("createFixtureClient", () => {
  it("items だけで動く CMSClient を組み立てる", async () => {
    const cms = createFixtureClient({ items: samplePosts });
    const list = await cms.posts.list();
    expect(list).toHaveLength(2);
  });

  it("find(slug) → render() で fakeRenderer の出力が返る", async () => {
    const cms = createFixtureClient({ items: samplePosts });
    const post = await cms.posts.find("hello");
    if (!post) throw new Error("post not found");
    const html = await post.html();
    expect(html).toContain("<article>");
    expect(html).toContain("# Hello");
  });

  it("publishedStatuses 指定でフィルタされた list を返す", async () => {
    // collections 形式は CMSClient<CollectionsConfig> (index signature) を返すので、
    // cms.posts は optional になる。テストでは事前に存在を確認してから使う。
    const cms = createFixtureClient({
      collections: {
        posts: {
          items: samplePosts,
          publishedStatuses: ["公開済み"],
        },
      },
    });
    const posts = cms.posts;
    if (!posts) throw new Error("posts collection missing");
    const list = await posts.list();
    expect(list.map((it) => it.slug)).toEqual(["hello"]);
  });

  it("renderer を明示的に上書きできる", async () => {
    const cms = createFixtureClient({
      items: samplePosts,
      renderer: () => Promise.resolve("<custom/>"),
    });
    const post = await cms.posts.find("hello");
    if (!post) throw new Error("post not found");
    expect(await post.html()).toBe("<custom/>");
  });
});
