import type { LinkToPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { escapeHtml } from "../providers/_internal";
import type { RichTextRenderOptions } from "../render-rich-text";

/**
 * link_to_page ブロックを Notion 風のページリンクカードにレンダリングする。
 *
 * resolvePageTitle が指定されている場合はタイトルを取得し、なければ ID を表示する。
 * クラス名 `.nhc-link-to-page` で CSS を当てる。
 */
export async function renderLinkToPage(
  block: LinkToPageBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const target = block.link_to_page;
  const pageId =
    target.type === "page_id"
      ? target.page_id
      : target.type === "database_id"
        ? target.database_id
        : null;

  if (!pageId) return "";

  const title = (await opts?.resolvePageTitle?.(pageId)) ?? pageId;
  const icon =
    target.type === "database_id"
      ? `<span class="nhc-link-to-page__icon" aria-hidden="true">🗄️</span>`
      : `<span class="nhc-link-to-page__icon" aria-hidden="true">📋</span>`;

  return (
    `<a class="nhc-link-to-page" href="#">` +
    icon +
    `<span class="nhc-link-to-page__title">${escapeHtml(title)}</span>` +
    `</a>`
  );
}
