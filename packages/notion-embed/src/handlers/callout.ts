import type { CalloutBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { escapeAttr, escapeHtml } from "../providers/_internal";
import type { RichTextRenderOptions } from "../render-rich-text";
import { renderRichText } from "../render-rich-text";

/**
 * callout ブロックを Notion 風の吹き出し HTML にレンダリングする。
 * アイコンは絵文字またはカスタム絵文字 URL。クラス名 `.nhc-callout` で CSS を当てる。
 */
export async function renderCallout(
  block: CalloutBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.callout.rich_text, opts);
  const color =
    block.callout.color !== "default"
      ? ` nhc-callout--${block.callout.color}`
      : "";

  let iconHtml = "";
  const icon = block.callout.icon;
  if (icon) {
    if (icon.type === "emoji") {
      iconHtml = `<span class="nhc-callout__icon" aria-hidden="true">${escapeHtml(icon.emoji)}</span>`;
    } else if (icon.type === "external" && icon.external?.url) {
      iconHtml = `<img class="nhc-callout__icon" src="${escapeAttr(icon.external.url)}" alt="" loading="lazy" />`;
    } else if (icon.type === "file") {
      if (icon.file?.url) {
        iconHtml = `<img class="nhc-callout__icon" src="${escapeAttr(icon.file.url)}" alt="" loading="lazy" />`;
      }
    }
  }

  return (
    `<div class="nhc-callout${color}">` +
    iconHtml +
    `<div class="nhc-callout__text">${html}</div>` +
    `</div>`
  );
}
