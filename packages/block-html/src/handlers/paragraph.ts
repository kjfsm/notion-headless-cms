import type {
  BulletedListItemBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  Heading4BlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  ParagraphBlockObjectResponse,
  QuoteBlockObjectResponse,
  RichTextItemResponse,
  ToDoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { RichTextRenderOptions } from "../render-rich-text";
import { renderRichText } from "../render-rich-text";

export async function renderParagraph(
  block: ParagraphBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.paragraph.rich_text, opts);
  // notion-to-md v3 から渡されるブロックでは color が欠落するケースがあるため安全側で扱う。
  const colorValue = block.paragraph.color;
  const color =
    typeof colorValue === "string" && colorValue !== "default"
      ? ` class="nhc-color-bg--${colorValue.replace("_background", "")}"`
      : "";
  // 空ブロックは <p></p> だとブラウザが折り畳むため <br> で高さを確保する。
  return `<p${color}>${html || "<br>"}</p>`;
}

export async function renderHeading1(
  block: Heading1BlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.heading_1.rich_text, opts);
  return `<h1>${html}</h1>`;
}

export async function renderHeading2(
  block: Heading2BlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.heading_2.rich_text, opts);
  return `<h2>${html}</h2>`;
}

export async function renderHeading3(
  block: Heading3BlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.heading_3.rich_text, opts);
  return `<h3>${html}</h3>`;
}

/** Notion API 2026-03-11 で導入された。 */
export async function renderHeading4(
  block: Heading4BlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.heading_4.rich_text, opts);
  return `<h4>${html}</h4>`;
}

export async function renderBulletedListItem(
  block: BulletedListItemBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.bulleted_list_item.rich_text, opts);
  return `<li>${html}</li>`;
}

export async function renderNumberedListItem(
  block: NumberedListItemBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.numbered_list_item.rich_text, opts);
  return `<li>${html}</li>`;
}

export async function renderQuote(
  block: QuoteBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.quote.rich_text, opts);
  return `<blockquote class="nhc-quote">${html}</blockquote>`;
}

export async function renderToDo(
  block: ToDoBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.to_do.rich_text, opts);
  const checked = block.to_do.checked ? " checked" : "";
  const cls = block.to_do.checked ? " nhc-todo--checked" : "";
  return (
    `<label class="nhc-todo${cls}">` +
    `<input type="checkbox" disabled${checked} />` +
    `<span>${html}</span>` +
    `</label>`
  );
}

export function plainText(
  richText: ReadonlyArray<RichTextItemResponse>,
): string {
  return richText.map((t) => t.plain_text).join("");
}
