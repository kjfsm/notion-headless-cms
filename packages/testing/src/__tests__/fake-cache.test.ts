import type { BaseContentItem } from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import { createFakeCache, createFixtureClient } from "../index";

describe("createFakeCache", () => {
  it("doc + image 両方を担当する CacheAdapter を返す", () => {
    const adapter = createFakeCache();
    expect(adapter.handles).toEqual(["document", "image"]);
    expect(adapter.doc).toBeDefined();
    expect(adapter.img).toBeDefined();
  });

  it("doc.setMeta / getMeta が往復する", async () => {
    const adapter = createFakeCache();
    const meta = {
      item: {
        id: "1",
        slug: "hello",
        lastEditedTime: "2024-01-01",
      } as BaseContentItem,
      notionUpdatedAt: "2024-01-01",
      cachedAt: 0,
    };
    await adapter.doc?.setMeta("posts", "hello", meta);
    expect(await adapter.doc?.getMeta("posts", "hello")).toEqual(meta);
  });

  it("img.set / get が往復する", async () => {
    const adapter = createFakeCache();
    const data = new Uint8Array([1, 2, 3]).buffer;
    await adapter.img?.set("hash1", data, "image/png");
    const got = await adapter.img?.get("hash1");
    expect(got?.contentType).toBe("image/png");
    expect(got?.data.byteLength).toBe(3);
  });

  it("invalidate(all) で全キャッシュを破棄する", async () => {
    const adapter = createFakeCache();
    await adapter.doc?.setMeta("posts", "x", {
      item: { id: "1", slug: "x", lastEditedTime: "" } as BaseContentItem,
      notionUpdatedAt: "",
      cachedAt: 0,
    });
    await adapter.doc?.invalidate("all");
    expect(await adapter.doc?.getMeta("posts", "x")).toBeNull();
  });

  it("dump() で内部ストレージを参照できる", async () => {
    const adapter = createFakeCache();
    await adapter.doc?.setMeta("posts", "hello", {
      item: { id: "1", slug: "hello", lastEditedTime: "" } as BaseContentItem,
      notionUpdatedAt: "",
      cachedAt: 0,
    });
    const dump = adapter.dump();
    expect(dump.metas.size).toBe(1);
    expect(dump.metas.has("posts:hello")).toBe(true);
  });

  it("createFixtureClient はデフォルトで fake cache を 1 件挿す", async () => {
    const cms = createFixtureClient({
      items: [{ id: "1", slug: "hello", lastEditedTime: "2024-01-01" }],
    });
    await cms.posts.list();
    const cache = createFakeCache();
    const cms2 = createFixtureClient({
      items: [{ id: "1", slug: "hello", lastEditedTime: "2024-01-01" }],
      cache: [cache],
    });
    await cms2.posts.list();
    expect(cache.dump().lists.size).toBe(1);
  });
});
