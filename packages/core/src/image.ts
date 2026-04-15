import { sha256Hex } from "./cache";
import { CMSError } from "./errors";
import type { StorageBinary } from "./types";

interface ImageStore {
	getImage(hash: string): Promise<StorageBinary | null>;
	setImage(hash: string, data: ArrayBuffer, contentType: string): Promise<void>;
}

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
 * Notion画像URLをfetchしてストレージにキャッシュし、プロキシURL を返す。
 * 既存キャッシュがあれば再fetchしない。
 */
async function fetchAndCacheImage(
	store: ImageStore,
	notionUrl: string,
	imageProxyBase: string,
): Promise<string> {
	const hash = await sha256Hex(notionUrl);
	const proxyUrl = `${imageProxyBase}/${hash}`;

	const existing = await store.getImage(hash);
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
		await store.setImage(hash, data, contentType);
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

/** CacheStore と imageProxyBase から cacheImage 関数を構築するファクトリ。 */
export function buildCacheImageFn(
	store: ImageStore,
	imageProxyBase: string,
): (notionUrl: string) => Promise<string> {
	return (notionUrl) => fetchAndCacheImage(store, notionUrl, imageProxyBase);
}
