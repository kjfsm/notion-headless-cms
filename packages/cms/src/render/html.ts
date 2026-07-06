import { isJsonRecord } from "../transforms/walk.js";
import type { NormalizedBlock, ResolvedLink } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import { renderEmbedIframe, renderOgpShell } from "./embeds.js";
import { escapeHtml, sanitizeHref } from "./escape.js";

/** `renderBlocksToHtml` / `renderBlockToHtml` に渡すオプション。省略時は既存挙動のまま。 */
export interface RenderHtmlOptions {
  /** `link_to_page` ブロックの解決先。キーは正規化 pageId（`EntrySnapshot.links` と同形状）。 */
  readonly links?: Readonly<Record<string, ResolvedLink>>;
  /**
   * embed/video を iframe 直埋め込みしてよいホストの allowlist（サブドメイン許可）。
   * 既定は空配列（YouTube を除き iframe を生成せず OGP シェルへフォールバック）。
   */
  readonly allowedEmbedHosts?: readonly string[];
}

function renderRichTextItem(item: Record<string, JsonValue>): string {
  const equation = item.type === "equation" ? item.equation : undefined;
  if (isJsonRecord(equation)) {
    const cached = equation.__cachedHtml;
    if (typeof cached === "string") return cached;
    const expression = equation.expression;
    if (typeof expression === "string") {
      return `<span class="nhc-equation-inline">$${escapeHtml(expression)}$</span>`;
    }
  }

  const plainText = typeof item.plain_text === "string" ? item.plain_text : "";
  let html = escapeHtml(plainText);
  const annotations = item.annotations as Record<string, JsonValue> | undefined;
  if (annotations?.code) html = `<code>${html}</code>`;
  if (annotations?.bold) html = `<strong>${html}</strong>`;
  if (annotations?.italic) html = `<em>${html}</em>`;
  if (annotations?.strikethrough) html = `<s>${html}</s>`;
  if (annotations?.underline) html = `<u>${html}</u>`;
  const href = typeof item.href === "string" ? item.href : null;
  if (href) html = `<a href="${escapeHtml(sanitizeHref(href))}">${html}</a>`;
  return html;
}

/** Notion の rich_text 配列(注釈・リンク・inline equation 付き)を HTML 文字列に変換する。 */
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

function renderCode(data: Record<string, JsonValue>): string {
  const cached = data.__cachedHtml;
  if (typeof cached === "string") return cached;
  const language = typeof data.language === "string" ? data.language : "";
  return `<pre><code class="language-${escapeHtml(language)}">${renderRichText(data.rich_text)}</code></pre>`;
}

function renderEquationBlock(data: Record<string, JsonValue>): string {
  const cached = data.__cachedHtml;
  if (typeof cached === "string") return cached;
  const expression = typeof data.expression === "string" ? data.expression : "";
  return `<div class="nhc-equation">$$${escapeHtml(expression)}$$</div>`;
}

function renderTable(data: Record<string, JsonValue>, childrenHtml: string): string {
  const cls = ["nhc-table"];
  if (data.has_column_header) cls.push("nhc-table--col-header");
  if (data.has_row_header) cls.push("nhc-table--row-header");
  return `<table class="${cls.join(" ")}">${childrenHtml}</table>`;
}

function renderTableRow(data: Record<string, JsonValue>): string {
  const cells = Array.isArray(data.cells) ? data.cells : [];
  const tds = cells.map((cell) => `<td>${renderRichText(cell as JsonValue)}</td>`).join("");
  return `<tr>${tds}</tr>`;
}

function renderColumn(data: Record<string, JsonValue>, childrenHtml: string): string {
  const width = data.width_ratio;
  const style = typeof width === "number" ? ` style="flex:${width.toFixed(4)}"` : "";
  return `<div class="nhc-column"${style}>${childrenHtml}</div>`;
}

function pageIdOf(data: Record<string, JsonValue>): string | null {
  if (data.type === "page_id" && typeof data.page_id === "string") {
    return data.page_id;
  }
  return null;
}

function normalizePageId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function renderLinkToPage(
  data: Record<string, JsonValue>,
  links: Readonly<Record<string, ResolvedLink>> | undefined,
): string {
  const pageId = pageIdOf(data);
  const resolved = pageId ? links?.[normalizePageId(pageId)] : undefined;
  const href = resolved?.href ?? "#";
  const title = resolved?.title ?? pageId ?? "Untitled";
  const isDatabase = data.type === "database_id";
  const icon = isDatabase ? "🗄️" : "📋";
  return (
    `<div class="nhc-link-to-page-block">` +
    `<a class="nhc-link-to-page" href="${escapeHtml(sanitizeHref(href))}">` +
    `<span class="nhc-link-to-page__icon" aria-hidden="true">${icon}</span>` +
    `<span class="nhc-link-to-page__title">${escapeHtml(title)}</span>` +
    `</a>` +
    `</div>`
  );
}

function renderChildRef(data: Record<string, JsonValue>, variant: "page" | "database"): string {
  const title = typeof data.title === "string" && data.title ? data.title : "Untitled";
  const icon = variant === "page" ? "📄" : "🗄️";
  return (
    `<a class="nhc-child-${variant}" href="#">` +
    `<span class="nhc-child-${variant}__icon" aria-hidden="true">${icon}</span>` +
    `<span class="nhc-child-${variant}__title">${escapeHtml(title)}</span>` +
    `</a>`
  );
}

