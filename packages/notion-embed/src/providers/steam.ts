import type { EmbedProvider } from "../types";
import { renderIframe } from "./_internal";

const STEAM_WIDGET_RE =
	/^https:\/\/store\.steampowered\.com\/widget\/(\d+)(?:\/[^?#]*)?/;

/**
 * Steam ストアの widget 埋め込み。
 * 例: https://store.steampowered.com/widget/2516990/
 *
 * Notion の embed ブロックに widget URL が貼られた場合は <iframe> を出力する。
 * 公式の推奨サイズが 646x190 なので、明示指定が無ければそれを既定にする。
 */
export function steamProvider(opts?: {
	width?: number;
	height?: number;
}): EmbedProvider {
	const width = opts?.width ?? 646;
	const height = opts?.height ?? 190;
	return {
		id: "steam-widget",
		match: (url) => STEAM_WIDGET_RE.test(url),
		render: ({ url, width: w, height: h }) => ({
			kind: "html",
			html: renderIframe({
				src: url,
				width: w ?? width,
				height: h ?? height,
				frameborder: 0,
			}),
		}),
		sanitizeSchema: {
			tagNames: ["iframe"],
			attributes: {
				iframe: ["src", "width", "height", "frameborder", "loading"],
			},
			protocols: { src: ["https"] },
		},
	};
}
