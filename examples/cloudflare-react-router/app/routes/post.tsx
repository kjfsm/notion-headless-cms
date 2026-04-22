import { data } from "react-router";
import { createCMS } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
	const cms = createCMS(context.cloudflare.env);
	const entry = await cms.cache.get(params.slug ?? "");
	if (!entry) throw data("Not Found", { status: 404 });
	return entry;
}

export default function Post({ loaderData }: Route.ComponentProps) {
	const { html, item } = loaderData;
	return (
		<article>
			<h1>{item.slug}</h1>
			{item.publishedAt && <time>{item.publishedAt}</time>}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</article>
	);
}
