import { describe, expect, it } from "vitest";
import type { VersionedCacheLike } from "../versioned-cache.js";
import { createVersionedCacheLayer } from "../versioned-cache.js";

function fakeCache(): VersionedCacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    async match(request) {
      return store.get(request);
    },
    async put(request, response) {
      store.set(request, response);
    },
  };
}

function throwingCache(): VersionedCacheLike {
  return {
    async match() {
      throw new Error("cache unavailable");
    },
    async put() {
      throw new Error("cache unavailable");
    },
  };
}

describe("createVersionedCacheLayer", () => {
  it("cache 未指定時は get が常に undefined(workers.dev 等 Cache API 無効環境のフォールバック)", async () => {
    const layer = createVersionedCacheLayer({});
    expect(await layer.get("posts", "hello", "v1")).toBeUndefined();
    await expect(
      layer.put("posts", "hello", "v1", new Response("ok")),
    ).resolves.toBeUndefined();
  });

  it("cache 指定時は versioned key で put/get できる", async () => {
    const cache = fakeCache();
    const layer = createVersionedCacheLayer({ cache });
    await layer.put("posts", "hello", "v1", new Response("body"));
    const got = await layer.get("posts", "hello", "v1");
    expect(await got?.text()).toBe("body");
  });

  it("version が異なれば別キーになる(purge レス設計)", async () => {
    const cache = fakeCache();
    const layer = createVersionedCacheLayer({ cache });
    await layer.put("posts", "hello", "v1", new Response("old"));
    await layer.put("posts", "hello", "v2", new Response("new"));
    expect(await (await layer.get("posts", "hello", "v1"))?.text()).toBe("old");
    expect(await (await layer.get("posts", "hello", "v2"))?.text()).toBe("new");
  });

  it("Cache API が例外を投げても fail-soft で無視する(読者パスは KV+R2 直読みで成立する)", async () => {
    const layer = createVersionedCacheLayer({ cache: throwingCache() });
    await expect(layer.get("posts", "hello", "v1")).resolves.toBeUndefined();
    await expect(
      layer.put("posts", "hello", "v1", new Response("ok")),
    ).resolves.toBeUndefined();
  });
});
