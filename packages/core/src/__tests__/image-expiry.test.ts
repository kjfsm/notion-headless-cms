import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCacheImageFn } from "../image";
import type { ImageCacheOps } from "../types/index";

// Notion の署名画像 URL は約 1 時間で失効する。core 側では SHA256 ハッシュキーで
// 永続キャッシュに保存するため、1h 経過後の再リクエストでも Notion を再 fetch せず
// キャッシュから返せるはずだが、回帰テストとして fakeTimers で明示検証する。
// Issue #309 (S5) で要求された明示テスト。

const ONE_HOUR_MS = 60 * 60 * 1000;

function makeImageCache(): ImageCacheOps & {
  store: Map<string, { data: ArrayBuffer; contentType?: string }>;
} {
  const store = new Map<string, { data: ArrayBuffer; contentType?: string }>();
  return {
    store,
    get: vi.fn(async (hash: string) => store.get(hash) ?? null),
    set: vi.fn(async (hash: string, data: ArrayBuffer, contentType: string) => {
      store.set(hash, { data, contentType });
    }),
  };
}

function makeResponse(
  status: number,
  body: ArrayBuffer = new ArrayBuffer(4),
  contentType = "image/png",
) {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("画像キャッシュの 1 時間失効耐性 (Issue #309 / S5)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00.000Z"));
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("初回フェッチ後、1 時間以上経過しても fetch せずキャッシュから返す", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      makeResponse(200, new ArrayBuffer(8), "image/jpeg"),
    );

    // Notion 署名 URL は 1 回だけフェッチされ、SHA256 キーでキャッシュされる。
    const url = "https://prod-files-secure.s3.amazonaws.com/abc/signed.jpg";
    const first = await cacheImage(url);
    expect(first).toMatch(/^\/api\/images\//);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // 1 時間 + 1 秒進める (Notion 署名 URL が失効するタイミング)。
    vi.advanceTimersByTime(ONE_HOUR_MS + 1000);

    vi.mocked(globalThis.fetch).mockClear();

    const second = await cacheImage(url);
    expect(second).toBe(first);
    // 失効済みでも SHA256 キーで永続化されているため再 fetch されない。
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("失効後に別 URL (= 別ハッシュ) が来た場合は再 fetch する", async () => {
    const cache = makeImageCache();
    const cacheImage = buildCacheImageFn(cache, "memory", "/api/images");

    // Response は一度 body を読むと再利用できないため、呼び出しごとに新しい Response を返す。
    vi.mocked(globalThis.fetch).mockImplementation(async () =>
      makeResponse(200, new ArrayBuffer(4), "image/webp"),
    );

    await cacheImage("https://example.com/a.webp");
    vi.advanceTimersByTime(ONE_HOUR_MS + 5000);

    // 別 URL (異なる SHA256 キー) は新規 fetch される。
    await cacheImage("https://example.com/b.webp");

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
