import type {
  BreadcrumbBlockObjectResponse,
  DividerBlockObjectResponse,
  TabBlockObjectResponse,
  TableOfContentsBlockObjectResponse,
  UnsupportedBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { escapeHtml } from "../providers/_internal";

/** divider ブロックを `<hr>` に変換する。 */
export function renderDivider(_block: DividerBlockObjectResponse): string {
  return `<hr class="nhc-divider" />`;
}

/**
 * breadcrumb ブロックを HTML に変換する。
 * Notion API は親ページ階層情報を返さないため、空のプレースホルダ nav を出力する。
 * 実装側で親 page を解決して中身を埋めるためのフックとしても利用できる。
 */
export function renderBreadcrumb(
  _block: BreadcrumbBlockObjectResponse,
): string {
  return `<nav class="nhc-breadcrumb" aria-label="breadcrumb"></nav>`;
}

/**
 * table_of_contents ブロックを HTML に変換する。
 * 実 TOC 生成は rehype 側 (rehype-slug + rehype-toc 等) に任せ、
 * ここはマーカー要素のみ出力する。color はクラスとして付与する。
 */
export function renderTableOfContents(
  block: TableOfContentsBlockObjectResponse,
): string {
  const color = block.table_of_contents.color;
  const colorCls =
    color !== "default"
      ? color.endsWith("_background")
        ? ` nhc-color-bg--${color.replace("_background", "")}`
        : ` nhc-color--${color}`
      : "";
  return `<nav class="nhc-toc${colorCls}" aria-label="table of contents"></nav>`;
}

/**
 * tab ブロックを HTML に変換する。
 * Notion の tab は has_children + 兄弟 tab で構成されるが、
 * notion-embed は単一ブロック単位の処理なので包む div のみ出力。
 * 親側 (notion-to-md) が連続する tab をまとめる前提。
 */
export function renderTab(_block: TabBlockObjectResponse): string {
  return `<div class="nhc-tab"></div>`;
}

/**
 * unsupported ブロックを HTML に変換する。
 * Notion API が今後追加した未知ブロックを「無視せず」可視化するため、
 * HTML コメントとして残す。CSS では非表示にできる。
 */
export function renderUnsupported(
  block: UnsupportedBlockObjectResponse,
): string {
  return `<!-- nhc:unsupported ${escapeHtml(block.unsupported.block_type ?? "unknown")} -->`;
}
