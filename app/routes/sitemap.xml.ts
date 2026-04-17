import { buildSitemapXml } from "~/lib/sitemap";
import { blogPostUrl, resolveSiteUrl } from "~/lib/url";
import { getCMS } from "../../workers/cms";
import type { Route } from "./+types/sitemap.xml";

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.cloudflare;
	const cms = getCMS(env);
	const posts = await cms.getItems(env);
	const siteUrl = resolveSiteUrl(request);
	const now = new Date().toISOString();

	const entries = [
		{ loc: siteUrl, lastmod: now },
		{ loc: `${siteUrl}/blog`, lastmod: now },
		...posts.map((post) => ({
			loc: blogPostUrl(post.slug, request),
			lastmod: post.updatedAt,
		})),
	];

	return new Response(buildSitemapXml(entries), {
		headers: {
			"content-type": "application/xml; charset=utf-8",
		},
	});
}
