import { sha256Hex } from "./cache";
import { CMSError, isCMSError } from "./errors";
import type { ImageCacheOps, Logger, StorageBinary } from "./types/index";

/** レスポンスヘッダまたはURLの拡張子からContent-Typeを推測する。 */
function inferContentType(
  url: string,
  responseContentType: string | null,
): string {
  if (responseContentType?.startsWith("image/")) {
    return (responseContentType.split(";")[0] ?? responseContentType).trim();
  }
  if (url.includes(".png")) return "image/png";
  if (url.includes(".gif")) return "image/gif";
  if (url.includes(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * URL → SHA-256 hash のメモ化マップ。
 * Notion の画像 URL は同じ画像でも署名が時刻ごとに変わるが、
 * 1 リクエスト内では同一 URL が複数回現れることが多い (重複ハッシュ計算を回避)。
 *
 * メモリリーク防止に最大エントリ数を設けており、超過時は最古から削除する LRU。
 */
const HASH_MEMO_LIMIT = 1024;
const hashMemo = new Map<string, string>();

async function memoSha256(url: string): Promise<string> {
  const cached = hashMemo.get(url);
  if (cached !== undefined) {
    // LRU: アクセスを末尾に移動
    hashMemo.delete(url);
    hashMemo.set(url, cached);
    return cached;
  }
  const hash = await sha256Hex(url);
  hashMemo.set(url, hash);
  if (hashMemo.size > HASH_MEMO_LIMIT) {
    const firstKey = hashMemo.keys().next().value;
    if (firstKey !== undefined) hashMemo.delete(firstKey);
  }
  return hash;
}

/**
 * Notion画像URLをfetchして ImageCacheOps にキャッシュし、プロキシURL を返す。
 * 既存キャッシュがあれば再fetchしない。
 */
async function fetchAndCacheImage(
  cache: ImageCacheOps,
  cacheName: string,
  notionUrl: string,
  imageProxyBase: string,
  logger?: Logger,
): Promise<string> {
  const hash = await memoSha256(notionUrl);
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
    const contentType = inferContentType(
      notionUrl,
      response.headers.get("content-type"),
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
 */
export function buildCacheImageFn(
  cache: ImageCacheOps,
  cacheName: string,
  imageProxyBase: string,
  logger?: Logger,
): (notionUrl: string) => Promise<string> {
  return (notionUrl) =>
    fetchAndCacheImage(cache, cacheName, notionUrl, imageProxyBase, logger);
}

export type { StorageBinary };
