import { sha256Hex } from "./cache";
import { CMSError, isCMSError } from "./errors";
import type { ImageCacheOps, Logger, StorageBinary } from "./types/index";

/**
 * レスポンスの Content-Type ヘッダから画像の MIME タイプを取り出す。
 * ヘッダがない、または image/* でない場合は CMSError を投げる。
 * URL 拡張子からの推測や jpeg デフォルトは行わない。
 */
function pickImageContentType(
  headerValue: string | null,
  notionUrl: string,
): string {
  if (!headerValue) {
    throw new CMSError({
      code: "cache/image_invalid_content_type",
      message: "Image response missing Content-Type header.",
      context: { operation: "fetchAndCacheImage:contentType", notionUrl },
    });
  }
  const value = (headerValue.split(";")[0] ?? headerValue).trim().toLowerCase();
  if (!value.startsWith("image/")) {
    throw new CMSError({
      code: "cache/image_invalid_content_type",
      message: `Image response has non-image Content-Type: ${value}`,
      context: {
        operation: "fetchAndCacheImage:contentType",
        notionUrl,
        contentType: value,
      },
    });
  }
  return value;
}

/**
 * Notion画像URLをfetchして ImageCacheOps にキャッシュし、プロキシURL を返す。
 * 既存キャッシュがあれば再fetchしない。
 */
async function fetchAndCacheImage(
  cache: ImageCacheOps,
  cacheName: string,
  notionUrl: string,
  hash: string,
  imageProxyBase: string,
  logger?: Logger,
): Promise<string> {
  const proxyUrl = `${imageProxyBase}/${hash}`;

  const existing = await cache.get(hash);
  if (existing) {
    logger?.debug?.("画像キャッシュヒット", {
      operation: "fetchAndCacheImage",
      cacheAdapter: cacheName,
      imageHash: hash,
    });
    return proxyUrl;
  }

  logger?.debug?.("画像キャッシュミス、Notion からフェッチ", {
    operation: "fetchAndCacheImage",
    cacheAdapter: cacheName,
    imageHash: hash,
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
    const contentType = pickImageContentType(
      response.headers.get("content-type"),
      notionUrl,
    );
    await cache.set(hash, data, contentType);
    logger?.debug?.("画像をキャッシュに保存", {
      operation: "fetchAndCacheImage",
      cacheAdapter: cacheName,
      imageHash: hash,
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

/**
 * `ImageCacheOps` と `imageProxyBase` から `cacheImage` 関数を構築する。
 * 返り値は Notion 画像 URL を受け取り、SHA-256 ハッシュをキャッシュキーとして
 * {@link ImageCacheOps} に保存後、プロキシ URL を返す。
 *
 * ハッシュのメモ化はファクトリ呼び出し単位でスコープ化されており、
 * インスタンス間でキャッシュを共有しない。
 */
export function buildCacheImageFn(
  cache: ImageCacheOps,
  cacheName: string,
  imageProxyBase: string,
  logger?: Logger,
): (notionUrl: string) => Promise<string> {
  const hashMemo = new Map<string, string>();
  return async (notionUrl) => {
    let hash = hashMemo.get(notionUrl);
    if (hash === undefined) {
      hash = await sha256Hex(notionUrl);
      hashMemo.set(notionUrl, hash);
    }
    return fetchAndCacheImage(
      cache,
      cacheName,
      notionUrl,
      hash,
      imageProxyBase,
      logger,
    );
  };
}

export type { StorageBinary };
