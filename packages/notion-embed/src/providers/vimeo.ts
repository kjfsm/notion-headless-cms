import { extractIframeSrc, fetchOembed } from "../oembed";
import type { EmbedProvider } from "../types";
import { renderIframe } from "./_internal";

const VIMEO_OEMBED = "https://vimeo.com/api/oembed.json";
const VIMEO_HOST_RE = /(?:^|\.)vimeo\.com$/;

/** Vimeo 動画の embed ウィジェット。 */
export function vimeoProvider(opts?: {
	width?: number;
	height?: number;
}): EmbedProvider {
	const width = opts?.width ?? 640;
	const height = opts?.height ?? 360;
	return {
		id: "vimeo",
		match: (url) => {
			try {
				return VIMEO_HOST_RE.test(new URL(url).hostname);
			} catch {
				return false;
			}
		},
		render: async ({ url, width: w, height: h }) => {
			// oEmbed から embed src を取得することで URL 正規化・ID 抽出を省略する。
			const oembed = await fetchOembed(url, VIMEO_OEMBED, {
				width: w ?? width,
				height: h ?? height,
			});
			const src = oembed.html ? extractIframeSrc(oembed.html) : null;
			if (!src) return { kind: "skip" };
			return {
				kind: "html",
				html: renderIframe({
					src,
					width: w ?? width,
					height: h ?? height,
					frameborder: 0,
					allowFullscreen: true,
				}),
			};
		},
		sanitizeSchema: {
			tagNames: ["iframe"],
			attributes: {
				iframe: [
					"src",
					"width",
					"height",
					"frameborder",
					"allowfullscreen",
					"loading",
				],
			},
			protocols: { src: ["https"] },
		},
	};
}
