import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCMSError } from "../errors";
import { buildCacheImageFn } from "../image";
import type { ImageCacheOps } from "../types/index";

// ImageCacheOps には name フィールドがない（name は CacheAdapter 側）
const makeImageCache = (): ImageCacheOps & {
  store: Map<string, { data: ArrayBuffer; contentType?: string }>;
} => {
  const store = new Map<string, { data: ArrayBuffer; contentType?: string }>();
  return {
    store,
    get: vi.fn(async (hash: string) => store.get(hash) ?? null),
    set: vi.fn(async (hash: string, data: ArrayBuffer, contentType: string) => {
      store.set(hash, { data, contentType });
    }),
  };
};

const makeResponse = (
  status: number,
  body: ArrayBuffer = new ArrayBuffer(4),
  contentType = "image/jpeg",
) =>
  new Response(body, {
    status,
    headers: { "content-type": contentType },
  });

describe("buildCacheImageFn / fetchAndCacheImage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("キャッシュヒット時は fetch せずにプロキシ URL を返す", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeResponse(200, new ArrayBuffer(4), "image/png"),
    );
    const url = "https://example.com/test-cache-hit.jpg";
    const first = await cacheImage(url);
    expect(first).toMatch(/^\/api\/images\//);

    vi.clearAllMocks();
    const second = await cacheImage(url);
    expect(second).toBe(first);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetch 成功時にキャッシュ保存してプロキシ URL を返す", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    const body = new ArrayBuffer(8);
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeResponse(200, body, "image/webp"),
    );

    const url = "https://example.com/photo.webp";
    const result = await cacheImage(url);

    expect(result).toMatch(/^\/api\/images\//);
    expect(cache.set).toHaveBeenCalledOnce();
    const [, savedData, savedType] = vi.mocked(cache.set).mock.calls[0] ?? [];
    expect((savedData as ArrayBuffer).byteLength).toBe(body.byteLength);
    expect(savedType).toBe("image/webp");
  });

  it("HTTP 4xx で cache/image_fetch_failed CMSError をスローする", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(404));

    await expect(
      cacheImage("https://example.com/missing.jpg"),
    ).rejects.toMatchObject({
      code: "cache/image_fetch_failed",
    });
  });

  it("HTTP 5xx で cache/image_fetch_failed CMSError をスローする", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(500));

    await expect(
      cacheImage("https://example.com/error.jpg"),
    ).rejects.toMatchObject({
      code: "cache/image_fetch_failed",
    });
  });

  it("fetch がネットワークエラーをスローしたとき cache/io_failed CMSError をスローする", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error("network error"),
    );

    await expect(
      cacheImage("https://example.com/net-error.jpg"),
    ).rejects.toMatchObject({
      code: "cache/io_failed",
    });
  });

  it("Content-Type ヘッダから MIME タイプを取得する", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeResponse(200, new ArrayBuffer(4), "image/gif; charset=utf-8"),
    );

    await cacheImage("https://example.com/anim.gif");

    const [, , savedType] = vi.mocked(cache.set).mock.calls[0] ?? [];
    expect(savedType).toBe("image/gif");
  });

  it("Content-Type ヘッダなしの場合は cache/image_invalid_content_type CMSError をスローする", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(new ArrayBuffer(4), { status: 200, headers: {} }),
    );

    await expect(
      cacheImage("https://example.com/image.png?token=abc"),
    ).rejects.toSatisfy(
      (err: unknown) =>
        isCMSError(err) && err.code === "cache/image_invalid_content_type",
    );
  });

  it("image/* 以外の Content-Type の場合は cache/image_invalid_content_type CMSError をスローする", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(new ArrayBuffer(4), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(
      cacheImage("https://notion.so/signed/some-url"),
    ).rejects.toSatisfy(
      (err: unknown) =>
        isCMSError(err) && err.code === "cache/image_invalid_content_type",
    );
  });

  it("キャッシュミス時に logger.debug が「キャッシュミス」と「保存」で呼ばれる", async () => {
    const debugFn = vi.fn();
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images", {
      debug: debugFn,
    });
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeResponse(200, new ArrayBuffer(4), "image/png"),
    );

    await cacheImage("https://example.com/new-image.png");

    expect(debugFn).toHaveBeenCalledWith(
      "画像キャッシュミス、Notion からフェッチ",
      expect.objectContaining({ operation: "fetchAndCacheImage" }),
    );
    expect(debugFn).toHaveBeenCalledWith(
      "画像をキャッシュに保存",
      expect.objectContaining({ operation: "fetchAndCacheImage" }),
    );
  });

  it("Notion 署名 URL は署名クエリが変わっても同一ハッシュに収束し再 fetch しない", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    vi.mocked(globalThis.fetch).mockResolvedValue(
      makeResponse(200, new ArrayBuffer(4), "image/png"),
    );

    const base =
      "https://prod-files-secure.s3.us-west-2.amazonaws.com/abc/img.png";
    const first = await cacheImage(`${base}?X-Amz-Signature=AAA`);
    vi.clearAllMocks();
    // 署名クエリのみ異なる同一画像 → キー正規化で同一ハッシュ → fetch されない
    const second = await cacheImage(`${base}?X-Amz-Signature=BBB`);

    expect(second).toBe(first);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("外部画像 URL はクエリを保持し、クエリ違いは別ハッシュとして再 fetch する", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");
    // Response の body は 1 度しか読めないため、呼び出しごとに新しい Response を返す
    vi.mocked(globalThis.fetch).mockImplementation(async () =>
      makeResponse(200, new ArrayBuffer(4), "image/jpeg"),
    );

    const base = "https://images.unsplash.com/photo";
    const a = await cacheImage(`${base}?w=100`);
    const b = await cacheImage(`${base}?w=200`);

    expect(a).not.toBe(b);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("has を実装した cache では存在確認に has を使い get/fetch を呼ばない", async () => {
    const store = new Map<
      string,
      { data: ArrayBuffer; contentType?: string }
    >();
    const cache: ImageCacheOps = {
      get: vi.fn(async (hash: string) => store.get(hash) ?? null),
      set: vi.fn(),
      has: vi.fn(async () => true),
    };
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");

    const result = await cacheImage("https://example.com/has.png");

    expect(result).toMatch(/^\/api\/images\//);
    expect(cache.has).toHaveBeenCalledOnce();
    expect(cache.get).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("キャッシュヒット時に logger.debug が「キャッシュヒット」で呼ばれ fetch しない", async () => {
    const debugFn = vi.fn();
    const cache = makeImageCache();

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeResponse(200, new ArrayBuffer(4), "image/jpeg"),
    );
    const url = "https://example.com/cached-image.jpg";
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images", {
      debug: debugFn,
    });
    await cacheImage(url);

    vi.clearAllMocks();
    debugFn.mockClear();
    await cacheImage(url);

    expect(debugFn).toHaveBeenCalledWith(
      "画像キャッシュヒット",
      expect.objectContaining({ operation: "fetchAndCacheImage" }),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
