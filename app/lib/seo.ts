type SeoInput = {
	title: string;
	description: string;
	image?: string;
	url: string;
};

export function buildSeo({ title, description, image, url }: SeoInput) {
	const seo = [
		{ title },
		{ name: "description", content: description },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:type", content: "article" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
	];

	if (image) {
		seo.push(
			{ property: "og:image", content: image },
			{ name: "twitter:image", content: image },
		);
	}

	return seo;
}