function renderMediaBlock(
  data: Record<string, JsonValue>,
  kind: "video" | "audio" | "file" | "pdf",
  allowedEmbedHosts: readonly string[],
): string {
  const url = extractFileUrl(data);
  if (!url) return "";
  const captionHtml = renderRichText(data.caption);
  const caption = captionHtml ? `<p class="nhc-${kind}__caption">${captionHtml}</p>` : "";

  if (kind === "audio") {
    return `<div class="nhc-audio-block"><audio class="nhc-audio" src="${escapeHtml(sanitizeHref(url))}" controls></audio>${caption}</div>`;
  }
  if (kind === "file") {
    const name = typeof data.name === "string" && data.name ? data.name : url;
    return (
      `<div class="nhc-file-block">` +
      `<a class="nhc-file" href="${escapeHtml(sanitizeHref(url))}" target="_blank" rel="noopener noreferrer">` +
      `<span class="nhc-file__icon" aria-hidden="true">📎</span>` +
      `<span class="nhc-file__name">${escapeHtml(name)}</span>` +
      `</a>${caption}</div>`
    );
  }
  if (kind === "pdf") {
    const iframe = renderEmbedIframe(url, allowedEmbedHosts) ?? renderOgpShell(url, "embed");
    return `<div class="nhc-pdf">${iframe}${caption}</div>`;
  }
  // video
  if (data.type === "external" && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) {
    return `<div class="nhc-video"><video class="nhc-video__player" src="${escapeHtml(sanitizeHref(url))}" controls></video>${caption}</div>`;
  }
  if (data.type === "external") {
    const iframe = renderEmbedIframe(url, allowedEmbedHosts) ?? renderOgpShell(url, "embed");
    return `<div class="nhc-video">${iframe}${caption}</div>`;
  }
  return `<div class="nhc-video"><video class="nhc-video__player" src="${escapeHtml(sanitizeHref(url))}" controls></video>${caption}</div>`;
}

/**
 * 正規化 block 1 件を HTML に変換する(children は再帰的に展開済みとして連結)。
 * 未対応ブロック種別は子要素だけを描画するフォールバックにする(何も失わない)。
 */
export function renderBlockToHtml(block: NormalizedBlock, opts?: RenderHtmlOptions): string {
  const data = block.data as Record<string, JsonValue>;
  const childrenHtml = block.children ? renderBlocksToHtml(block.children, opts) : "";
  const allowedEmbedHosts = opts?.allowedEmbedHosts ?? [];

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
    case "code":
      return renderCode(data);
    case "equation":
      return renderEquationBlock(data);
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
      return `<figure><img src="${escapeHtml(sanitizeHref(url))}" alt="${caption.replace(/<[^>]*>/g, "")}" loading="lazy" /></figure>`;
    }
    case "table":
      return renderTable(data, childrenHtml);
    case "table_row":
      return renderTableRow(data);
    case "column_list":
      return `<div class="nhc-column-list">${childrenHtml}</div>`;
    case "column":
      return renderColumn(data, childrenHtml);
    case "synced_block": {
      const isOriginal = data.synced_from === null;
      const cls = `nhc-synced-block${isOriginal ? " nhc-synced-block--original" : ""}`;
      return `<div class="${cls}">${childrenHtml}</div>`;
    }
    case "template":
      return `<div class="nhc-template">${renderRichText(data.rich_text)}${childrenHtml}</div>`;
    case "child_page":
      return renderChildRef(data, "page");
    case "child_database":
      return renderChildRef(data, "database");
    case "link_to_page":
      return renderLinkToPage(data, opts?.links);
    case "bookmark":
      return renderOgpShell(
        typeof data.url === "string" ? data.url : "",
        "bookmark",
        renderRichText(data.caption),
      );
    case "link_preview":
      return renderOgpShell(typeof data.url === "string" ? data.url : "", "link_preview");
    case "embed": {
      const url = typeof data.url === "string" ? data.url : "";
      const caption = renderRichText(data.caption);
      const iframe = renderEmbedIframe(url, allowedEmbedHosts);
      if (iframe) {
        const captionHtml = caption ? `<p class="nhc-embed__caption">${caption}</p>` : "";
        return `<div class="nhc-embed">${iframe}${captionHtml}</div>`;
      }
      return renderOgpShell(url, "embed", caption);
    }
    case "video":
      return renderMediaBlock(data, "video", allowedEmbedHosts);
    case "audio":
      return renderMediaBlock(data, "audio", allowedEmbedHosts);
    case "file":
      return renderMediaBlock(data, "file", allowedEmbedHosts);
    case "pdf":
      return renderMediaBlock(data, "pdf", allowedEmbedHosts);
    case "breadcrumb":
    case "table_of_contents":
      return childrenHtml;
    default:
      return childrenHtml;
  }
}

/**
 * 正規化 block tree から HTML 文字列を生成する(Hono / RSS / 非 React フレームワーク向け)。
 * 連続する bulleted_list_item / numbered_list_item は `<ul>`/`<ol>` にまとめる。
 */
export function renderBlocksToHtml(
  blocks: readonly NormalizedBlock[],
  opts?: RenderHtmlOptions,
): string {
  let html = "";
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block) {
      i++;
      continue;
    }
    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
      const tag = block.type === "bulleted_list_item" ? "ul" : "ol";
      let group = "";
      while (i < blocks.length && blocks[i]?.type === block.type) {
        const item = blocks[i];
        if (item) group += renderBlockToHtml(item, opts);
        i++;
      }
      html += `<${tag}>${group}</${tag}>`;
      continue;
    }
    html += renderBlockToHtml(block, opts);
    i++;
  }
  return html;
}
