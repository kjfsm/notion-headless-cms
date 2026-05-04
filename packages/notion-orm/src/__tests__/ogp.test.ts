import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheOgImage,
  createKvOgpCache,
  createOgpFetcher,
  createR2OgpImageCache,
  fetchOgp,
} from "../ogp";

const HTML = `
<html>
  <head>
    <meta property="og:title" content="Hello &amp; World" />
    <meta property="og:description" content="desc" />
    <meta property="og:image" content="https://example.com/img.jpg" />
    <meta property="og:site_name" content="Example" />
    <title>Fallback</title>
  </head>
</html>`;

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchOgp", () => {
  it("OG メタタグから値を抽出する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(HTML, { status: 200 }),
    );
    const ogp = await fetchOgp("https://example.com/");
    expect(ogp).toEqual({
      title: "Hello & World",
      description: "desc",
      image: "https://example.com/img.jpg",
      siteName: "Example",
    });
  });

  it("属性順序が逆でも抽出できる", async () => {
    const html = `<meta content="T" property="og:title">`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(html, { status: 200 }),
    );
    const ogp = await fetchOgp("https://example.com/");
    expect(ogp.title).toBe("T");
  });

  it("HTTP エラーは throw する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 }),
    );
    await expect(fetchOgp("https://example.com/")).rejects.toThrow(/HTTP 500/);
  });
});

describe("createOgpFetcher", () => {
  it("同 URL は再 fetch しない", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(HTML, { status: 200 }));
    const fetcher = createOgpFetcher();
    await fetcher("https://example.com/");
    await fetcher("https://example.com/");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("cacheOgImage", () => {
  const makeBucket = () => {
    const store = new Map<string, ArrayBuffer>();
    return {
      store,
      ops: {
        async get(hash: string) {
          const buf = store.get(hash);
          return buf ? { data: buf, contentType: "image/png" } : null;
        },
        async set(hash: string, data: ArrayBuffer) {
          store.set(hash, data);
        },
      },
    };
  };

  it("OG 画像を fetch してキャッシュし、プロキシ URL を返す", async () => {
    const bucket = makeBucket();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new ArrayBuffer(4), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const url = await cacheOgImage("https://cdn.example.com/a.png", {
      cache: bucket.ops,
      imageProxyBase: "/cms-image",
    });
    expect(url.startsWith("/cms-image/")).toBe(true);
    expect(bucket.store.size).toBe(1);
  });

  it("既存キャッシュがあれば fetch しない", async () => {
    const bucket = makeBucket();
    // 事前にハッシュを書き込む
    const url = "https://cdn.example.com/a.png";
    const { sha256Hex } = await import("@notion-headless-cms/core");
    const hash = await sha256Hex(url);
    await bucket.ops.set(hash, new ArrayBuffer(2));
    const spy = vi.spyOn(globalThis, "fetch");
    const proxy = await cacheOgImage(url, {
      cache: bucket.ops,
      imageProxyBase: "/cms-image",
    });
    expect(proxy).toBe(`/cms-image/${hash}`);
    expect(spy).not.toHaveBeenCalled();
  });

  it("HTTP 失敗時は元 URL を返す（フォールバック）", async () => {
    const bucket = makeBucket();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );
    const url = await cacheOgImage("https://cdn.example.com/missing.png", {
      cache: bucket.ops,
      imageProxyBase: "/cms-image",
    });
    expect(url).toBe("https://cdn.example.com/missing.png");
  });
});

describe("createKvOgpCache", () => {
  const makeKv = () => {
    const store = new Map<string, string>();
    return {
      store,
      kv: {
        async get(key: string, _type: "text") {
          return store.get(key) ?? null;
        },
        async put(key: string, value: string) {
          store.set(key, value);
        },
      },
    };
  };

  it("set した OGP を get で取得できる", async () => {
    const { kv } = makeKv();
    const cache = createKvOgpCache(kv);
    await cache.set("https://example.com/", {
      title: "Test",
      description: "d",
    });
    const result = await cache.get("https://example.com/");
    expect(result).toEqual({ title: "Test", description: "d" });
  });

  it("存在しないキーは null を返す", async () => {
    const { kv } = makeKv();
    const cache = createKvOgpCache(kv);
    expect(await cache.get("https://missing.example/")).toBeNull();
  });

  it("prefix オプションがキーに付く", async () => {
    const { kv, store } = makeKv();
    const cache = createKvOgpCache(kv, { prefix: "custom:" });
    await cache.set("https://example.com/", { title: "T" });
    expect(store.has("custom:https://example.com/")).toBe(true);
  });
});

describe("createR2OgpImageCache", () => {
  const makeR2 = () => {
    const store = new Map<
      string,
      { data: ArrayBuffer; contentType?: string }
    >();
    return {
      store,
      bucket: {
        async get(key: string) {
          const entry = store.get(key);
          if (!entry) return null;
          return {
            arrayBuffer: async () => entry.data,
            httpMetadata: { contentType: entry.contentType },
          };
        },
        async put(
          key: string,
          value: ArrayBuffer,
          opts?: { httpMetadata?: { contentType?: string } },
        ) {
          store.set(key, {
            data: value,
            contentType: opts?.httpMetadata?.contentType,
          });
        },
      },
    };
  };

  it("R2 バケットを OgpImageCacheBinding に変換する", async () => {
    const { bucket } = makeR2();
    const binding = createR2OgpImageCache(bucket, "/api/images");
    expect(binding.imageProxyBase).toBe("/api/images");
    expect(binding.cacheName).toBe("r2-ogp");
  });

  it("cache.set / cache.get が R2 に書き込む", async () => {
    const { bucket, store } = makeR2();
    const binding = createR2OgpImageCache(bucket, "/api/images");
    const buf = new ArrayBuffer(4);
    await binding.cache.set("abc123", buf, "image/png");
    expect(store.has("ogp-images/abc123")).toBe(true);
    const got = await binding.cache.get("abc123");
    expect(got).not.toBeNull();
    expect(got?.contentType).toBe("image/png");
  });

  it("prefix オプションがキーに付く", async () => {
    const { bucket, store } = makeR2();
    const binding = createR2OgpImageCache(bucket, "/api/images", {
      prefix: "custom-ogp/",
    });
    await binding.cache.set("hash1", new ArrayBuffer(2), "image/jpeg");
    expect(store.has("custom-ogp/hash1")).toBe(true);
  });
});
