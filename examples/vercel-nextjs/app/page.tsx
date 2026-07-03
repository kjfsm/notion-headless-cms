import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import Link from "next/link";
import { cms, ensureSynced } from "@/app/lib/cms";

export const revalidate = 300;

export default async function HomePage() {
  await ensureSynced();
  const { items } = await cms.posts.list().catch(() => ({
    items: [],
    nextCursor: null,
    hasMore: false,
  }));
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      {/* ハイドレーション後に router.refresh() を呼び、SWR で差し替わった
          最新の一覧を RSC ストリーム経由で静かに取り込む。 */}
      <NotionRevalidator />
      <h1 className="text-3xl font-bold mb-8">記事一覧</h1>
      <ul className="space-y-4">
        {items.map((post) => {
          const meta = post.meta as { publishedAt?: string | null };
          return (
            <li key={post.slug}>
              <Link
                href={`/posts/${post.slug}`}
                className="block p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <strong className="text-lg font-semibold">{post.slug}</strong>
                {meta.publishedAt && (
                  <time className="block text-sm text-gray-500 mt-1">
                    {meta.publishedAt}
                  </time>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
