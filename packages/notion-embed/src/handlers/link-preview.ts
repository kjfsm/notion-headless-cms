import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { fetchOgp } from "../ogp";
import { escapeAttr, escapeHtml } from "../providers/_internal";
import type { OgpData, OgpFetchOptions } from "../types";
import { normalizeUrl } from "../url-normalize";

const EMPTY_OGP: OgpData = {};

/**
 * link_preview ブロックを Notion 風のインラインリンクカードにレンダリングする。
 *
 * OGP 取得が有効な場合は bookmark と同形状のカードを出力する。
 * 取得失敗・無効時はシンプルなリンクカード（🔗 アイコン + URL）にフォールバックする。
 * クラス名 `.nhc-link-preview` で CSS を当てる。
 */
export async function renderLinkPreview(
  block: LinkPreviewBlockObjectResponse,
  ogpOptions?: false | OgpFetchOptions,
): Promise<string> {
  const url = normalizeUrl(block.link_preview.url);

  let ogp: OgpData = EMPTY_OGP;
  if (ogpOptions !== false) {
    const fetchOpts: OgpFetchOptions | undefined =
      ogpOptions == null ? undefined : ogpOptions;
    ogp = await fetchOgp(url, fetchOpts).catch(() => EMPTY_OGP);
  }

  const hasOgp = Boolean(
    ogp.title ?? ogp.description ?? ogp.image ?? ogp.siteName,
  );

  if (hasOgp) {
    return renderOgpCard(url, ogp);
  }

  // OGP なし: シンプルなリンクカード
  const label = escapeHtml(url.replace(/^https?:\/\//, ""));
  return (
    `<div class="nhc-link-preview-block">` +
    `<a class="nhc-link-preview" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<span class="nhc-link-preview__icon" aria-hidden="true">🔗</span>` +
    `<span class="nhc-link-preview__label">${label}</span>` +
    `</a>` +
    `</div>`
  );
}

function renderOgpCard(url: string, ogp: OgpData): string {
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
    ? `<p class="nhc-link-preview__description">${escapeHtml(ogp.description)}</p>`
    : "";
  const siteName = ogp.siteName
    ? `<p class="nhc-link-preview__site">${escapeHtml(ogp.siteName)}</p>`
    : "";
  const displayUrl = escapeHtml(url.replace(/^https?:\/\//, "").slice(0, 60));
  const imageHtml = ogp.image
    ? `<img class="nhc-link-preview__image" src="${escapeAttr(ogp.image)}" alt="" loading="lazy" />`
    : "";

  return (
    `<div class="nhc-link-preview-block">` +
    `<a class="nhc-link-preview nhc-link-preview--ogp" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="nhc-link-preview__main">` +
    siteName +
    `<p class="nhc-link-preview__title">${title}</p>` +
    description +
    `<p class="nhc-link-preview__url">${displayUrl}</p>` +
    `</div>` +
    (imageHtml
      ? `<div class="nhc-link-preview__cover">${imageHtml}</div>`
      : "") +
    `</a>` +
    `</div>`
  );
}
