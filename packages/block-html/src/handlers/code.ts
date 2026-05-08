import type {
  CodeBlockObjectResponse,
  EquationBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { escapeAttr, escapeHtml } from "../providers/_internal";
import { renderRichText } from "../render-rich-text";

/**
 * code ブロックを HTML に変換する。
 * 言語名はハイライタ (Prism / Shiki / highlight.js) が拾えるよう
 * `language-{lang}` クラスとして付与する。
 */
export async function renderCode(
  block: CodeBlockObjectResponse,
): Promise<string> {
  const lang = block.code.language ?? "plain text";
  const text = block.code.rich_text.map((t) => t.plain_text).join("");
  const caption = block.code.caption ?? [];
  const captionHtml =
    caption.length > 0
      ? `<figcaption class="nhc-code__caption">${await renderRichText(caption)}</figcaption>`
      : "";
  return (
    `<figure class="nhc-code">` +
    `<pre><code class="language-${escapeAttr(lang)}">${escapeHtml(text)}</code></pre>` +
    captionHtml +
    `</figure>`
  );
}

/**
 * equation ブロックを HTML に変換する。
 * KaTeX / MathJax の描画は利用側 (CSS / クライアント JS) に任せる。
 * `$$...$$` で包むことで一般的な数式描画ライブラリが拾える。
 */
export function renderEquation(block: EquationBlockObjectResponse): string {
  const expr = block.equation.expression;
  return `<div class="nhc-equation">$$${escapeHtml(expr)}$$</div>`;
}
