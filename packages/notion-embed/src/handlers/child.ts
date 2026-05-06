import type {
  ChildDatabaseBlockObjectResponse,
  ChildPageBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { escapeAttr, escapeHtml } from "../providers/_internal";

/**
 * child_page ブロックを HTML に変換する。
 * Notion API はページ ID をブロック ID として返すため、
 * ここではタイトルを表示するアンカーのみ出力する。
 * 実際のリンク先解決は利用側で行う想定で、href は data 属性に保持する。
 */
export function renderChildPage(block: ChildPageBlockObjectResponse): string {
  const title = block.child_page.title || "Untitled";
  const id = block.id;
  return (
    `<a class="nhc-child-page" href="#" data-page-id="${escapeAttr(id)}">` +
    `<span class="nhc-child-page__icon" aria-hidden="true">📄</span>` +
    `<span class="nhc-child-page__title">${escapeHtml(title)}</span>` +
    `</a>`
  );
}

/**
 * child_database ブロックを HTML に変換する。
 * child_page と同様、link 解決は利用側で行う前提。
 */
export function renderChildDatabase(
  block: ChildDatabaseBlockObjectResponse,
): string {
  const title = block.child_database.title || "Untitled";
  const id = block.id;
  return (
    `<a class="nhc-child-database" href="#" data-database-id="${escapeAttr(id)}">` +
    `<span class="nhc-child-database__icon" aria-hidden="true">🗄️</span>` +
    `<span class="nhc-child-database__title">${escapeHtml(title)}</span>` +
    `</a>`
  );
}
