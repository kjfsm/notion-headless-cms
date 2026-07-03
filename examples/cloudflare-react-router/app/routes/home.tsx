import { useNotionRevalidate } from "@notion-headless-cms/react-renderer/router";
import { Link } from "react-router";
import { ensureSynced, makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const cms = makeCms(env, ctx);
  await ensureSynced(cms);
  const { items } = await cms.posts.list();
  return { items };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  // mount / 再フォーカス時に loader を再走させ、裏で進んだ同期結果を反映する。
  useNotionRevalidate();
  return (
    <main>
      <h1>記事一覧</h1>
      <ul>
        {items.map((post) => {
          const meta = post.meta as { 公開日?: string | null };
          return (
            <li key={post.slug}>
              <Link to={`/posts/${post.slug}`}>
                <strong>{post.slug}</strong>
                {meta.公開日 && <time>{meta.公開日}</time>}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
