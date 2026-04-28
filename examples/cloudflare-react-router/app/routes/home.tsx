import { Link } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env);
  const items = await cms.posts.list();
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
              <strong>{post.slug}</strong>
              {post.publishedAt && <time>{post.publishedAt}</time>}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
