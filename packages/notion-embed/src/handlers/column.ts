import type {
  ColumnBlockObjectResponse,
  ColumnListBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";

/**
 * column_list ブロックを `<div>` ラッパに変換する。
 * 子要素 (column) は notion-to-md / 親パイプラインが連結する。
 */
export function renderColumnList(
  _block: ColumnListBlockObjectResponse,
): string {
  return `<div class="nhc-column-list"></div>`;
}

/**
 * column ブロックを `<div>` に変換する。
 * width_ratio が指定されていれば inline style で flex-basis を設定する。
 */
export function renderColumn(block: ColumnBlockObjectResponse): string {
  const width = block.column.width_ratio;
  const style =
    typeof width === "number" ? ` style="flex:${width.toFixed(4)}"` : "";
  return `<div class="nhc-column"${style}></div>`;
}
