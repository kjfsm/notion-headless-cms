import type { EmbedProvider } from "../types";
import { renderIframe } from "./_internal";

/**
 * 許可ホストリストに一致する任意 URL を iframe で埋め込む汎用 provider。
 *
 * 安全上の理由から `allowedHosts` を必ず指定すること。
 * 空配列を渡すと何もマッチしない。
 */
export function genericIframeProvider(opts: {
	allowedHosts: readonly string[];
	width?: number;
	height?: number;
}): EmbedProvider {
	return {
		id: "generic-iframe",
		match: (url) => {
			try {
				const { hostname } = new URL(url);
				return opts.allowedHosts.some(
					(h) => hostname === h || hostname.endsWith(`.${h}`),
				);
			} catch {
				return false;
			}
		},
		render: ({ url, width: w, height: h }) => ({
			kind: "html",
			html: renderIframe({
				src: url,
				width: w ?? opts.width,
				height: h ?? opts.height,
				frameborder: 0,
			}),
		}),
		sanitizeSchema: {
			tagNames: ["iframe"],
			attributes: {
				iframe: ["src", "width", "height", "frameborder", "loading"],
			},
			protocols: { src: ["https", "http"] },
		},
	};
}
