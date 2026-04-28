import { describe, expect, it } from "vitest";
import { memoryCache } from "../index";

describe("memoryCache", () => {
  it("doc + image 両方を担当する CacheAdapter を返す", () => {
    const adapter = memoryCache();
    expect(adapter.name).toBe("memory");
    expect(adapter.handles).toEqual(["document", "image"]);
    expect(adapter.doc).toBeDefined();
    expect(adapter.img).toBeDefined();
  });

  it("doc.setMeta / getMeta が正しく往復する", async () => {
    const adapter = memoryCache();
    const meta = {
      item: { id: "1", slug: "hello", lastEditedTime: "2024-01-01" },
      notionUpdatedAt: "2024-01-01",
      cachedAt: Date.now(),
    };
    await adapter.doc?.setMeta("posts", "hello", meta);
    const got = await adapter.doc?.getMeta("posts", "hello");
    expect(got).toEqual(meta);
  });

  it("img.set / get が正しく往復する", async () => {
    const adapter = memoryCache();
    const data = new Uint8Array([1, 2, 3]).buffer;
    await adapter.img?.set("hash1", data, "image/png");
    const got = await adapter.img?.get("hash1");
    expect(got?.contentType).toBe("image/png");
    expect(got?.data.byteLength).toBe(3);
  });

  it("invalidate(all) で全キャッシュを破棄する", async () => {
    const adapter = memoryCache();
    await adapter.doc?.setMeta("posts", "x", {
      item: { id: "1", slug: "x", lastEditedTime: "" },
      notionUpdatedAt: "",
      cachedAt: 0,
    });
    await adapter.doc?.invalidate("all");
    expect(await adapter.doc?.getMeta("posts", "x")).toBeNull();
  });
});
