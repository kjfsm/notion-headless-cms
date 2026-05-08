import type {
  BookmarkBlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { fetchOgp } from "../ogp";
import { escapeAttr, escapeHtml } from "../providers/_internal";
import { renderRichText } from "../render-rich-text";
import type { OgpData, OgpFetchOptions } from "../types";
import { normalizeUrl } from "../url-normalize";

const EMPTY_OGP: OgpData = {};

/**
 * bookmark ブロックを Notion 風 OGP カードにレンダリングする。
 *
 * Notion 風の見た目:
 * - 左ペイン: サイト名 + タイトル + 説明 + URL
 * - 右ペイン: OGP 画像サムネイル
 * クラス名 `.nhc-bookmark` で CSS を当てる。
 */
export async function renderBookmark(
  block: BookmarkBlockObjectResponse,
  ogpOptions?: false | OgpFetchOptions,
): Promise<string> {
  const rawUrl = block.bookmark.url;
  const url = normalizeUrl(rawUrl);
  const caption: ReadonlyArray<RichTextItemResponse> =
    block.bookmark.caption ?? [];
  const captionHtml = caption.length > 0 ? await renderRichText(caption) : "";

  let ogp: OgpData = EMPTY_OGP;
  if (ogpOptions !== false) {
    const fetchOpts: OgpFetchOptions | undefined =
      ogpOptions == null ? undefined : ogpOptions;
    ogp = await fetchOgp(url, fetchOpts).catch(() => EMPTY_OGP);
  }

  const hasOgp = Boolean(
    ogp.title ?? ogp.description ?? ogp.image ?? ogp.siteName,
  );

  // OGP タイトル未取得時は生 URL の代わりにホスト名をフォールバックとして使う。
  // 生 URL だと nhc-bookmark__url と内容が重複するため。
  const title = escapeHtml(
    ogp.title ??
      (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      })(),
  );
  const description = ogp.description
    ? `<p class="nhc-bookmark__description line-clamp-2 text-xs text-gray-500">${escapeHtml(ogp.description)}</p>`
    : "";
  const siteName = ogp.siteName
    ? `<p class="nhc-bookmark__site truncate text-xs text-gray-500">${escapeHtml(ogp.siteName)}</p>`
    : "";
  const displayUrl = escapeHtml(url.replace(/^https?:\/\//, "").slice(0, 60));
  const imageHtml = ogp.image
    ? `<img class="nhc-bookmark__image m-0 h-full w-full object-cover" src="${escapeAttr(ogp.image)}" alt="" loading="lazy" />`
    : "";

  const captionSection = captionHtml
    ? `<p class="nhc-bookmark__caption mt-2 text-xs text-gray-500">${captionHtml}</p>`
    : "";

  // OGP 取得失敗時は nhc-bookmark--no-ogp を付与し CSS 側でスタイルを切り替えられるようにする。
  const bookmarkClass = hasOgp
    ? "nhc-bookmark flex flex-row items-stretch overflow-hidden rounded-lg border border-gray-200 no-underline transition-colors hover:bg-gray-50"
    : "nhc-bookmark nhc-bookmark--no-ogp flex flex-row items-stretch overflow-hidden rounded-lg border border-gray-200 no-underline transition-colors hover:bg-gray-50";

  // 外側を <div> で包むことで markdown がこのブロックを「block-level raw HTML」として
  // 扱い、<p> でラップしないようにする。<p><a><div></div></a></p> という構造は HTML5
  // パーサが <div> を <p> 外へ吐き出してリンクを破壊するため、ラッパが必要。
  return (
    `<div class="nhc-bookmark-block my-3">` +
    `<a class="${bookmarkClass}" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="nhc-bookmark__main flex min-w-0 flex-1 flex-col gap-1 p-4">` +
    siteName +
    `<p class="nhc-bookmark__title truncate font-medium">${title}</p>` +
    description +
    `<p class="nhc-bookmark__url mt-1 truncate text-xs text-gray-500">${displayUrl}</p>` +
    `</div>` +
    (imageHtml
      ? `<div class="nhc-bookmark__cover ml-auto w-40 shrink-0 self-stretch bg-gray-100 sm:w-56">${imageHtml}</div>`
      : "") +
    `</a>` +
    captionSection +
    `</div>`
  );
}
