import type { ContentItem } from "@notion-headless-cms/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { JsonLd } from "~/components/JsonLd";
import { ShareButtons } from "~/components/ShareButtons";
import { buildSeo } from "~/lib/seo";
import { blogPostUrl } from "~/lib/url";
import { getCMS } from "../../workers/cms";
import type { Route } from "./+types/blog.$slug";

function buildPostDescription(item: { title: string; author: string }) {
	return item.author
		? `${item.title} | 著者: ${item.author} | Euphoric Blog`
		: `${item.title} | Euphoric Blog`;
}

export async function loader({ params, context, request }: Route.LoaderArgs) {
	const { env, ctx } = context.cloudflare;
	const cms = getCMS(env);
	const { slug } = params;
	const canonicalUrl = blogPostUrl(slug, request);

	// ローカル開発フォールバック: CACHE_BUCKET は wrangler dev でのみ利用可能
	if (!env.CACHE_BUCKET) {
		const entry = await cms.renderItemBySlug(env, slug);
		if (!entry) throw new Response("Not Found", { status: 404 });
		return {
			item: entry.item,
			html: entry.html,
			notionUpdatedAt: entry.notionUpdatedAt,
			canonicalUrl,
		};
	}
	const entry = await cms.getItemCachedFirst(env, slug, {
		waitUntil: (promise) => ctx.waitUntil(promise),
	});
	if (!entry) throw new Response("Not Found", { status: 404 });
	return {
		item: entry.item,
		html: entry.html,
		notionUpdatedAt: entry.notionUpdatedAt,
		canonicalUrl,
	};
}

export function meta({ loaderData }: Route.MetaArgs) {
	if (!loaderData) return [{ title: "記事 — Euphoric" }];

	return buildSeo({
		title: `${loaderData.item.title} — Euphoric`,
		description: buildPostDescription(loaderData.item),
		url: loaderData.canonicalUrl,
	});
}

export default function Post({ loaderData }: Route.ComponentProps) {
	const [html, setHtml] = useState(loaderData.html);
	const [item, setItem] = useState(loaderData.item);

	useEffect(() => {
		const { slug } = loaderData.item;
		fetch(
			`/api/posts/${slug}/check?lastEdited=${encodeURIComponent(loaderData.notionUpdatedAt)}`,
		)
			.then(
				(res) =>
					res.json() as Promise<{
						changed: boolean;
						html?: string;
						item?: ContentItem;
					}>,
			)
			.then((data) => {
				if (data.changed && data.html && data.item) {
					setHtml(data.html);
					setItem(data.item);
				}
			})
			.catch(() => {
				// サイレントに失敗 — キャッシュ版を表示し続ける
			});
	}, [loaderData]);

	return (
		<div className="min-h-screen bg-white pt-20">
			<article className="mx-auto max-w-2xl px-6 py-16">
				<JsonLd
					data={{
						"@context": "https://schema.org",
						"@type": "BlogPosting",
						headline: item.title,
						description: buildPostDescription(item),
						datePublished: item.publishedAt,
						dateModified: item.updatedAt,
						author: {
							"@type": "Person",
							name: item.author || "Euphoric",
						},
						mainEntityOfPage: loaderData.canonicalUrl,
					}}
				/>
				<Link
					to="/blog"
					className="mb-8 inline-block text-sm text-gray-400 transition hover:text-gray-700"
				>
					← ブログに戻る
				</Link>
				<p className="mb-4 font-mono text-xs text-purple-500">
					{new Date(item.publishedAt).toLocaleDateString("ja-JP", {
						year: "numeric",
						month: "long",
						day: "numeric",
					})}
				</p>
				{item.author ? (
					<p className="mb-4 text-sm text-gray-500">著者: {item.author}</p>
				) : null}
				<h1 className="mb-12 text-4xl font-black tracking-tighter text-gray-900">
					{item.title}
				</h1>
				<div
					className="prose prose-purple max-w-none"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: server-generated from owner-controlled Notion CMS
					dangerouslySetInnerHTML={{ __html: html }}
				/>
				<ShareButtons url={loaderData.canonicalUrl} title={item.title} />
			</article>
		</div>
	);
}
