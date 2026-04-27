import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
	const cms = makeCms(context.cloudflare.env);
	const post = await cms.posts.get(params.slug ?? "");
	if (!post) throw data("Not Found", { status: 404 });
	const html = await post.render();
	return { html, item: post };
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
