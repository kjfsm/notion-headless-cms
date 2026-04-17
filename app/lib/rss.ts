function xmlEscape(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export type RssItem = {
	title: string;
	link: string;
	pubDate: string;
	description: string;
};

export function buildRssXml(params: {
	title: string;
	link: string;
	description: string;
	items: RssItem[];
}) {
	const items = params.items
		.map(
			(item) =>
				`<item><title>${xmlEscape(item.title)}</title><link>${xmlEscape(item.link)}</link><pubDate>${xmlEscape(new Date(item.pubDate).toUTCString())}</pubDate><description>${xmlEscape(item.description)}</description></item>`,
		)
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xmlEscape(params.title)}</title><link>${xmlEscape(params.link)}</link><description>${xmlEscape(params.description)}</description>${items}</channel></rss>`;
}
