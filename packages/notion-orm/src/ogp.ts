// 埋め込み URL から OGP メタデータを抽出するユーティリティ。
// HTML パースには linkedom を使う（Cloudflare Workers / Node 互換、軽量）。

import type { ImageCacheOps, Logger } from "@notion-headless-cms/core";
import { sha256Hex } from "@notion-headless-cms/core";
import { parseHTML } from "linkedom";

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_UA =
  "notion-headless-cms/notion-orm (+https://github.com/kjfsm/notion-headless-cms)";

/** OGP 抽出結果。 */
export interface OgpData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/** OGP 取得時のオプション。 */
export interface OgpFetchOptions {
  /** キャッシュ TTL (ms)。デフォルト 5 分。 */
  ttlMs?: number;
  /** User-Agent ヘッダ。 */
  userAgent?: string;
}

function parseOgp(html: string): OgpData {
  const { document } = parseHTML(html);
  const meta = (...selectors: string[]): string | undefined => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const value = el?.getAttribute("content")?.trim();
      if (value) return value;
    }
    return undefined;
  };
  return {
    title:
      meta('meta[property="og:title"]', 'meta[name="og:title"]') ??
      document.querySelector("title")?.textContent?.trim() ??
      undefined,
    description: meta(
      'meta[property="og:description"]',
      'meta[name="og:description"]',
    ),
    image: meta('meta[property="og:image"]', 'meta[name="og:image"]'),
    siteName: meta(
      'meta[property="og:site_name"]',
      'meta[name="og:site_name"]',
    ),
  };
}

/**
 * URL から OGP データを取得する。キャッシュなし。HTTP エラー時は Error を投げる。
 * TTL キャッシュが必要なら {@link createOgpFetcher} を使う。
 */
export async function fetchOgp(
  url: string,
  opts?: OgpFetchOptions,
): Promise<OgpData> {
  const res = await fetch(url, {
    headers: { "User-Agent": opts?.userAgent ?? DEFAULT_UA },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(
      `[notion-orm] OGP fetch failed: HTTP ${res.status} for ${url}`,
    );
  }
  const html = await res.text();
  return parseOgp(html);
}

/**
 * TTL キャッシュ付き OGP フェッチャーを生成する。
 * インスタンスごとに独立した Map ベースのインメモリキャッシュを持つ。
 */
export function createOgpFetcher(opts?: {
  ttlMs?: number;
}): (url: string, fetchOpts?: OgpFetchOptions) => Promise<OgpData> {
  const defaultTtl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const cache = new Map<string, { data: OgpData; expireAt: number }>();
  return async (url, fetchOpts) => {
    const ttlMs = fetchOpts?.ttlMs ?? defaultTtl;
    const now = Date.now();
    const cached = cache.get(url);
    if (cached && cached.expireAt > now) return cached.data;
    const data = await fetchOgp(url, fetchOpts);
    cache.set(url, { data, expireAt: now + ttlMs });
    return data;
  };
}

/** 永続化向けの OGP JSON キャッシュ。R2 / KV をユーザー側で被せる用。 */
export interface OgpJsonCache {
  get(url: string): Promise<OgpData | null>;
  set(url: string, data: OgpData): Promise<void>;
}

/** OG 画像をキャッシュしてプロキシ URL に書き換えるためのオプション。 */
export interface OgpImageCacheBinding {
  /** core の `ImageCacheOps` または同等の構造型。 */
  cache: ImageCacheOps;
  /** プロキシ URL の prefix。例: `/cms-image` → `/cms-image/<hash>` */
  imageProxyBase: string;
  /** 失敗時の警告ロガー。 */
  logger?: Logger;
  /** デバッグ表示用のキャッシュ名。 */
  cacheName?: string;
}

// ── KV / R2 ファクトリ ──────────────────────────────────────────────────────

/** `createKvOgpCache` に渡す KV バインディングの最小インターフェース。Cloudflare Workers の `KVNamespace` と構造互換。 */
export interface KvOgpStore {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** `createR2OgpImageCache` に渡す R2 バインディングの最小インターフェース。Cloudflare Workers の `R2Bucket` と構造互換。 */
export interface R2OgpBucket {
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
  put(
    key: string,
    value: ArrayBuffer,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

/**
 * Cloudflare KV を `OgpJsonCache` として使うファクトリ。
 * OGP メタデータ (JSON) を KV に永続化する。
 *
 * @example
 * ogp: { enabled: true, jsonCache: createKvOgpCache(env.OGP_CACHE) }
 */
export function createKvOgpCache(
  kv: KvOgpStore,
  opts: { prefix?: string } = {},
): OgpJsonCache {
  const prefix = opts.prefix ?? "ogp:";
  return {
    async get(url) {
      const raw = await kv.get(`${prefix}${url}`, "text");
      return raw ? (JSON.parse(raw) as OgpData) : null;
    },
    async set(url, data) {
      await kv.put(`${prefix}${url}`, JSON.stringify(data));
    },
  };
}

/**
 * Cloudflare R2 を `OgpImageCacheBinding` として使うファクトリ。
 * OG 画像を R2 に保存し、プロキシ経由で配信する。
 *
 * @example
 * ogp: {
 *   enabled: true,
 *   imageCache: createR2OgpImageCache(env.IMG_BUCKET, "/api/images"),
 * }
 */
export function createR2OgpImageCache(
  bucket: R2OgpBucket,
  imageProxyBase: string,
  opts: { prefix?: string; logger?: Logger; cacheName?: string } = {},
): OgpImageCacheBinding {
  const prefix = opts.prefix ?? "ogp-images/";
  const cache: ImageCacheOps = {
    async get(hash) {
      const obj = await bucket.get(`${prefix}${hash}`);
      if (!obj) return null;
      return {
        data: await obj.arrayBuffer(),
        contentType: obj.httpMetadata?.contentType,
      };
    },
    async set(hash, data, contentType) {
      await bucket.put(`${prefix}${hash}`, data, {
        httpMetadata: { contentType },
      });
    },
  };
  return {
    cache,
    imageProxyBase,
    logger: opts.logger,
    cacheName: opts.cacheName ?? "r2-ogp",
  };
}

/**
 * OG 画像 URL を fetch して ImageCache に保存し、プロキシ URL を返す。
 * 既存キャッシュがあれば再 fetch しない。失敗時は元 URL を返してフォールバック。
 */
export async function cacheOgImage(
  imageUrl: string,
  binding: OgpImageCacheBinding,
): Promise<string> {
  const hash = await sha256Hex(imageUrl);
  const proxyUrl = `${binding.imageProxyBase}/${hash}`;
  const existing = await binding.cache.get(hash);
  if (existing) return proxyUrl;

  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      binding.logger?.warn?.(
        `[notion-orm] OG image fetch HTTP ${res.status}: ${imageUrl}`,
      );
      return imageUrl;
    }
    const headerValue = res.headers.get("content-type");
    const contentType =
      headerValue?.split(";")[0]?.trim().toLowerCase() ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      binding.logger?.warn?.(
        `[notion-orm] OG image non-image content-type: ${contentType} for ${imageUrl}`,
      );
      return imageUrl;
    }
    const data = await res.arrayBuffer();
    await binding.cache.set(hash, data, contentType);
    return proxyUrl;
  } catch (err) {
    binding.logger?.warn?.(
      `[notion-orm] OG image cache failed: ${(err as Error).message}`,
    );
    return imageUrl;
  }
}
