import { describe, expect, it } from "vitest";
import { memoryCache } from "../cache/memory";
import type { CachedItemContent, CachedItemMeta } from "../types/index";

const makeItem = (slug: string) => ({
  id: `id-${slug}`,
  slug,
  status: "公開",
  publishedAt: "2024-01-01",
  lastEditedTime: "2024-01-01",
});

const makeMeta = (slug: string): CachedItemMeta => ({
  item: makeItem(slug),
  notionUpdatedAt: "2024-01-01T00:00:00.000Z",
  cachedAt: Date.now(),
});

const makeContent = (slug: string): CachedItemContent => ({
  html: `<p>${slug}</p>`,
  markdown: `# ${slug}`,
  blocks: [],
  notionUpdatedAt: "2024-01-01T00:00:00.000Z",
  cachedAt: Date.now(),
});

describe("memoryCache — DocumentCacheOps", () => {
  it("初期状態で getList は null を返す", async () => {
    const cache = memoryCache();
    expect(await cache.doc?.getList("posts")).toBeNull();
  });

  it("setList → getList でデータを保持する", async () => {
    const cache = memoryCache();
    const items = [makeItem("a"), makeItem("b")];
    await cache.doc?.setList("posts", { items, cachedAt: 1234 });
    const result = await cache.doc?.getList("posts");
    expect(result?.items).toHaveLength(2);
    expect(result?.cachedAt).toBe(1234);
  });

  it("初期状態で getMeta は null を返す", async () => {
    const cache = memoryCache();
    expect(await cache.doc?.getMeta("posts", "nonexistent")).toBeNull();
  });

  it("setMeta → getMeta でデータを保持する", async () => {
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "my-post", makeMeta("my-post"));
    const result = await cache.doc?.getMeta("posts", "my-post");
    expect(result?.item.slug).toBe("my-post");
  });

  it("setContent → getContent でデータを保持する", async () => {
    const cache = memoryCache();
    await cache.doc?.setContent("posts", "my-post", makeContent("my-post"));
    const result = await cache.doc?.getContent("posts", "my-post");
    expect(result?.html).toBe("<p>my-post</p>");
  });

  it("メタと本文は独立に保持される（meta セットだけでは content は null）", async () => {
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    expect(await cache.doc?.getMeta("posts", "a")).not.toBeNull();
    expect(await cache.doc?.getContent("posts", "a")).toBeNull();
  });

  it("invalidate('all') で全データをクリアする", async () => {
    const cache = memoryCache();
    await cache.doc?.setList("posts", { items: [makeItem("a")], cachedAt: 0 });
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    await cache.doc?.setContent("posts", "a", makeContent("a"));
    await cache.doc?.invalidate("all");
    expect(await cache.doc?.getList("posts")).toBeNull();
    expect(await cache.doc?.getMeta("posts", "a")).toBeNull();
    expect(await cache.doc?.getContent("posts", "a")).toBeNull();
  });

  it("invalidate({ collection, slug }) で対象スラッグのみクリアする", async () => {
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    await cache.doc?.setContent("posts", "a", makeContent("a"));
    await cache.doc?.setMeta("posts", "b", makeMeta("b"));
    await cache.doc?.invalidate({ collection: "posts", slug: "a" });
    expect(await cache.doc?.getMeta("posts", "a")).toBeNull();
    expect(await cache.doc?.getContent("posts", "a")).toBeNull();
    expect(await cache.doc?.getMeta("posts", "b")).not.toBeNull();
  });

  it("invalidate({ ..., kind: 'content' }) で本文のみクリアし meta は残す", async () => {
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    await cache.doc?.setContent("posts", "a", makeContent("a"));
    await cache.doc?.invalidate({
      collection: "posts",
      slug: "a",
      kind: "content",
    });
    expect(await cache.doc?.getMeta("posts", "a")).not.toBeNull();
    expect(await cache.doc?.getContent("posts", "a")).toBeNull();
  });

  it("invalidate({ collection }) でコレクション全体のアイテムをクリアする", async () => {
    const cache = memoryCache();
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    await cache.doc?.setContent("posts", "a", makeContent("a"));
    await cache.doc?.setMeta("posts", "b", makeMeta("b"));
    await cache.doc?.setMeta("pages", "c", makeMeta("c"));
    await cache.doc?.invalidate({ collection: "posts" });
    expect(await cache.doc?.getMeta("posts", "a")).toBeNull();
    expect(await cache.doc?.getContent("posts", "a")).toBeNull();
    expect(await cache.doc?.getMeta("posts", "b")).toBeNull();
    // 別コレクションはクリアされない
    expect(await cache.doc?.getMeta("pages", "c")).not.toBeNull();
  });

  it("maxItems 指定時に LRU で古いエントリが退避される", async () => {
    const cache = memoryCache({ maxItems: 2 });
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    await cache.doc?.setMeta("posts", "b", makeMeta("b"));
    await cache.doc?.setMeta("posts", "c", makeMeta("c"));
    expect(await cache.doc?.getMeta("posts", "a")).toBeNull();
    expect(await cache.doc?.getMeta("posts", "b")).not.toBeNull();
    expect(await cache.doc?.getMeta("posts", "c")).not.toBeNull();
  });

  it("getMeta でアクセスされたエントリは LRU の末尾に移動する", async () => {
    const cache = memoryCache({ maxItems: 2 });
    await cache.doc?.setMeta("posts", "a", makeMeta("a"));
    await cache.doc?.setMeta("posts", "b", makeMeta("b"));
    await cache.doc?.getMeta("posts", "a");
    await cache.doc?.setMeta("posts", "c", makeMeta("c"));
    expect(await cache.doc?.getMeta("posts", "a")).not.toBeNull();
    expect(await cache.doc?.getMeta("posts", "b")).toBeNull();
    expect(await cache.doc?.getMeta("posts", "c")).not.toBeNull();
  });

  it("setContent でも maxItems 超過分が LRU で退避される", async () => {
    const cache = memoryCache({ maxItems: 2 });
    await cache.doc?.setContent("posts", "a", makeContent("a"));
    await cache.doc?.setContent("posts", "b", makeContent("b"));
    await cache.doc?.setContent("posts", "c", makeContent("c"));
    expect(await cache.doc?.getContent("posts", "a")).toBeNull();
    expect(await cache.doc?.getContent("posts", "b")).not.toBeNull();
    expect(await cache.doc?.getContent("posts", "c")).not.toBeNull();
  });

  it("getContent でアクセスされたエントリは LRU の末尾に移動する", async () => {
    const cache = memoryCache({ maxItems: 2 });
    await cache.doc?.setContent("posts", "a", makeContent("a"));
    await cache.doc?.setContent("posts", "b", makeContent("b"));
    await cache.doc?.getContent("posts", "a");
    await cache.doc?.setContent("posts", "c", makeContent("c"));
    expect(await cache.doc?.getContent("posts", "a")).not.toBeNull();
    expect(await cache.doc?.getContent("posts", "b")).toBeNull();
    expect(await cache.doc?.getContent("posts", "c")).not.toBeNull();
  });

  it("同じスラッグで上書き setMeta すると最新値が保持される", async () => {
    const cache = memoryCache();
    const first = makeMeta("a");
    const second = { ...first, cachedAt: first.cachedAt + 1000 };
    await cache.doc?.setMeta("posts", "a", first);
    await cache.doc?.setMeta("posts", "a", second);
    const result = await cache.doc?.getMeta("posts", "a");
    expect(result?.cachedAt).toBe(second.cachedAt);
  });

  it("同じスラッグで上書き setContent すると最新値が保持される", async () => {
    const cache = memoryCache();
    const first = makeContent("a");
    const second = { ...first, html: "<p>updated</p>" };
    await cache.doc?.setContent("posts", "a", first);
    await cache.doc?.setContent("posts", "a", second);
    const result = await cache.doc?.getContent("posts", "a");
    expect(result?.html).toBe("<p>updated</p>");
  });
});

