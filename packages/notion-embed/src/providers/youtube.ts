import { fetchOembed } from "../oembed";
import type { EmbedProvider, OgpFetchOptions } from "../types";
import { escapeAttr, escapeHtml, renderIframe } from "./_internal";

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_HOST_RE = /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/;

const YOUTUBE_OEMBED = "https://www.youtube.com/oembed";

/** YouTube 動画の embed ウィジェット。 */
export interface YoutubeProviderOptions {
  width?: number;
  height?: number;
  /**
   * 描画形式。
   * - "iframe" (既定): YouTube プレーヤーを iframe で埋め込む
   * - "card": bookmark 風の OGP カードを描画 (動画 ID が抽出できないチャンネル URL 等にも対応)
   */
  display?: "iframe" | "card";
  /**
   * card モードのデータ取得設定。
   * false を指定するとデータ取得を無効化する。
   * @deprecated ogp オプション名は旧 API 互換のため残している。内部では oEmbed を使用。
   */
  ogp?: false | OgpFetchOptions;
}

export function youtubeProvider(opts?: YoutubeProviderOptions): EmbedProvider {
  const width = opts?.width ?? 560;
  const height = opts?.height ?? 315;
  const display = opts?.display ?? "iframe";
  const fetchData = opts?.ogp !== false;
  return {
    id: "youtube",
    // チャンネル / 動画 / shorts いずれの YouTube URL にもマッチする。
    match: (url) => {
      try {
        const u = new URL(url);
        return YOUTUBE_HOST_RE.test(u.hostname);
      } catch {
        return YOUTUBE_RE.test(url);
      }
    },
    render: async ({ url, width: w, height: h }) => {
      if (display === "card") {
        return renderCard(url, fetchData);
      }
      const m = url.match(YOUTUBE_RE);
      if (!m?.[1]) {
        // 動画 ID が抽出できない (チャンネル URL 等) 場合は card に自動フォールバック。
        return renderCard(url, fetchData);
      }
      const embedUrl = `https://www.youtube.com/embed/${m[1]}`;
      return {
        kind: "html",
        html: renderIframe({
          src: embedUrl,
          width: w ?? width,
          height: h ?? height,
          frameborder: 0,
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowFullscreen: true,
        }),
      };
    },
    sanitizeSchema: {
      tagNames: display === "card" ? ["a", "div", "p", "img"] : ["iframe"],
      attributes:
        display === "card"
          ? {
              a: ["className", "href", "target", "rel"],
              img: ["className", "src", "alt", "loading"],
              div: ["className"],
              p: ["className"],
            }
          : {
              iframe: [
                "src",
                "width",
                "height",
                "frameBorder",
                "allow",
                "allowFullScreen",
                "loading",
              ],
            },
      protocols: { src: ["https"], href: ["https", "http"] },
    },
  };
}

/**
 * YouTube card を描画する。
 * OGP はボット対策でブロックされるため、oEmbed エンドポイントを使用する。
 */
async function renderCard(url: string, fetchData: boolean) {
  // ホスト名をデフォルトタイトルとして使う（oEmbed 失敗時のフォールバック）。
  let title: string;
  try {
    title = new URL(url).hostname;
  } catch {
    title = url;
  }
  let image = "";
  let siteName = "YouTube";
  let hasData = false;

  if (fetchData) {
    try {
      const oembed = await fetchOembed(url, YOUTUBE_OEMBED);
      hasData = Boolean(oembed.title ?? oembed.thumbnail_url);
      if (oembed.title) title = oembed.title;
      if (oembed.thumbnail_url) image = oembed.thumbnail_url;
      if (oembed.author_name) siteName = oembed.author_name;
    } catch {
      // oEmbed 失敗時はデフォルトタイトル・サムネイルなしで続行
    }
  }

  const displayUrl = url.replace(/^https?:\/\//, "").slice(0, 60);
  const imageHtml = image
    ? `<div class="nhc-bookmark__cover"><img class="nhc-bookmark__image" src="${escapeAttr(image)}" alt="" loading="lazy" /></div>`
    : "";
  const bookmarkClass = hasData
    ? "nhc-bookmark nhc-bookmark--youtube"
    : "nhc-bookmark nhc-bookmark--youtube nhc-bookmark--no-ogp";
  // renderBookmark と同じ理由で <div> ラッパを付ける (markdown が <p> で包まないように)。
  const html =
    `<div class="nhc-bookmark-block">` +
    `<a class="${bookmarkClass}" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="nhc-bookmark__main">` +
    `<p class="nhc-bookmark__site">${escapeHtml(siteName)}</p>` +
    `<p class="nhc-bookmark__title">${escapeHtml(title)}</p>` +
    `<p class="nhc-bookmark__url">${escapeHtml(displayUrl)}</p>` +
    `</div>` +
    imageHtml +
    `</a>` +
    `</div>`;
  return { kind: "html" as const, html };
}
