import { isFullUser, type RichTextItemResponse } from "@notionhq/client";
import { escapeAttr, escapeHtml } from "./providers/_internal";
import { normalizeUrl } from "./url-normalize";

// AnnotationResponse は @notionhq/client から直接 export されないため indexed access で導出する
type Annotations = RichTextItemResponse["annotations"];

export interface RichTextRenderOptions {
  /** page mention のページタイトルを解決する。未指定なら page ID をそのまま表示。 */
  resolvePageTitle?: (pageId: string) => Promise<string | undefined>;
}

/**
 * Notion の rich_text 配列を HTML 文字列に変換する。
 * 戻り値は生 HTML を含むため `allowDangerousHtml` が有効なパイプラインでのみ使う。
 */
export async function renderRichText(
  richText: ReadonlyArray<RichTextItemResponse>,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const parts = await Promise.all(
    richText.map((item) => renderRichTextItem(item, opts)),
  );
  return parts.join("");
}

async function renderRichTextItem(
  item: RichTextItemResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  if (item.type === "mention") {
    return renderMention(item, opts);
  }
  if (item.type === "equation") {
    const inner = escapeHtml(item.equation.expression);
    return wrapAnnotations(
      `<code class="nhc-equation">${inner}</code>`,
      item.annotations,
      item.href,
    );
  }
  const text = item.text;
  const inner = escapeHtml(text.content).replace(/\n/g, "<br>");
  const url = text.link?.url
    ? normalizeUrl(text.link.url)
    : (item.href ?? null);
  return wrapAnnotations(inner, item.annotations, url);
}

async function renderMention(
  item: RichTextItemResponse & { type: "mention" },
  opts?: RichTextRenderOptions,
): Promise<string> {
  const m = item.mention;
  const plainText = item.plain_text;

  if (m.type === "link_mention") {
    const lm = m.link_mention;
    const href = escapeAttr(normalizeUrl(lm.href));
    const title = escapeHtml(lm.title ?? lm.href);
    // Notion インラインカードの「アイコン + プロバイダ名 + 太字タイトル」表示を再現する
    // (例: YouTube → icon_url=YouTube favicon, link_provider="YouTube", title=動画名)
    const icon = lm.icon_url
      ? `<img class="nhc-mention__icon nhc-mention__icon--image" src="${escapeAttr(lm.icon_url)}" alt="" aria-hidden="true" />`
      : `<span class="nhc-mention__icon" aria-hidden="true">🔗</span>`;
    const providerSpan = lm.link_provider
      ? `<span class="nhc-mention__provider">${escapeHtml(lm.link_provider)}</span>`
      : "";
    return (
      `<a class="nhc-mention nhc-mention--link" href="${href}" target="_blank" rel="noopener noreferrer">` +
      icon +
      providerSpan +
      `<strong class="nhc-mention__title">${title}</strong>` +
      `</a>`
    );
  }

  if (m.type === "link_preview") {
    const href = escapeAttr(normalizeUrl(m.link_preview.url));
    const label = escapeHtml(plainText || m.link_preview.url);
    return (
      `<a class="nhc-mention nhc-mention--link-preview" href="${href}" target="_blank" rel="noopener noreferrer">` +
      `<span class="nhc-mention__icon" aria-hidden="true">🔗</span>` +
      `<span class="nhc-mention__title">${label}</span>` +
      `</a>`
    );
  }

  if (m.type === "page") {
    const pageId = m.page.id;
    const title = (await opts?.resolvePageTitle?.(pageId)) ?? pageId;
    return (
      `<a class="nhc-mention nhc-mention--page" href="#">` +
      `<span class="nhc-mention__icon" aria-hidden="true">📋</span>` +
      `<span class="nhc-mention__title">${escapeHtml(title)}</span>` +
      `</a>`
    );
  }

  if (m.type === "database") {
    const dbId = m.database.id;
    const title = (await opts?.resolvePageTitle?.(dbId)) ?? dbId;
    return (
      `<a class="nhc-mention nhc-mention--database" href="#">` +
      `<span class="nhc-mention__icon" aria-hidden="true">🗄️</span>` +
      `<span class="nhc-mention__title">${escapeHtml(title)}</span>` +
      `</a>`
    );
  }

  if (m.type === "date") {
    const d = m.date;
    const label = d.end ? `${d.start} → ${d.end}` : d.start;
    return `<span class="nhc-mention nhc-mention--date">${escapeHtml(label)}</span>`;
  }

  if (m.type === "user") {
    const u = m.user;
    // partial user は name が欠落しうるため id にフォールバック
    const name = isFullUser(u) ? (u.name ?? u.id) : u.id;
    return `<span class="nhc-mention nhc-mention--user">@${escapeHtml(name)}</span>`;
  }

  if (m.type === "custom_emoji") {
    const emoji = m.custom_emoji;
    if (emoji.url) {
      return `<img class="nhc-mention nhc-mention--emoji" src="${escapeAttr(emoji.url)}" alt="${escapeAttr(emoji.name)}" />`;
    }
    return escapeHtml(plainText);
  }

  // template_mention など未対応 type は plain_text にフォールバック
  return escapeHtml(plainText);
}

function wrapAnnotations(
  inner: string,
  ann: Annotations,
  href: string | null | undefined,
): string {
  let html = inner;

  if (ann.code) {
    html = `<code class="nhc-inline-code">${html}</code>`;
  } else {
    if (ann.bold) html = `<strong>${html}</strong>`;
    if (ann.italic) html = `<em>${html}</em>`;
    if (ann.strikethrough) html = `<s>${html}</s>`;
    if (ann.underline) html = `<u>${html}</u>`;
  }

  const color = ann.color !== "default" ? ann.color : null;
  if (color) {
    const cls = color.endsWith("_background")
      ? `nhc-color-bg--${color.replace("_background", "")}`
      : `nhc-color--${color}`;
    html = `<span class="${cls}">${html}</span>`;
  }

  if (href) {
    const safeHref = escapeAttr(normalizeUrl(href));
    html = `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${html}</a>`;
  }

  return html;
}
