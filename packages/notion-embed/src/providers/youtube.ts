import { fetchOgp } from "../ogp";
import type { EmbedProvider, OgpFetchOptions } from "../types";
import { escapeAttr, escapeHtml, renderIframe } from "./_internal";

const YOUTUBE_RE =
	/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_HOST_RE = /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$/;

/** YouTube 動画の embed ウィジェット。 */
export interface YoutubeProviderOptions {
	width?: number;
	height?: number;
	/**
	 * 描画形式。
	 * - "iframe" (既定): YouTube プレーヤーを iframe で埋め込む
	 * - "card": bookmark 風の OGP カードを描画 (動画 ID が抽出できないチャンネル URL 等にも対応)
	 */
	display?: "iframe" | "card";
	/** card モードの OGP フェッチ設定。 */
	ogp?: false | OgpFetchOptions;
}

export function youtubeProvider(opts?: YoutubeProviderOptions): EmbedProvider {
	const width = opts?.width ?? 560;
	const height = opts?.height ?? 315;
	const display = opts?.display ?? "iframe";
	const ogpOpt = opts?.ogp;
	return {
		id: "youtube",
		// チャンネル / 動画 / shorts いずれの YouTube URL にもマッチする。
		match: (url) => {
			try {
				const u = new URL(url);
				return YOUTUBE_HOST_RE.test(u.hostname);
			} catch {
				return YOUTUBE_RE.test(url);
			}
		},
		render: async ({ url, width: w, height: h }) => {
			if (display === "card") {
				return renderCard(url, ogpOpt);
			}
			const m = url.match(YOUTUBE_RE);
			if (!m?.[1]) {
				// 動画 ID が抽出できない (チャンネル URL 等) 場合は card に自動フォールバック。
				return renderCard(url, ogpOpt);
			}
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
			tagNames: display === "card" ? ["a", "div", "p", "img"] : ["iframe"],
			attributes:
				display === "card"
					? {
							a: ["className", "href", "target", "rel"],
							img: ["className", "src", "alt", "loading"],
							div: ["className"],
							p: ["className"],
						}
					: {
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
			protocols: { src: ["https"], href: ["https", "http"] },
		},
	};
}

async function renderCard(
	url: string,
	ogpOpt: false | OgpFetchOptions | undefined,
) {
	let title = url;
	let description = "";
	let image = "";
	let siteName = "YouTube";
	if (ogpOpt !== false) {
		const ogp = await fetchOgp(url, ogpOpt).catch(
			(): import("../types").OgpData => ({}),
		);
		if (ogp.title) title = ogp.title;
		if (ogp.description) description = ogp.description;
		if (ogp.image) image = ogp.image;
		if (ogp.siteName) siteName = ogp.siteName;
	}
	const displayUrl = url.replace(/^https?:\/\//, "").slice(0, 60);
	const imageHtml = image
		? `<div class="nhc-bookmark__cover"><img class="nhc-bookmark__image" src="${escapeAttr(image)}" alt="" loading="lazy" /></div>`
		: "";
	const descHtml = description
		? `<p class="nhc-bookmark__description">${escapeHtml(description)}</p>`
		: "";
	// renderBookmark と同じ理由で <div> ラッパを付ける (markdown が <p> で包まないように)。
	const html =
		`<div class="nhc-bookmark-block">` +
		`<a class="nhc-bookmark nhc-bookmark--youtube" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
		`<div class="nhc-bookmark__main">` +
		`<p class="nhc-bookmark__site">${escapeHtml(siteName)}</p>` +
		`<p class="nhc-bookmark__title">${escapeHtml(title)}</p>` +
		descHtml +
		`<p class="nhc-bookmark__url">${escapeHtml(displayUrl)}</p>` +
		`</div>` +
		imageHtml +
		`</a>` +
		`</div>`;
	return { kind: "html" as const, html };
}
