import { sha256Hex } from "./cache";
import { CMSError, isCMSError } from "./errors";
import type { ImageCacheAdapter, Logger, StorageBinary } from "./types/index";

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
	logger?: Logger,
): Promise<string> {
	const hash = await sha256Hex(notionUrl);
	const proxyUrl = `${imageProxyBase}/${hash}`;

	const existing = await cache.get(hash);
	if (existing) {
		logger?.debug?.("画像キャッシュヒット", {
			operation: "fetchAndCacheImage",
			cacheAdapter: cache.name,
		});
		return proxyUrl;
	}

	logger?.debug?.("画像キャッシュミス、Notion からフェッチ", {
		operation: "fetchAndCacheImage",
		cacheAdapter: cache.name,
	});

	try {
		const response = await fetch(notionUrl, {
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) {
			throw new CMSError({
				code: "cache/image_fetch_failed",
				message: `Failed to fetch Notion image: HTTP ${response.status}`,
				context: {
					operation: "fetchAndCacheImage",
					notionUrl,
					httpStatus: response.status,
				},
			});
		}

		const data = await response.arrayBuffer();
		const contentType = inferContentType(
			notionUrl,
			response.headers.get("content-type"),
		);
		await cache.set(hash, data, contentType);
		logger?.debug?.("画像をキャッシュに保存", {
			operation: "fetchAndCacheImage",
			cacheAdapter: cache.name,
		});
	} catch (err) {
		if (isCMSError(err)) throw err;
		throw new CMSError({
			code: "cache/io_failed",
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
	logger?: Logger,
): (notionUrl: string) => Promise<string> {
	return (notionUrl) =>
		fetchAndCacheImage(cache, notionUrl, imageProxyBase, logger);
}

export type { StorageBinary };
