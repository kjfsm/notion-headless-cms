import Link from "next/link";
import { cms } from "./lib/cms";

export const revalidate = 300;

export default async function HomePage() {
	const items = await cms.posts.getList().catch(() => []);
	return (
		<main>
			<h1>記事一覧</h1>
			<ul>
				{items.map((post) => (
					<li key={post.slug}>
						<Link href={`/posts/${post.slug}`}>
							<strong>{post.slug}</strong>
							{post.publishedAt && <time>{post.publishedAt}</time>}
						</Link>
					</li>
				))}
			</ul>
		</main>
	);
}
