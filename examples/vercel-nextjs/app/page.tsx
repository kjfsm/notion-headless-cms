import Link from "next/link";
import { cms } from "@/app/lib/cms";

export const revalidate = 300;

export default async function HomePage() {
  const items = await cms.posts.list().catch(() => []);
  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">記事一覧</h1>
      <ul className="space-y-4">
        {items.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/posts/${post.slug}`}
              className="block p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <strong className="text-lg font-semibold">{post.slug}</strong>
              {post.publishedAt && (
                <time className="block text-sm text-gray-500 mt-1">
                  {post.publishedAt}
                </time>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
