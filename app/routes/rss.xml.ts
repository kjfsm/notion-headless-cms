import { buildRssXml } from "~/lib/rss";
import { blogPostUrl, resolveSiteUrl } from "~/lib/url";
import { getCMS } from "../../workers/cms";
import type { Route } from "./+types/rss.xml";

export async function loader({ request, context }: Route.LoaderArgs) {
	const { env } = context.cloudflare;
	const cms = getCMS(env);
	const posts = await cms.getItems(env);
	const siteUrl = resolveSiteUrl(request);

	const xml = buildRssXml({
		title: "Euphoric Blog",
		link: siteUrl,
		description: "Euphoricのニュース・ブログ配信",
		items: posts.map((post) => ({
			title: post.title,
			link: blogPostUrl(post.slug, request),
			pubDate: post.publishedAt,
			description: `${post.title} の記事です。`,
		})),
	});

	return new Response(xml, {
		headers: {
			"content-type": "application/xml; charset=utf-8",
		},
	});
}
