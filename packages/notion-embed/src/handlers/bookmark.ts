import type {
	BookmarkBlockObjectResponse,
	RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { fetchOgp } from "../ogp";
import { escapeAttr, escapeHtml } from "../providers/_internal";
import { renderRichText } from "../render-rich-text";
import type { OgpData, OgpFetchOptions } from "../types";
import { normalizeUrl } from "../url-normalize";

const EMPTY_OGP: OgpData = {};

/**
 * bookmark ブロックを Notion 風 OGP カードにレンダリングする。
 *
 * Notion 風の見た目:
 * - 左ペイン: サイト名 + タイトル + 説明 + URL
 * - 右ペイン: OGP 画像サムネイル
 * クラス名 `.nhc-bookmark` で CSS を当てる。
 */
export async function renderBookmark(
	block: BookmarkBlockObjectResponse,
	ogpOptions?: false | OgpFetchOptions,
): Promise<string> {
	const rawUrl = block.bookmark.url;
	const url = normalizeUrl(rawUrl);
	const caption: ReadonlyArray<RichTextItemResponse> =
		block.bookmark.caption ?? [];
	const captionHtml = caption.length > 0 ? await renderRichText(caption) : "";

	let ogp: OgpData = EMPTY_OGP;
	if (ogpOptions !== false) {
		const fetchOpts: OgpFetchOptions | undefined =
			ogpOptions == null ? undefined : ogpOptions;
		ogp = await fetchOgp(url, fetchOpts).catch(() => EMPTY_OGP);
	}

	const title = escapeHtml(ogp.title ?? url);
	const description = ogp.description
		? `<p class="nhc-bookmark__description">${escapeHtml(ogp.description)}</p>`
		: "";
	const siteName = ogp.siteName
		? `<p class="nhc-bookmark__site">${escapeHtml(ogp.siteName)}</p>`
		: "";
	const displayUrl = escapeHtml(url.replace(/^https?:\/\//, "").slice(0, 60));
	const imageHtml = ogp.image
		? `<img class="nhc-bookmark__image" src="${escapeAttr(ogp.image)}" alt="" loading="lazy" />`
		: "";

	const captionSection = captionHtml
		? `<p class="nhc-bookmark__caption">${captionHtml}</p>`
		: "";

	// 外側を <div> で包むことで markdown がこのブロックを「block-level raw HTML」として
	// 扱い、<p> でラップしないようにする。<p><a><div></div></a></p> という構造は HTML5
	// パーサが <div> を <p> 外へ吐き出してリンクを破壊するため、ラッパが必要。
	return (
		`<div class="nhc-bookmark-block">` +
		`<a class="nhc-bookmark" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
		`<div class="nhc-bookmark__main">` +
		siteName +
		`<p class="nhc-bookmark__title">${title}</p>` +
		description +
		`<p class="nhc-bookmark__url">${displayUrl}</p>` +
		`</div>` +
		(imageHtml ? `<div class="nhc-bookmark__cover">${imageHtml}</div>` : "") +
		`</a>` +
		captionSection +
		`</div>`
	);
}
