import Link from "next/link";
import { cms } from "./lib/cms";

export const revalidate = 300;

export default async function HomePage() {
	const { items } = await cms.cache.read
		.list()
		.catch(() => ({ items: [], isStale: false, cachedAt: 0 }));
	return (
		<main>
			<h1>記事一覧</h1>
			<ul>
				{items.map((post) => (
					<li key={post.slug}>
						<Link href={`/posts/${post.slug}`}>
							<strong>{post.title || post.slug}</strong>
							{post.publishedAt && <time>{post.publishedAt}</time>}
						</Link>
					</li>
				))}
			</ul>
		</main>
	);
}
