import { parseHTML } from "linkedom";
import type { OgpData, OgpFetchOptions } from "./types";

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_UA =
  "notion-headless-cms/notion-embed (+https://github.com/kjfsm/notion-headless-cms)";

// linkedom は Cloudflare Workers / Node.js 双方で動作する軽量 DOM 実装。
// 自前 regex + HTML エンティティデコードを置き換え、属性順や name=/property= の
// バリエーションを DOM API でまとめて扱う。
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
 * URL から OGP データを取得する。キャッシュなし。
 * HTTP エラー時は Error を投げる。TTL キャッシュが必要なら {@link createOgpFetcher} を使う。
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
      `[notion-embed] OGP fetch failed: HTTP ${res.status} for ${url}`,
    );
  }
  const html = await res.text();
  return parseOgp(html);
}

/**
 * TTL キャッシュ付き OGP フェッチャーを生成する。
 * インスタンスごとに独立したキャッシュを持ち、インスタンス間でキャッシュを共有しない。
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
