import type { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { RichTextRenderOptions } from "../render-rich-text";
import { renderRichText } from "../render-rich-text";

/**
 * toggle ブロックを `<details><summary>` HTML にレンダリングする。
 * 子ブロックは notion-to-md が変換した Markdown → HTML がそのまま入るため、
 * ここでは summary 行だけ生成して <details> を開く。
 * 子コンテンツは Transformer が別途処理して文字列に追加する設計。
 */
export async function renderToggle(
  block: ToggleBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const summaryHtml = await renderRichText(block.toggle.rich_text, opts);

  // notion-to-md はこのハンドラーの戻り値を Markdown 文字列として受け取る。
  // <details> の中身 (子ブロック) は現状 notion-to-md が自動で後続に追加しないため、
  // ここでは単独で <details> を閉じる形にする。
  // 子コンテンツが必要な場合は利用側で children を取得して文字列を連結する。
  return (
    `<details class="nhc-toggle">` +
    `<summary class="nhc-toggle__summary">${summaryHtml}</summary>` +
    `</details>`
  );
}
