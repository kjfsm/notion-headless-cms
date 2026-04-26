import type { EmbedProvider } from "../types";
import { renderIframe } from "./_internal";

const VIMEO_RE = /(?:vimeo\.com\/)(\d+)/;

/** Vimeo 動画の embed ウィジェット。 */
export function vimeoProvider(opts?: {
	width?: number;
	height?: number;
}): EmbedProvider {
	const width = opts?.width ?? 640;
	const height = opts?.height ?? 360;
	return {
		id: "vimeo",
		match: (url) => VIMEO_RE.test(url),
		render: ({ url, width: w, height: h }) => {
			const m = url.match(VIMEO_RE);
			if (!m?.[1]) return { kind: "skip" };
			const embedUrl = `https://player.vimeo.com/video/${m[1]}`;
			return {
				kind: "html",
				html: renderIframe({
					src: embedUrl,
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
