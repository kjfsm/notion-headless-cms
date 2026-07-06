/** bookmark/embed/link_preview の OGP カードに使うメタデータ。 */
export interface OgpData {
  readonly title?: string;
  readonly description?: string;
  readonly image?: string;
  readonly siteName?: string;
}

/** URL → OGP メタデータのキャッシュ構造型。既定はハンドラ内の isolate 内 TTL Map。 */
export interface OgpCache {
  get(url: string): Promise<OgpData | null>;
  put(url: string, data: OgpData): Promise<void>;
}

/** `createOgpHandler()` のオプション。 */
export interface OgpHandlerOptions {
  /**
   * URL → OGP メタデータのキャッシュ。読者経路で KV に書き込むと 1,000 回/日の
   * 予算を圧迫するため、既定では何も注入しない（呼び出しごとに fetch する）。
   * edge cache は `cache-control` ヘッダで別途効かせる。
   */
  readonly cache?: OgpCache;
  /** レスポンスの `cache-control: public, max-age=` に使う秒数。既定 86400。 */
  readonly ttlSeconds?: number;
  readonly userAgent?: string;
  /** fetch のタイムアウト(ms)。既定 5000。 */
  readonly timeoutMs?: number;
  /** レスポンス本文の読み取り上限(バイト)。既定 512KB。ストリームを打ち切って読む。 */
  readonly maxBodyBytes?: number;
  /** リダイレクト追跡の上限。既定 3。各 hop で SSRF ガードを再検証する。 */
  readonly maxRedirects?: number;
  /** 組み込み SSRF ガードに加える追加チェック。true を返せば許可。 */
  readonly allowUrl?: (url: URL) => boolean;
  /** テスト・独自実装用の fetch 差し替え。省略時はグローバル `fetch`。 */
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_TTL_SECONDS = 86400;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BODY_BYTES = 512 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_USER_AGENT =
  "notion-headless-cms-ogp/1 (+https://github.com/kjfsm/notion-headless-cms)";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  // fc00::/7 (unique local) と fe80::/10 (link local) を prefix で近似判定する。
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  return false;
}

/**
 * SSRF ガード: http/https + 標準ポートのみ許可し、localhost・プライベート/リンクローカル
 * IP 帯を拒否する。ドメイン名の URL については DNS 解決前のホスト名しか検査できない
 * （DNS rebinding には対処しない — 既知の簡略化）。
 */
export function isUrlAllowed(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) return false;

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return false;
  }

  const bare = hostname.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(bare)) {
    if (isPrivateIPv4(bare)) return false;
  } else if (bare.includes(":")) {
    if (isPrivateIPv6(bare)) return false;
  }
  return true;
}

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

interface FetchGuardOptions {
  readonly maxRedirects: number;
  readonly timeoutMs: number;
  readonly userAgent: string;
  readonly allowUrl: (url: URL) => boolean;
}

/**
 * SSRF ガードを各 redirect hop で再検証しながら fetch する。許可されない URL・
 * 過剰なリダイレクト・タイムアウトはすべて `null`（呼び出し側で "取得失敗" 扱い）。
 */
