import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { escapeAttr, escapeHtml } from "../providers/_internal";
import { normalizeUrl } from "../url-normalize";

/**
 * link_preview ブロックを Notion 風のインラインリンクカードにレンダリングする。
 *
 * Notion では「↑メンション」相当の見た目 (🔗 アイコン + タイトル)。
 * クラス名 `.nhc-link-preview` で CSS を当てる。
 */
export function renderLinkPreview(
  block: LinkPreviewBlockObjectResponse,
): string {
  const url = normalizeUrl(block.link_preview.url);
  const label = escapeHtml(url.replace(/^https?:\/\//, ""));

  // 外側を <div> で包むことで remark が <p> でラップしないようにする
  return (
    `<div class="nhc-link-preview-block">` +
    `<a class="nhc-link-preview" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<span class="nhc-link-preview__icon" aria-hidden="true">🔗</span>` +
    `<span class="nhc-link-preview__label">${label}</span>` +
    `</a>` +
    `</div>`
  );
}
