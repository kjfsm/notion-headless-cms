import { useEffect, useState } from "react";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
	const cms = makeCms(context.cloudflare.env);
	const post = await cms.posts.get(params.slug ?? "");
	if (!post) throw data("Not Found", { status: 404 });
	const html = await post.render();
	return { html, item: post, version: post.updatedAt };
}

export default function Post({ loaderData }: Route.ComponentProps) {
	const { html: initialHtml, item, version } = loaderData;
	const [html, setHtml] = useState(initialHtml);

	// マウント時に1回だけ更新チェック。差分があればその場で HTML を差し替える
	useEffect(() => {
		fetch(`/api/posts/${item.slug}/check?v=${encodeURIComponent(version)}`)
			.then((res) => (res.ok ? res.json() : null))
			.then((result: { stale: boolean; html?: string } | null) => {
				if (result?.stale && result.html) setHtml(result.html);
			})
			.catch((err: unknown) => {
				console.warn("更新チェックに失敗しました:", err);
			});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<article>
			<h1>{item.slug}</h1>
			{item.publishedAt && <time>{item.publishedAt}</time>}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</article>
	);
}
