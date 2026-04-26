import type {
	AudioBlockObjectResponse,
	EmbedBlockObjectResponse,
	ImageBlockObjectResponse,
	PdfBlockObjectResponse,
	VideoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { escapeAttr, escapeHtml, renderIframe } from "../providers/_internal";
import { renderRichText } from "../render-rich-text";
import type { EmbedProvider } from "../types";
import { normalizeUrl } from "../url-normalize";

function extractFileUrl(
	content:
		| { type: "external"; external: { url: string } }
		| { type: "file"; file: { url: string } }
		| unknown,
): string | null {
	if (typeof content !== "object" || content === null) return null;
	const c = content as Record<string, unknown>;
	if (
		c.type === "external" &&
		typeof c.external === "object" &&
		c.external !== null
	) {
		return ((c.external as Record<string, unknown>).url as string) ?? null;
	}
	if (c.type === "file" && typeof c.file === "object" && c.file !== null) {
		return ((c.file as Record<string, unknown>).url as string) ?? null;
	}
	return null;
}

/**
 * embed ブロックを HTML にレンダリングする。
 * 登録済み provider がある場合は provider の出力を使い、なければ汎用 iframe を出力する。
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
	const fileUrl = extractFileUrl(block.video);
	if (!fileUrl) return "";
	const url = normalizeUrl(fileUrl);
	const caption =
		"caption" in block.video
			? (
					block.video as {
						caption: typeof block.video extends { caption: infer C }
							? C
							: never;
					}
				).caption
			: [];

	const provider = providers.find((p) => p.match(url));
	if (provider) {
		const result = await provider.render({ block, url });
		if (result.kind === "html")
			return `<div class="nhc-video">${result.html}</div>`;
	}

	const isExternal = block.video.type === "external";
	const captionHtml =
		Array.isArray(caption) && caption.length > 0
			? `<p class="nhc-video__caption">${await renderRichText(caption)}</p>`
			: "";

	if (isExternal) {
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
	const fileUrl = extractFileUrl(block.audio);
	if (!fileUrl) return "";
	const url = normalizeUrl(fileUrl);
	return `<audio class="nhc-audio" src="${escapeAttr(url)}" controls></audio>`;
}

/** pdf ブロックを HTML にレンダリングする。 */
export async function renderPdf(
	block: PdfBlockObjectResponse,
): Promise<string> {
	const fileUrl = extractFileUrl(block.pdf);
	if (!fileUrl) return "";
	const url = normalizeUrl(fileUrl);
	return `<div class="nhc-pdf">${renderIframe({ src: url, frameborder: 0 })}</div>`;
}

/** image ブロックを HTML にレンダリングする。 */
export async function renderImage(
	block: ImageBlockObjectResponse,
): Promise<string> {
	const fileUrl = extractFileUrl(block.image);
	if (!fileUrl) return "";
	const url = normalizeUrl(fileUrl);
	const caption =
		"caption" in block.image
			? (block.image as Record<string, unknown>).caption
			: [];
	const alt = Array.isArray(caption)
		? caption
				.map((t: unknown) => (t as { plain_text?: string }).plain_text ?? "")
				.join("")
		: "";
	const captionHtml =
		Array.isArray(caption) && caption.length > 0
			? `<figcaption class="nhc-image__caption">${escapeHtml(alt)}</figcaption>`
			: "";

	return (
		`<figure class="nhc-image">` +
		`<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" loading="lazy" />` +
		captionHtml +
		`</figure>`
	);
}
