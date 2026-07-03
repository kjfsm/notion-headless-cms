import { useNotionRevalidate } from "@notion-headless-cms/react-renderer/router";
import { Link } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const { items } = await cms.posts.list();
  return { items };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  // 一覧チャンネル（RealtimeHubDO）を購読し、記事の増減・状態変化を即反映する。
  useNotionRevalidate({ realtime: { collection: "posts" } });
  return (
    <main>
      <h1>記事一覧</h1>
      <ul>
        {items.map((post) => {
          const meta = post.meta as { publishedAt?: string | null };
          return (
            <li key={post.slug}>
              <Link to={`/posts/${post.slug}`}>
                <strong>{post.slug}</strong>
                {meta.publishedAt && <time>{meta.publishedAt}</time>}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
