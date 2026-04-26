import type { OgpData, OgpFetchOptions } from "./types";

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_UA =
	"notion-headless-cms/notion-embed (+https://github.com/kjfsm/notion-headless-cms)";

const OG_TITLE =
	/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_B =
	/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const OG_DESC =
	/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i;
const OG_DESC_B =
	/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i;
const OG_IMAGE =
	/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_B =
	/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;
const OG_SITE =
	/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i;
const OG_SITE_B =
	/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i;
const TAG_TITLE = /<title[^>]*>([^<]+)<\/title>/i;

function matchAny(html: string, ...patterns: RegExp[]): string | undefined {
	for (const p of patterns) {
		const m = html.match(p);
		if (m?.[1]) return decodeHtmlEntities(m[1].trim());
	}
	return undefined;
}

function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** in-memory キャッシュ。TTL 付き。 */
const cache = new Map<string, { data: OgpData; expireAt: number }>();

export async function fetchOgp(
	url: string,
	opts?: OgpFetchOptions,
): Promise<OgpData> {
	const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS;
	const now = Date.now();

	const cached = cache.get(url);
	if (cached && cached.expireAt > now) return cached.data;

	let html: string;
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": opts?.userAgent ?? DEFAULT_UA },
			redirect: "follow",
		});
		if (!res.ok) return {};
		html = await res.text();
	} catch {
		return {};
	}

	const data: OgpData = {
		title: matchAny(html, OG_TITLE, OG_TITLE_B, TAG_TITLE),
		description: matchAny(html, OG_DESC, OG_DESC_B),
		image: matchAny(html, OG_IMAGE, OG_IMAGE_B),
		siteName: matchAny(html, OG_SITE, OG_SITE_B),
	};

	cache.set(url, { data, expireAt: now + ttlMs });
	return data;
}

/** テスト等でキャッシュをクリアする。 */
export function clearOgpCache(): void {
	cache.clear();
}
