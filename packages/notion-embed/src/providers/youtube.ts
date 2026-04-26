import type { EmbedProvider } from "../types";
import { renderIframe } from "./_internal";

const YOUTUBE_RE =
	/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** YouTube 動画の embed ウィジェット。 */
export function youtubeProvider(opts?: {
	width?: number;
	height?: number;
}): EmbedProvider {
	const width = opts?.width ?? 560;
	const height = opts?.height ?? 315;
	return {
		id: "youtube",
		match: (url) => YOUTUBE_RE.test(url),
		render: ({ url, width: w, height: h }) => {
			const m = url.match(YOUTUBE_RE);
			if (!m?.[1]) return { kind: "skip" };
			const embedUrl = `https://www.youtube.com/embed/${m[1]}`;
			return {
				kind: "html",
				html: renderIframe({
					src: embedUrl,
					width: w ?? width,
					height: h ?? height,
					frameborder: 0,
					allow:
						"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
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
					"allow",
					"allowfullscreen",
					"loading",
				],
			},
			protocols: { src: ["https"] },
		},
	};
}
