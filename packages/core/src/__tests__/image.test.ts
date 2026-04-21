import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCacheImageFn } from "../image";
import type { ImageCacheAdapter } from "../types/index";

const makeImageCache = (): ImageCacheAdapter & {
	store: Map<string, { data: ArrayBuffer; contentType?: string }>;
} => {
	const store = new Map<string, { data: ArrayBuffer; contentType?: string }>();
	return {
		name: "test",
		store,
		get: vi.fn(async (hash: string) => store.get(hash) ?? null),
		set: vi.fn(
			async (hash: string, data: ArrayBuffer, contentType: string) => {
				store.set(hash, { data, contentType });
			},
		),
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
		const data = new ArrayBuffer(4);
		cache.store.set(
			// SHA-256 of "https://example.com/img.jpg"
			// ハッシュ値は実際の sha256Hex の結果に依存するため、先に set しておく
			"dummy-hash",
			{ data, contentType: "image/jpeg" },
		);
		// ハッシュが一致するよう同じURLのエントリを事前登録
		const cacheImage = buildCacheImageFn(cache, "/api/images");

		// キャッシュを事前にセットするために一度 fetch を実行（空の body で）
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			makeResponse(200, new ArrayBuffer(4), "image/png"),
		);
		const url = "https://example.com/test-cache-hit.jpg";
		const first = await cacheImage(url);
		expect(first).toMatch(/^\/api\/images\//);

		// 2回目: fetch が呼ばれないはず
		vi.clearAllMocks();
		const second = await cacheImage(url);
		expect(second).toBe(first);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("fetch 成功時にキャッシュ保存してプロキシ URL を返す", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		const body = new ArrayBuffer(8);
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			makeResponse(200, body, "image/webp"),
		);

		const url = "https://example.com/photo.webp";
		const result = await cacheImage(url);

		expect(result).toMatch(/^\/api\/images\//);
		expect(cache.set).toHaveBeenCalledOnce();
		const [, savedData, savedType] = vi.mocked(cache.set).mock.calls[0];
		expect((savedData as ArrayBuffer).byteLength).toBe(body.byteLength);
		expect(savedType).toBe("image/webp");
	});

	it("HTTP 4xx で cache/image_fetch_failed CMSError をスローする", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(404));

		await expect(
			cacheImage("https://example.com/missing.jpg"),
		).rejects.toMatchObject({
			code: "cache/image_fetch_failed",
		});
	});

	it("HTTP 5xx で cache/image_fetch_failed CMSError をスローする", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(500));

		await expect(
			cacheImage("https://example.com/error.jpg"),
		).rejects.toMatchObject({
			code: "cache/image_fetch_failed",
		});
	});

	it("fetch がネットワークエラーをスローしたとき cache/io_failed CMSError をスローする", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("network error"));

		await expect(
			cacheImage("https://example.com/net-error.jpg"),
		).rejects.toMatchObject({
			code: "cache/io_failed",
		});
	});

	it("Content-Type ヘッダから MIME タイプを取得する", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			makeResponse(200, new ArrayBuffer(4), "image/gif; charset=utf-8"),
		);

		await cacheImage("https://example.com/anim.gif");

		const [, , savedType] = vi.mocked(cache.set).mock.calls[0];
		expect(savedType).toBe("image/gif");
	});

	it("URL の拡張子から PNG を推測する（Content-Type ヘッダなし）", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(new ArrayBuffer(4), { status: 200, headers: {} }),
		);

		await cacheImage("https://example.com/image.png?token=abc");

		const [, , savedType] = vi.mocked(cache.set).mock.calls[0];
		expect(savedType).toBe("image/png");
	});

	it("URL の拡張子から WebP を推測する（Content-Type ヘッダなし）", async () => {
		const cache = makeImageCache();
		const cacheImage = buildCacheImageFn(cache, "/api/images");
		vi.mocked(globalThis.fetch).mockResolvedValueOnce(
			new Response(new ArrayBuffer(4), { status: 200, headers: {} }),
		);

		await cacheImage("https://example.com/thumb.webp?s=300");

		const [, , savedType] = vi.mocked(cache.set).mock.calls[0];
		expect(savedType).toBe("image/webp");
	});
});
