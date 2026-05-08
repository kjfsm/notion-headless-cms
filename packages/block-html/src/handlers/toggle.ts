import type { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { RichTextRenderOptions } from "../render-rich-text";
import { renderRichText } from "../render-rich-text";

/**
 * toggle ブロックのサマリー部分 (rich text HTML) を返す。
 *
 * notion-to-md v3 は toggle ブロックの parent を md.toggle(summary, children) の
 * summary として <details><summary> で包む。そのため ここでは <details> を生成せず、
 * summary 内に表示する rich text HTML のみを返す。
 * <details> 生成・CSS クラス付与は notion-to-md と rehypeAddToggleClasses が担当する。
 */
export async function renderToggle(
  block: ToggleBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  return renderRichText(block.toggle.rich_text, opts);
}
