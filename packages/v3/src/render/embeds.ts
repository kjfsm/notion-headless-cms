import { escapeHtml } from "./escape.js";

const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_HOST_RE = /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/;

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * OGP リンクカードの**シェル**を出力する(fetch はしない)。
 * `data-nhc-ogp-url` にカード対象 URL を持たせ、ページアクセス時にクライアントが
 * `{routes}/ogp?url=...` を呼んでカードを差し替える想定（React 版は `useOgp`）。
 * JS 無し環境ではホスト名 + URL のシンプルなリンクカードのまま表示される。
 */
export function renderOgpShell(
  url: string,
  variant: "bookmark" | "embed" | "link_preview",
  captionHtml = "",
): string {
  const label = escapeHtml(hostname(url));
  const displayUrl = escapeHtml(url.replace(/^https?:\/\//, "").slice(0, 60));
  const captionSection = captionHtml
    ? `<p class="nhc-${variant}__caption">${captionHtml}</p>`
    : "";
  return (
    `<div class="nhc-${variant}-block" data-nhc-ogp-url="${escapeHtml(url)}">` +
    `<a class="nhc-${variant}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="nhc-${variant}__main">` +
    `<p class="nhc-${variant}__title">${label}</p>` +
    `<p class="nhc-${variant}__url">${displayUrl}</p>` +
    `</div>` +
    `</a>` +
    captionSection +
    `</div>`
  );
}

/** iframe 1 個の共通テンプレート。`loading="lazy"` を必ず付ける。 */
function renderIframe(opts: {
  src: string;
  width?: number;
  height?: number;
  allow?: string;
  allowFullscreen?: boolean;
}): string {
  const attrs = [`src="${escapeHtml(opts.src)}"`];
  if (typeof opts.width === "number") attrs.push(`width="${opts.width}"`);
  if (typeof opts.height === "number") attrs.push(`height="${opts.height}"`);
  if (opts.allow) attrs.push(`allow="${escapeHtml(opts.allow)}"`);
  if (opts.allowFullscreen) attrs.push("allowfullscreen");
  attrs.push(
    'loading="lazy"',
    'sandbox="allow-scripts allow-same-origin allow-popups"',
  );
  return `<iframe ${attrs.join(" ")}></iframe>`;
}

/** YouTube の動画/shorts/短縮 URL から embed iframe の src を組み立てる。 */
function youtubeEmbedUrl(url: string): string | null {
  if (!YOUTUBE_HOST_RE.test(hostname(url))) return null;
  const m = url.match(YOUTUBE_ID_RE);
  if (!m?.[1]) return null;
  return `https://www.youtube.com/embed/${m[1]}`;
}

/**
 * embed / video ブロック向けの iframe 描画。
 *
 * - YouTube URL は動画 ID を抽出できれば直接 embed iframe にする(OGP/oEmbed 取得は
 *   ページアクセス時の責務ではないため行わない)
 * - `allowedEmbedHosts` に一致するホストは汎用 iframe として埋め込む
 * - どちらにも該当しなければ `null` を返す(呼び出し側が OGP シェルにフォールバックする)
 */
export function renderEmbedIframe(
  url: string,
  allowedEmbedHosts: readonly string[] = [],
): string | null {
  const youtubeUrl = youtubeEmbedUrl(url);
  if (youtubeUrl) {
    return renderIframe({
      src: youtubeUrl,
      width: 560,
      height: 315,
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
      allowFullscreen: true,
    });
  }
  const host = hostname(url);
  const allowed = allowedEmbedHosts.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (allowed) return renderIframe({ src: url });
  return null;
}
