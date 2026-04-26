import type { EmbedProvider } from "../types";
import { normalizeUrl } from "../url-normalize";
import { escapeAttr, escapeHtml } from "./_internal";

const DLSITE_LINK_RE = /^https?:\/\/(?:dlaf\.jp|dlsite\.jp|www\.dlsite\.com)/;
const DLSITE_IMG_RE = /^https?:\/\/img\.dlsite\.jp/;

/**
 * DLsite アフィリエイトリンク (dlaf.jp) と商品画像 (img.dlsite.jp) の埋め込み。
 * 入力は `<a href="..."><img src="..." /></a>` 形式を想定するが、
 * Notion embed ブロックから URL だけが来る場合はリンクカードとして出す。
 *
 * URL が dlaf.jp の場合は `<a rel="noopener sponsored">` で囲む。
 */
export function dlsiteProvider(): EmbedProvider {
	return {
		id: "dlsite",
		match: (url) => DLSITE_LINK_RE.test(url) || DLSITE_IMG_RE.test(url),
		render: ({ url }) => {
			const normalized = normalizeUrl(url);
			const isDlaf = normalized.includes("dlaf.jp");
			const rel = isDlaf ? "noopener sponsored" : "noopener noreferrer";
			return {
				kind: "html",
				html:
					`<a class="nhc-embed nhc-embed--dlsite" href="${escapeAttr(normalized)}" target="_blank" rel="${rel}">` +
					`<span class="nhc-embed__label">${escapeHtml(normalized.replace(/^https?:\/\//, "").slice(0, 60))}</span>` +
					`</a>`,
			};
		},
		sanitizeSchema: {
			tagNames: ["a"],
			attributes: {
				a: ["class", "href", "target", "rel"],
			},
			protocols: { href: ["https", "http"] },
		},
	};
}
