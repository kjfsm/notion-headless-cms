import { describe, expect, it } from "vitest";
import { edgeVersionedCache } from "../cloudflare.js";
import type { VersionedCacheLike } from "../store/versioned-cache.js";

function makeFakeCache(): VersionedCacheLike {
  const store = new Map<string, Response>();
  return {
    async match(request) {
      return store.get(request);
    },
    async put(request, response) {
      store.set(request, response);
    },
  };
}

describe("edgeVersionedCache", () => {
  it("明示注入した cache に version キーで get/put する", async () => {
    const layer = edgeVersionedCache(makeFakeCache());
    await layer.put("posts", "hello", "v1", new Response("cached"));

    const hit = await layer.get("posts", "hello", "v1");
    expect(await hit?.text()).toBe("cached");

    // version が変われば別キー扱いでミスする（purge 不要の要）
    expect(await layer.get("posts", "hello", "v2")).toBeUndefined();
  });

  it("cache 未指定なら全経路 no-op", async () => {
    const layer = edgeVersionedCache();
    await layer.put("posts", "hello", "v1", new Response("x"));
    expect(await layer.get("posts", "hello", "v1")).toBeUndefined();
  });
});
