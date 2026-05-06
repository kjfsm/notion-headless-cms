import type {
  AudioBlockObjectResponse,
  EmbedBlockObjectResponse,
  FileBlockObjectResponse,
  ImageBlockObjectResponse,
  PdfBlockObjectResponse,
  VideoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { escapeAttr, escapeHtml, renderIframe } from "../providers/_internal";
import { renderRichText } from "../render-rich-text";
import type { EmbedProvider } from "../types";
import { normalizeUrl } from "../url-normalize";

/**
 * external / file の両 variant に共通の url フィールドを取り出す。
 * @notionhq/client の型を直接受け取るため unknown キャストが不要。
 * 実行時に型不一致が起きた場合も空文字を返して呼び出し側で弾けるよう ?.url を使う。
 */
function mediaUrl(
  content:
    | { type: "external"; external: { url: string } }
    | { type: "file"; file: { url: string } },
): string {
  if (content.type === "external") return content.external?.url ?? "";
  return content.file?.url ?? "";
}

/**
 * embed ブロックを HTML にレンダリングする。
 * Notion の embed ブロックは iframe 埋め込みが目的のため、
 * 登録済み provider がある場合はその出力を使い、なければ直接 iframe を出力する。
 * OGP カードは bookmark ブロック (renderBookmark) の役割。
 */
export async function renderEmbed(
  block: EmbedBlockObjectResponse,
  providers: readonly EmbedProvider[],
): Promise<string> {
  const rawUrl = block.embed.url;
  const url = normalizeUrl(rawUrl);
  const caption = block.embed.caption ?? [];

  const provider = providers.find((p) => p.match(url));
  if (provider) {
    const result = await provider.render({ block, url });
    if (result.kind === "html") {
      const captionHtml =
        caption.length > 0
          ? `<p class="nhc-embed__caption">${await renderRichText(caption)}</p>`
          : "";
      return `<div class="nhc-embed">${result.html}${captionHtml}</div>`;
    }
    if (result.kind === "skip") {
      return "";
    }
  }

  const captionHtml =
    caption.length > 0
      ? `<p class="nhc-embed__caption">${await renderRichText(caption)}</p>`
      : "";

  return (
    `<div class="nhc-embed">` +
    renderIframe({ src: url, frameborder: 0 }) +
    captionHtml +
    `</div>`
  );
}

/** video ブロックを HTML にレンダリングする。 */
export async function renderVideo(
  block: VideoBlockObjectResponse,
  providers: readonly EmbedProvider[],
): Promise<string> {
  const url = normalizeUrl(mediaUrl(block.video));
  const caption = block.video.caption ?? [];

  const provider = providers.find((p) => p.match(url));
  if (provider) {
    const result = await provider.render({ block, url });
    if (result.kind === "html")
      return `<div class="nhc-video">${result.html}</div>`;
  }

  const captionHtml =
    caption.length > 0
      ? `<p class="nhc-video__caption">${await renderRichText(caption)}</p>`
      : "";

  if (block.video.type === "external") {
    // 直接メディアファイル (MP4 等) は <video> タグで描画する。それ以外は iframe 埋め込み。
    const isDirectMedia = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
    if (isDirectMedia) {
      return (
        `<div class="nhc-video">` +
        `<video class="nhc-video__player" src="${escapeAttr(url)}" controls></video>` +
        captionHtml +
        `</div>`
      );
    }
    return (
      `<div class="nhc-video">` +
      renderIframe({ src: url, frameborder: 0 }) +
      captionHtml +
      `</div>`
    );
  }

  return (
    `<div class="nhc-video">` +
    `<video class="nhc-video__player" src="${escapeAttr(url)}" controls></video>` +
    captionHtml +
    `</div>`
  );
}

/** audio ブロックを HTML にレンダリングする。 */
export async function renderAudio(
  block: AudioBlockObjectResponse,
): Promise<string> {
  const url = normalizeUrl(mediaUrl(block.audio));
  const caption = block.audio.caption ?? [];
  const captionHtml =
    caption.length > 0
      ? `<p class="nhc-audio__caption">${await renderRichText(caption)}</p>`
      : "";
  // 外側を <div> で包むことで remark が <p> でラップしないようにする
  return (
    `<div class="nhc-audio-block">` +
    `<audio class="nhc-audio" src="${escapeAttr(url)}" controls></audio>` +
    captionHtml +
    `</div>`
  );
}

/** pdf ブロックを HTML にレンダリングする。 */
export async function renderPdf(
  block: PdfBlockObjectResponse,
): Promise<string> {
  const url = normalizeUrl(mediaUrl(block.pdf));
  const caption = block.pdf.caption ?? [];
  const captionHtml =
    caption.length > 0
      ? `<p class="nhc-pdf__caption">${await renderRichText(caption)}</p>`
      : "";
  return (
    `<div class="nhc-pdf">` +
    renderIframe({ src: url, frameborder: 0 }) +
    captionHtml +
    `</div>`
  );
}

/** image ブロックを HTML にレンダリングする。 */
export async function renderImage(
  block: ImageBlockObjectResponse,
): Promise<string> {
  const url = normalizeUrl(mediaUrl(block.image));
  if (!url) return "";
  const caption = block.image.caption ?? [];
  const alt = caption.map((t) => t.plain_text).join("");
  const captionHtml =
    caption.length > 0
      ? `<figcaption class="nhc-image__caption">${await renderRichText(caption)}</figcaption>`
      : "";

  return (
    `<figure class="nhc-image">` +
    `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" />` +
    captionHtml +
    `</figure>`
  );
}

/** file ブロックをダウンロードリンクとしてレンダリングする。 */
export async function renderFile(
  block: FileBlockObjectResponse,
): Promise<string> {
  const url = normalizeUrl(mediaUrl(block.file));
  const name = block.file.name || url;
  const caption = block.file.caption ?? [];
  const captionHtml =
    caption.length > 0
      ? `<p class="nhc-file__caption">${await renderRichText(caption)}</p>`
      : "";
  return (
    `<div class="nhc-file-block">` +
    `<a class="nhc-file" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<span class="nhc-file__icon" aria-hidden="true">📎</span>` +
    `<span class="nhc-file__name">${escapeHtml(name)}</span>` +
    `</a>` +
    captionHtml +
    `</div>`
  );
}
