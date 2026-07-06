/**
 * `href`/`src`/iframe `src` に出力する URL のスキームを検証するヘルパー群。
 * Notion 編集者が入力した URL がそのまま属性へ載るため、`javascript:` 等の
 * 実行可能スキームによる XSS を防ぐ。`cms/src/render/escape.ts` の `sanitizeHref`
 * (non-React 向け HTML レンダラ用)と同じ方針を React 側にも用意する。
 * 不正な場合は `undefined` を返し、呼び出し側が属性を省略/フォールバックする。
 */

// タブ・改行を挟んでスキーム判定を回避する攻撃(例: "java\tscript:")を防ぐため、
// 空白を除去したうえでスキームを判定する。
const WHITESPACE_RE = /\s/g;

function stripWhitespace(url: string): string {
  return url.replace(WHITESPACE_RE, "");
}

// 相対・ルート相対・ハッシュ・クエリ・プロトコル相対はスキームを持たないため常に安全。
function isRelativeOrProtocolRelative(normalized: string): boolean {
  return (
    normalized.startsWith("//") ||
    normalized.startsWith("/") ||
    normalized.startsWith("#") ||
    normalized.startsWith("?") ||
    !normalized.includes(":")
  );
}

const SAFE_HREF_SCHEME_RE = /^(?:https?|mailto|tel):/i;

/**
 * `<a href>` 用。`http(s)`/`mailto`/`tel` と相対・プロトコル相対を許可し、
 * `javascript:` 等の危険なスキームは `undefined` にフォールバックする。
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const normalized = stripWhitespace(url);
  if (normalized === "") return undefined;
  if (isRelativeOrProtocolRelative(normalized)) return url;
  return SAFE_HREF_SCHEME_RE.test(normalized) ? url : undefined;
}

const SAFE_MEDIA_SCHEME_RE = /^(?:https?|data):/i;

/**
 * `<img>` 用。`http(s)`/`data:`(画像はスクリプトを実行しない)と相対・プロトコル相対を許可する。
 */
export function safeMediaSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const normalized = stripWhitespace(url);
  if (normalized === "") return undefined;
  if (isRelativeOrProtocolRelative(normalized)) return url;
  return SAFE_MEDIA_SCHEME_RE.test(normalized) ? url : undefined;
}

const SAFE_IFRAME_SCHEME_RE = /^https?:/i;

/**
 * `<iframe>` 用。スクリプト実行コンテキストになるため `http(s)`/プロトコル相対**のみ**許可し、
 * `data:`(`data:text/html` が iframe 内でスクリプト実行しうる)・`blob:`・`javascript:` を弾く。
 * 相対 URL も同一オリジン iframe になり `allow-same-origin` と組み合わさると危険なため許可しない。
 */
export function safeIframeSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const normalized = stripWhitespace(url);
  if (normalized === "") return undefined;
  if (normalized.startsWith("//")) return url;
  return SAFE_IFRAME_SCHEME_RE.test(normalized) ? url : undefined;
}
