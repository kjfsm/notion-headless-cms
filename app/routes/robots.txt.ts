import { resolveSiteUrl } from "~/lib/url";
import type { Route } from "./+types/robots.txt";

export function loader({ request }: Route.LoaderArgs) {
	const siteUrl = resolveSiteUrl(request);
	const txt = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;

	return new Response(txt, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}
