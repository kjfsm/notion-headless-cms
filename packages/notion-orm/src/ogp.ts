// 埋め込み URL から OGP メタデータを抽出するユーティリティ。
// notion-embed パッケージの ogp.ts から移植。Cloudflare Workers でも動かすため
// regex + native fetch のみで実装し、追加依存ライブラリを持ち込まない。

import type { ImageCacheOps, Logger } from "@notion-headless-cms/core";
import { sha256Hex } from "@notion-headless-cms/core";

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

const OG_TITLE =
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_B =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const OG_DESC =
  /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i;
const OG_DESC_B =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i;
const OG_IMAGE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_B =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;
const OG_SITE =
  /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i;
const OG_SITE_B =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i;
const TAG_TITLE = /<title[^>]*>([^<]+)<\/title>/i;

function matchAny(html: string, ...patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return undefined;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
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
  return {
    title: matchAny(html, OG_TITLE, OG_TITLE_B, TAG_TITLE),
    description: matchAny(html, OG_DESC, OG_DESC_B),
    image: matchAny(html, OG_IMAGE, OG_IMAGE_B),
    siteName: matchAny(html, OG_SITE, OG_SITE_B),
  };
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
