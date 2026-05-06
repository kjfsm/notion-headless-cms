import type {
  TableBlockObjectResponse,
  TableRowBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { RichTextRenderOptions } from "../render-rich-text";
import { renderRichText } from "../render-rich-text";

/**
 * table ブロックを `<table>` に変換する。
 *
 * Notion の table 自体はメタデータ (列数 / ヘッダ有無) のみで、セル内容は子ブロック
 * (table_row) に存在する。notion-embed は単一ブロック単位で処理するため、
 * ここでは外側の `<table>` 要素のみ出力する。子の `<tr>` は renderTableRow が出す。
 * notion-to-md / レンダリングパイプラインが table と table_row を連結することを前提とする。
 */
export function renderTable(block: TableBlockObjectResponse): string {
  const cls = ["nhc-table"];
  if (block.table.has_column_header) cls.push("nhc-table--col-header");
  if (block.table.has_row_header) cls.push("nhc-table--row-header");
  return `<table class="${cls.join(" ")}"></table>`;
}

/**
 * table_row ブロックを `<tr>` + `<td>` に変換する。
 * 1 行ぶんのセル配列を rich_text として展開する。
 * th/td の判定は table 側の has_column_header / has_row_header に依存するため、
 * ここでは一律 td にして、必要なら CSS で見分ける。
 */
export async function renderTableRow(
  block: TableRowBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const cells = block.table_row.cells ?? [];
  const tds = await Promise.all(
    cells.map(async (cell) => `<td>${await renderRichText(cell, opts)}</td>`),
  );
  return `<tr>${tds.join("")}</tr>`;
}
