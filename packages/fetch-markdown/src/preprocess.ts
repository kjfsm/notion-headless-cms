/**
 * Notion enhanced markdown を remark に通す前に整える。
 *
 * 1. インライン数式 `` $`expression`$ `` → `$expression$` に正規化 (remark-math 互換)
 * 2. ブロックレベル Notion タグ (`<callout>` / `<details>` / `<columns>` / `<column>` /
 *    `<summary>` / `<table_of_contents/>`) の前後に空行を確保する。
 *    CommonMark は「閉じタグ直後に空行が無いと以降を HTML ブロック扱い」にするため、
 *    Notion API が出力する `</callout>\n# 見出し` の形だと heading が変換されない。
 * 3. `</table>` の後に空行を確保する。
 *    Notion API が `<table>` タグ形式（CommonMark type-6 HTML ブロック）でテーブルを出力するため、
 *    `</table>` の直後に空行がないと後続の見出し等が HTML ブロックの一部として扱われる。
 *    テーブル内部に空行を入れると HTML ブロックが途切れてしまうため後ろのみに追加する。
 * 4. `<unknown .../>` の前後に空行を確保する。
 *    未対応ブロック型（bookmark / embed 等）を表すタグが CommonMark type-7 HTML ブロックとして
 *    解釈され、後続の見出しを取り込んでしまうことを防ぐ。
 */
export function preprocessNotionMarkdown(md: string): string {
  let out = md.replace(/\$`([^`]+)`\$/g, (_, expr) => `$${expr}$`);
  const BLOCK_TAGS = [
    "callout",
    "details",
    "summary",
    "columns",
    "column",
  ] as const;
  for (const tag of BLOCK_TAGS) {
    // 開きタグ: <tag ...> or <tag>
    out = out.replace(new RegExp(`(<${tag}(?:\\s[^>]*)?>)`, "g"), "\n\n$1\n\n");
    // 閉じタグ
    out = out.replace(new RegExp(`(</${tag}>)`, "g"), "\n\n$1\n\n");
  }
  // 自己閉じタグ
  out = out.replace(/(<table_of_contents\s*\/>)/g, "\n\n$1\n\n");

  // </table> の後にのみ空行を追加（前に入れるとテーブル HTML ブロックが途中で切れる）
  out = out.replace(/(<\/table>)/g, "$1\n\n");

  // <unknown .../> 前後に空行を追加
  out = out.replace(/(<unknown\s[^>]*\/>)/g, "\n\n$1\n\n");

  return out;
}
