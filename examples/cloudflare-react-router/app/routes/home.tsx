import { Link } from "react-router";
import type { Route } from "./+types/home";
import { createCMS } from "../lib/cms";

export async function loader({ context }: Route.LoaderArgs) {
	const cms = createCMS(context.cloudflare.env);
	const { items } = await cms.getList();
	return { items };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { items } = loaderData;
	return (
		<main>
			<h1>記事一覧</h1>
			<ul>
				{items.map((post) => (
					<li key={post.slug}>
						<Link to={`/posts/${post.slug}`}>
							<strong>{post.title || post.slug}</strong>
							{post.publishedAt && <time>{post.publishedAt}</time>}
						</Link>
					</li>
				))}
			</ul>
		</main>
	);
}
