import type { NormalizedBlock } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRichTextItem(item: Record<string, JsonValue>): string {
  const plainText = typeof item.plain_text === "string" ? item.plain_text : "";
  let html = escapeHtml(plainText);
  const annotations = item.annotations as Record<string, JsonValue> | undefined;
  if (annotations?.code) html = `<code>${html}</code>`;
  if (annotations?.bold) html = `<strong>${html}</strong>`;
  if (annotations?.italic) html = `<em>${html}</em>`;
  if (annotations?.strikethrough) html = `<s>${html}</s>`;
  if (annotations?.underline) html = `<u>${html}</u>`;
  const href = typeof item.href === "string" ? item.href : null;
  if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
  return html;
}

/** Notion の rich_text 配列(注釈・リンク付き)を HTML 文字列に変換する。 */
export function renderRichText(richText: JsonValue | undefined): string {
  if (!Array.isArray(richText)) return "";
  return richText
    .map((item) =>
      typeof item === "object" && item !== null && !Array.isArray(item)
        ? renderRichTextItem(item)
        : "",
    )
    .join("");
}

function extractFileUrl(data: Record<string, JsonValue>): string | null {
  if (data.type === "file") {
    const file = data.file as Record<string, JsonValue> | undefined;
    return typeof file?.url === "string" ? file.url : null;
  }
  if (data.type === "external") {
    const external = data.external as Record<string, JsonValue> | undefined;
    return typeof external?.url === "string" ? external.url : null;
  }
  return null;
}

/**
 * 正規化 block 1 件を HTML に変換する(children は再帰的に展開済みとして連結)。
 * 未対応ブロック種別は子要素だけを描画するフォールバックにする(何も失わない)。
 */
export function renderBlockToHtml(block: NormalizedBlock): string {
  const data = block.data as Record<string, JsonValue>;
  const childrenHtml = block.children ? renderBlocksToHtml(block.children) : "";

  switch (block.type) {
    case "paragraph":
      return `<p>${renderRichText(data.rich_text)}</p>`;
    case "heading_1":
      return `<h1>${renderRichText(data.rich_text)}</h1>`;
    case "heading_2":
      return `<h2>${renderRichText(data.rich_text)}</h2>`;
    case "heading_3":
      return `<h3>${renderRichText(data.rich_text)}</h3>`;
    case "bulleted_list_item":
    case "numbered_list_item":
      return `<li>${renderRichText(data.rich_text)}${childrenHtml}</li>`;
    case "quote":
      return `<blockquote>${renderRichText(data.rich_text)}${childrenHtml}</blockquote>`;
    case "code": {
      const language = typeof data.language === "string" ? data.language : "";
      return `<pre><code class="language-${escapeHtml(language)}">${renderRichText(data.rich_text)}</code></pre>`;
    }
    case "divider":
      return "<hr />";
    case "to_do": {
      const checked = data.checked === true;
      return `<div><label><input type="checkbox" disabled${checked ? " checked" : ""} /> ${renderRichText(data.rich_text)}</label>${childrenHtml}</div>`;
    }
    case "callout":
      return `<div class="callout">${renderRichText(data.rich_text)}${childrenHtml}</div>`;
    case "toggle":
      return `<details><summary>${renderRichText(data.rich_text)}</summary>${childrenHtml}</details>`;
    case "image": {
      const url = extractFileUrl(data);
      if (!url) return "";
      const caption = renderRichText(data.caption);
      return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(caption.replace(/<[^>]*>/g, ""))}" loading="lazy" /></figure>`;
    }
    default:
      return childrenHtml;
  }
}

/**
 * 正規化 block tree から HTML 文字列を生成する(Hono / RSS / 非 React フレームワーク向け)。
 * 連続する bulleted_list_item / numbered_list_item は `<ul>`/`<ol>` にまとめる。
 */
export function renderBlocksToHtml(blocks: readonly NormalizedBlock[]): string {
  let html = "";
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block) {
      i++;
      continue;
    }
    if (
      block.type === "bulleted_list_item" ||
      block.type === "numbered_list_item"
    ) {
      const tag = block.type === "bulleted_list_item" ? "ul" : "ol";
      let group = "";
      while (i < blocks.length && blocks[i]?.type === block.type) {
        const item = blocks[i];
        if (item) group += renderBlockToHtml(item);
        i++;
      }
      html += `<${tag}>${group}</${tag}>`;
      continue;
    }
    html += renderBlockToHtml(block);
    i++;
  }
  return html;
}
