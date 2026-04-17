import type { ContentItem } from "@notion-headless-cms/core";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getCMS } from "../../workers/cms";
import type { Route } from "./+types/blog._index";

export function meta() {
	return [
		{ title: "ブログ — Euphoric" },
		{ name: "description", content: "Euphoricの最新ニュース・ブログ" },
	];
}

export async function loader({ context }: Route.LoaderArgs) {
	const { env, ctx } = context.cloudflare;
	const cms = getCMS(env);

	// ローカル開発フォールバック: CACHE_BUCKET は wrangler dev でのみ利用可能
	if (!env.CACHE_BUCKET) {
		return { items: await cms.getItems(env), listVersion: "" };
	}
	return cms.getItemsCachedFirst(env, {
		waitUntil: (promise) => ctx.waitUntil(promise),
	});
}

export default function BlogIndex({ loaderData }: Route.ComponentProps) {
	const [items, setItems] = useState(loaderData.items);

	useEffect(() => {
		fetch(
			`/api/posts/check?version=${encodeURIComponent(loaderData.listVersion)}`,
		)
			.then(
				(res) =>
					res.json() as Promise<{ changed: boolean; items?: ContentItem[] }>,
			)
			.then((data) => {
				if (data.changed && data.items) {
					setItems(data.items);
				}
			})
			.catch(() => {
				// サイレントに失敗 — キャッシュ版を表示し続ける
			});
	}, [loaderData]);

	return (
		<div className="min-h-screen bg-white pt-20">
			<div className="mx-auto max-w-3xl px-6 py-16">
				<h1 className="mb-12 text-4xl font-black tracking-tighter text-gray-900">
					ブログ
				</h1>

				{items.length === 0 ? (
					<p className="text-gray-400">
						まだ投稿がありません。またチェックしてください。
					</p>
				) : (
					<ul className="divide-y divide-gray-100">
						{items.map((item) => (
							<li key={item.id} className="py-8">
								<Link
									to={`/blog/${item.slug}`}
									className="group block space-y-2"
								>
									<p className="font-mono text-xs text-purple-500">
										{new Date(item.publishedAt).toLocaleDateString("ja-JP", {
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</p>
									<h2 className="text-2xl font-bold text-gray-900 transition group-hover:text-purple-600">
										{item.title}
									</h2>
									{item.author ? (
										<p className="text-sm text-gray-500">著者: {item.author}</p>
									) : null}
									<span className="text-sm text-gray-400 transition group-hover:text-purple-500">
										続きを読む →
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
