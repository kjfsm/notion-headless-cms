import { useEffect } from "react";
import { Link, useRevalidator } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const items = await cms.posts.list();
  return { items };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { revalidate } = useRevalidator();
  // ハイドレーション後に loader を 1 度再走させ、SWR の bg 更新で差し替わった
  // 最新の一覧をクエリ無し・別 API fetch 無しで取り込む。
  useEffect(() => {
    revalidate();
  }, [revalidate]);

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
