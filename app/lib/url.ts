export const SITE_URL = "https://example.com";

export function resolveSiteUrl(request?: Request) {
	if (!request) return SITE_URL;
	return new URL(request.url).origin;
}

export function blogPostUrl(slug: string, request?: Request) {
	return `${resolveSiteUrl(request)}/blog/${slug}`;
}
