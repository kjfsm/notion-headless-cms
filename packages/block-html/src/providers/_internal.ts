/**
 * provider 共通の内部ヘルパー。
 * 公開 API ではない (アンダースコア prefix で除外)。
 */

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** 属性値エスケープ (ダブルクォートで囲む前提)。 */
export function escapeAttr(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/** テキストコンテンツエスケープ。 */
export function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * iframe 1 個を返す provider が共通で使う HTML テンプレート。
 * width/height は数値のみ通し、loading="lazy" を必ず付ける。
 */
export function renderIframe(opts: {
  src: string;
  width?: number;
  height?: number;
  allow?: string;
  allowFullscreen?: boolean;
  frameborder?: number;
}): string {
  const attrs: string[] = [`src="${escapeAttr(opts.src)}"`];
  if (typeof opts.width === "number") attrs.push(`width="${opts.width}"`);
  if (typeof opts.height === "number") attrs.push(`height="${opts.height}"`);
  if (typeof opts.frameborder === "number") {
    attrs.push(`frameborder="${opts.frameborder}"`);
  }
  if (opts.allow) attrs.push(`allow="${escapeAttr(opts.allow)}"`);
  if (opts.allowFullscreen) attrs.push("allowfullscreen");
  attrs.push('loading="lazy"');
  return `<iframe ${attrs.join(" ")}></iframe>`;
}