async function fetchWithGuard(
  initialUrl: URL,
  opts: FetchGuardOptions,
  fetchImpl: typeof fetch,
): Promise<Response | null> {
  let current = initialUrl;
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    if (!isUrlAllowed(current) || !opts.allowUrl(current)) return null;
    const { signal, cancel } = withTimeout(opts.timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(current.toString(), {
        redirect: "manual",
        signal,
        headers: { "user-agent": opts.userAgent },
      });
    } catch {
      return null;
    } finally {
      cancel();
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      try {
        current = new URL(location, current);
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
}

/** レスポンスボディを `maxBytes` で打ち切って文字列として読む(全量バッファを避ける)。 */
async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();
  const decoder = new TextDecoder();
  let result = "";
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    result += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return result;
}

function attrValue(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, "i");
  const m = tag.match(re);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

const OGP_PROPERTY_MAP: Record<string, keyof OgpData> = {
  "og:title": "title",
  "og:description": "description",
  "og:image": "image",
  "og:image:url": "image",
  "og:site_name": "siteName",
};

/**
 * HTML から OGP メタタグ(`<meta property="og:*">`)を正規表現で抽出する。
 * `og:title` が無ければ `<title>` タグをフォールバックに使う。
 * ストリーム読み取り時点で `maxBodyBytes` により本文サイズを制限しているため、
 * 壊れた/巨大な HTML でも正規表現の実行コストは有界になる。
 */
export function parseOgpHtml(html: string): OgpData {
  const data: Partial<Record<keyof OgpData, string>> = {};
  const metaRe = /<meta\s+[^>]*>/gi;
  for (const match of html.matchAll(metaRe)) {
    const tag = match[0];
    const property = attrValue(tag, "property") ?? attrValue(tag, "name");
    if (!property) continue;
    const key = OGP_PROPERTY_MAP[property.toLowerCase()];
    if (!key || data[key]) continue;
    const content = attrValue(tag, "content");
    if (content) data[key] = content;
  }
  if (!data.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch?.[1]) data.title = titleMatch[1].trim();
  }
  return data;
}

function jsonResponse(body: unknown, status: number, cacheControl?: string): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (cacheControl) headers.set("cache-control", cacheControl);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * `GET {routes}/ogp?url=...`: bookmark/embed/link_preview の OGP カードを
 * **ページアクセス時**に取得するエンドポイント（同期時に取得しない設計 — #437）。
 *
 * - SSRF ガード（http/https のみ・標準ポートのみ・プライベート/リンクローカル IP 拒否）
 * - タイムアウト・本文サイズ上限・リダイレクト追跡上限を必ず課す
 * - `cache-control` で edge cache に乗せる（KV は使わない — 読者経路の書き込み予算を守るため）
 */
export function createOgpHandler(
  opts?: OgpHandlerOptions,
): (request: Request) => Promise<Response> {
  const ttlSeconds = opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBodyBytes = opts?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxRedirects = opts?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const userAgent = opts?.userAgent ?? DEFAULT_USER_AGENT;
  const allowUrl = opts?.allowUrl ?? (() => true);
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const cache = opts?.cache;
  const cacheControl = `public, max-age=${ttlSeconds}`;

  return async (request: Request): Promise<Response> => {
    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return jsonResponse(
        { ok: false, code: "handler/ogp_url_forbidden", reason: "missing url" },
        400,
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return jsonResponse(
        { ok: false, code: "handler/ogp_url_forbidden", reason: "invalid url" },
        400,
      );
    }

    if (!isUrlAllowed(parsed) || !allowUrl(parsed)) {
      return jsonResponse(
        {
          ok: false,
          code: "handler/ogp_url_forbidden",
          reason: "url not allowed",
        },
        400,
      );
    }

    const cacheKey = parsed.toString();
    if (cache) {
      const cached = await cache.get(cacheKey);
      if (cached) return jsonResponse({ ok: true, ogp: cached }, 200, cacheControl);
    }

    const res = await fetchWithGuard(
      parsed,
      { maxRedirects, timeoutMs, userAgent, allowUrl },
      fetchImpl,
    );
    if (!res || !res.ok) {
      return jsonResponse({ ok: false, code: "handler/ogp_fetch_failed" }, 502);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      const empty: OgpData = {};
      await cache?.put(cacheKey, empty);
      return jsonResponse({ ok: true, ogp: empty }, 200, cacheControl);
    }

    const html = await readLimitedText(res, maxBodyBytes);
    const data = parseOgpHtml(html);
    await cache?.put(cacheKey, data);
    return jsonResponse({ ok: true, ogp: data }, 200, cacheControl);
  };
}
