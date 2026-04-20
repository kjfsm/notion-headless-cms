import { data } from "react-router";
import type { Route } from "./+types/post";
import { createCMS } from "../lib/cms";

export async function loader({ params, context }: Route.LoaderArgs) {
	const cms = createCMS(context.cloudflare.env);
	const entry = await cms.cached.get(params.slug ?? "");
	if (!entry) throw data("Not Found", { status: 404 });
	return entry;
}

export default function Post({ loaderData }: Route.ComponentProps) {
	const { html, item } = loaderData;
	return (
		<article>
			<h1>{item.title}</h1>
			{item.publishedAt && <time>{item.publishedAt}</time>}
			{item.tags.length > 0 && (
				<ul>
					{item.tags.map((tag) => (
						<li key={tag}>{tag}</li>
					))}
				</ul>
			)}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</article>
	);
}
