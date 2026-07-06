import { describe, expect, it } from "vitest";

import { cloudflareStores, edgeVersionedCache } from "../cloudflare.js";
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

describe("cloudflareStores", () => {
  it("blobs 未指定でもメモリストアで動作する（bindingless）", async () => {
    const stores = cloudflareStores({});

    await stores.blobs?.put("b", new Uint8Array([9]));
    expect(await stores.blobs?.get("b")).toEqual(new Uint8Array([9]));
  });

  it("cache 未指定なら versionedCache は結線しない(find() 側の no-op 分岐コストを避ける)", () => {
    const stores = cloudflareStores({});
    expect(stores.versionedCache).toBeUndefined();
  });

  it("cache 指定時は versionedCache を結線する", async () => {
    const cache = makeFakeCache();
    const stores = cloudflareStores({ cache });
    expect(stores.versionedCache).toBeDefined();

    await stores.versionedCache?.put("posts", "hello", "v1", new Response("cached"));
    const hit = await stores.versionedCache?.get("posts", "hello", "v1");
    expect(await hit?.text()).toBe("cached");
  });
});