describe("memoryCache — ImageCacheOps", () => {
  it("初期状態で get は null を返す", async () => {
    const cache = memoryCache();
    expect(await cache.img?.get("hash")).toBeNull();
  });

  it("set → get でデータを保持する", async () => {
    const cache = memoryCache();
    const data = new ArrayBuffer(4);
    await cache.img?.set("hash123", data, "image/png");
    const result = await cache.img?.get("hash123");
    expect(result?.contentType).toBe("image/png");
    expect(result?.data).toBe(data);
  });

  it("maxItems 指定時に LRU で古いエントリが退避される", async () => {
    const cache = memoryCache({ maxItems: 2 });
    await cache.img?.set("a", new ArrayBuffer(8), "image/png");
    await cache.img?.set("b", new ArrayBuffer(8), "image/png");
    await cache.img?.set("c", new ArrayBuffer(8), "image/png");
    expect(await cache.img?.get("a")).toBeNull();
    expect(await cache.img?.get("b")).not.toBeNull();
    expect(await cache.img?.get("c")).not.toBeNull();
  });

  it("maxSizeBytes 指定時に合計サイズを超えるエントリを退避する", async () => {
    const cache = memoryCache({ maxSizeBytes: 20 });
    await cache.img?.set("a", new ArrayBuffer(10), "image/png");
    await cache.img?.set("b", new ArrayBuffer(10), "image/png");
    await cache.img?.set("c", new ArrayBuffer(10), "image/png");
    expect(await cache.img?.get("a")).toBeNull();
    expect(await cache.img?.get("b")).not.toBeNull();
    expect(await cache.img?.get("c")).not.toBeNull();
  });

  it("同じハッシュで上書きセットすると古いデータが置き換わる", async () => {
    const cache = memoryCache();
    const data1 = new ArrayBuffer(8);
    const data2 = new ArrayBuffer(16);
    await cache.img?.set("hash-abc", data1, "image/png");
    await cache.img?.set("hash-abc", data2, "image/jpeg");
    const result = await cache.img?.get("hash-abc");
    expect(result?.contentType).toBe("image/jpeg");
    expect(result?.data).toBe(data2);
  });
});

describe("memoryCache — handles と name", () => {
  it("handles に document と image が含まれる", () => {
    const cache = memoryCache();
    expect(cache.handles).toContain("document");
    expect(cache.handles).toContain("image");
  });

  it("name は 'memory' である", () => {
    const cache = memoryCache();
    expect(cache.name).toBe("memory");
  });

  it("doc と img が定義されている", () => {
    const cache = memoryCache();
    expect(cache.doc).toBeDefined();
    expect(cache.img).toBeDefined();
  });
});
