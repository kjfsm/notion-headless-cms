const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML テキストノード・属性値の両方に使えるエスケープ(属性はダブルクォート囲み前提)。 */
export function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

const SAFE_URL_SCHEME_RE = /^(?:https?|mailto|tel):/i;
/** 空白類を除去してスキームを判定するための正規化(タブ・改行を挟んだ回避策対策)。 */
const WHITESPACE_RE = /\s/g;

/**
 * `href`/`src` に出力する URL を検証する。`javascript:` 等の危険なスキームは `"#"` に
 * フォールバックする。相対パス・ルート相対パス・プロトコル相対 URL・http(s)/mailto/tel は許可する。
 * render/html.ts・render/embeds.ts は Hono/RSS 等 non-React 消費者向けのため、
 * ブラウザ側の自動サニタイズに頼らずここで防御する。
 */
export function sanitizeHref(url: string): string {
  const normalized = url.replace(WHITESPACE_RE, "");
  if (normalized === "") return "#";
  if (normalized.startsWith("//")) return url;
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("#") ||
    normalized.startsWith("?")
  ) {
    return url;
  }
  return SAFE_URL_SCHEME_RE.test(normalized) ? url : "#";
}
