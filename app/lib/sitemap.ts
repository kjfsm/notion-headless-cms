function xmlEscape(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export function buildSitemapXml(
	urlEntries: Array<{ loc: string; lastmod?: string }>,
) {
	const urls = urlEntries
		.map(
			({ loc, lastmod }) =>
				`<url><loc>${xmlEscape(loc)}</loc>${
					lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ""
				}</url>`,
		)
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
