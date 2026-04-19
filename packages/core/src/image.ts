import { sha256Hex } from "./cache";
import { CMSError } from "./errors";
import type { ImageCacheAdapter, StorageBinary } from "./types/index";

/** レスポンスヘッダまたはURLの拡張子からContent-Typeを推測する。 */
function inferContentType(
	url: string,
	responseContentType: string | null,
): string {
	if (responseContentType?.startsWith("image/")) {
		return responseContentType.split(";")[0].trim();
	}
	if (url.includes(".png")) return "image/png";
	if (url.includes(".gif")) return "image/gif";
	if (url.includes(".webp")) return "image/webp";
	return "image/jpeg";
}

/**
 * Notion画像URLをfetchしてImageCacheAdapterにキャッシュし、プロキシURL を返す。
 * 既存キャッシュがあれば再fetchしない。
 */
async function fetchAndCacheImage(
	cache: ImageCacheAdapter,
	notionUrl: string,
	imageProxyBase: string,
): Promise<string> {
	const hash = await sha256Hex(notionUrl);
	const proxyUrl = `${imageProxyBase}/${hash}`;

	const existing = await cache.get(hash);
	if (existing) return proxyUrl;

	try {
		const response = await fetch(notionUrl, {
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return proxyUrl;

		const data = await response.arrayBuffer();
		const contentType = inferContentType(
			notionUrl,
			response.headers.get("content-type"),
		);
		await cache.set(hash, data, contentType);
	} catch (err) {
		throw new CMSError({
			code: "IMAGE_CACHE_FAILED",
			message: "Failed to fetch or cache Notion image.",
			cause: err,
			context: { operation: "fetchAndCacheImage", notionUrl },
		});
	}

	return proxyUrl;
}

/** ImageCacheAdapter と imageProxyBase から cacheImage 関数を構築するファクトリ。 */
export function buildCacheImageFn(
	cache: ImageCacheAdapter,
	imageProxyBase: string,
): (notionUrl: string) => Promise<string> {
	return (notionUrl) => fetchAndCacheImage(cache, notionUrl, imageProxyBase);
}

export type { StorageBinary };
